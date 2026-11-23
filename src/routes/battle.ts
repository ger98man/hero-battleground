import { Router, type Request, type Response } from "express";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import {
  applyPlayerAction,
  applySideAction,
  BattleError,
  createBattle,
  other,
  reachableCells,
  skillBlocker,
  startBattle,
  actorQueue,
  activeActor,
  activeStack,
  stackReachable,
  stackTargets,
  unitSkill,
  visibleCells,
  type BattleAction,
  type BattleEvent,
  type BattleState,
  type Side,
} from "../game/battle.js";
import { randomBuild, simpleBot } from "../game/bot.js";
import { combatProfile } from "../game/build.js";
import { defaultArmy, FACTIONS } from "../game/factions.js";
import { postSystemMessage } from "../realtime/chat.js";
import { getHeroByUser, grantHeroBattleResult, heroTitle, type HeroRow } from "../services/heroes.js";
import {
  announcePvpResult,
  applyTimeout,
  BATTLE_COLUMNS,
  heroInBattle,
  notifyBattle,
  openChallengeOf,
  savePvp,
  sideOf,
  type BattleRow,
  type PvpRewards,
  type Rewards,
} from "../services/pvp.js";

export const battleRouter = Router();
battleRouter.use(requireAuth);


const BOT_NAMES = ["Тренировочный манекен", "Страж арены", "Безымянный наёмник", "Призрак арены"];

const flipStatus = (st: BattleState["status"]) => (st === "won" ? "lost" : st === "lost" ? "won" : st);

/**
 * The battle as seen by one side: the viewer is always `units.player`, and `status` is the
 * viewer's result. In PvP the opponent of the challenge creator gets a mirrored copy.
 */
function asSeenBy(s: BattleState, side: Side): BattleState {
  if (side === "player") return s;
  const flipActor = (id: string | undefined) => (id === "player" ? "bot" : id === "bot" ? "player" : id);
  return {
    ...s,
    units: { player: { ...s.units.bot, side: "player" }, bot: { ...s.units.player, side: "bot" } },
    stacks: s.stacks?.map((st) => ({ ...st, side: other(st.side) })),
    turn: other(s.turn),
    active: flipActor(s.active),
    nextTime: { ...s.nextTime, player: s.nextTime.bot, bot: s.nextTime.player },
    tieFirst: other(s.tieFirst),
    status: flipStatus(s.status),
  };
}

function eventsSeenBy(events: BattleEvent[], side: Side): BattleEvent[] {
  if (side === "player") return events;
  return events.map((e) => {
    if (e.type === "end") return { ...e, status: flipStatus(e.status) };
    return "side" in e ? { ...e, side: other(e.side) } : e;
  });
}

/** What the client needs to draw the battle screen, from the viewing hero's side. */
function battleView(row: BattleRow, heroId: number) {
  const side = sideOf(row, heroId);
  const s = asSeenBy(row.state, side);
  const rewards = row.mode === "pvp" ? ((row.rewards as PvpRewards | null)?.byHero[heroId] ?? null) : row.rewards;
  const player = s.units.player;
  const myTurn = s.status === "active" && s.turn === "player";
  const stack = activeStack(s);
  const heroTurn = myTurn && !stack;
  const stackTurn = myTurn && stack ? stack : undefined;
  return {
    id: row.id,
    mode: row.mode,
    status: s.status,
    rewards,
    state: s,
    /** PvP: when the current turn ends automatically (ISO), and the server clock to correct for drift. */
    turnDeadline: row.turn_deadline ? row.turn_deadline.toISOString() : null,
    serverNow: new Date().toISOString(),
    queue: s.status === "active" ? actorQueue(s, 10) : [],
    active: activeActor(s),
    skills: player.skills.map((id, i) => {
      const sk = unitSkill(id);
      return {
        ...sk,
        basic: i === 0,
        cooldownLeft: player.cooldowns[sk.id] ?? 0,
        blocker: heroTurn ? skillBlocker(player, sk) : stackTurn ? "Сейчас ходит отряд" : "Сейчас не ваш ход",
      };
    }),
    botSkills: s.units.bot.skills.map((id) => {
      const sk = unitSkill(id);
      return { id: sk.id, name: sk.name, icon: sk.icon };
    }),
    reachable: heroTurn
      ? [...reachableCells(s, "player").keys()].map((k) => k.split(",").map(Number))
      : stackTurn ? [...stackReachable(s, stackTurn).keys()].map((k) => k.split(",").map(Number)) : [],
    /** Cells the player can target from the current position (line of sight). */
    visible: heroTurn ? visibleCells(s, "player") : [],
    /** Stack turn: enemy cells the active stack can attack now. */
    targets: stackTurn ? stackTargets(s, stackTurn) : [],
  };
}

/** Old battles (before classes) cannot be shown. */
const isCurrentFormat = (row: BattleRow) => row.state?.version === 2;

function sendBattle(res: Response, row: BattleRow, heroId: number, events: BattleEvent[] = []) {
  res.json({ battle: battleView(row, heroId), events: eventsSeenBy(events, sideOf(row, heroId)) });
}

/** Battles the hero takes part in, on either side. */
const PARTICIPANT = "(b.hero_id = h.id OR b.opponent_hero_id = h.id)";

/** Start a battle against a bot, or return the one already in progress. */
battleRouter.post("/", async (req, res) => {
  const hero = await getHeroByUser(req.session.userId!);
  if (!hero) {
    res.status(404).json({ error: "Герой не найден" });
    return;
  }
  const existing = await pool.query<BattleRow>(
    `SELECT ${BATTLE_COLUMNS} FROM battles b JOIN heroes h ON ${PARTICIPANT} WHERE h.id = $1 AND b.status = 'active'`,
    [hero.id],
  );
  if (existing.rows[0]) return sendBattle(res, existing.rows[0], hero.id);
  if (await openChallengeOf(pool, hero.id)) {
    res.status(409).json({ error: "Сначала отмените свою заявку на PvP" });
    return;
  }

  if (!hero.build.classes.length) {
    res.status(400).json({ error: "Сначала выберите фракцию и героя" });
    return;
  }
  const state = createBattle(
    { name: hero.name, level: hero.level, army: hero.army, profile: { ...combatProfile(hero.level, hero.build), className: heroTitle({ faction: hero.faction, factionHero: hero.faction_hero, build: hero.build }) } },
    {
      name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
      // The bot has the same level, a random legal build and the starting army of a random faction.
      level: hero.level,
      profile: combatProfile(hero.level, randomBuild(hero.level)),
      army: hero.army.length ? defaultArmy({ faction: FACTIONS[Math.floor(Math.random() * FACTIONS.length)].id, level: hero.level }) : [],
    },
  );
  const events = startBattle(state, simpleBot);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock the hero so a PvP challenge cannot be created or joined at the same moment.
    await client.query("SELECT id FROM heroes WHERE id = $1 FOR UPDATE", [hero.id]);
    if ((await heroInBattle(client, hero.id)) || (await openChallengeOf(client, hero.id))) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Бой уже идёт или открыта заявка на PvP" });
      return;
    }
    const { rows } = await client.query<BattleRow>(
      `INSERT INTO battles AS b (hero_id, state) VALUES ($1, $2) RETURNING ${BATTLE_COLUMNS}`,
      [hero.id, state],
    );
    await client.query("COMMIT");
    res.status(201);
    return sendBattle(res, rows[0], hero.id, events);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // Two clicks at once: the unique index keeps one active battle.
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Бой уже идёт" });
      return;
    }
    throw err;
  } finally {
    client.release();
  }
});

/** Current active battle, or null. */
battleRouter.get("/current", async (req, res) => {
  const { rows } = await pool.query<BattleRow & { viewer: number }>(
    `SELECT ${BATTLE_COLUMNS}, h.id::int AS viewer FROM battles b JOIN heroes h ON ${PARTICIPANT}
      WHERE h.user_id = $1 AND b.status = 'active'`,
    [req.session.userId],
  );
  res.json({ battle: rows[0] && isCurrentFormat(rows[0]) ? battleView(rows[0], rows[0].viewer) : null });
});

battleRouter.get("/:id", async (req, res) => {
  const { rows } = await pool.query<BattleRow & { viewer: number }>(
    `SELECT ${BATTLE_COLUMNS}, h.id::int AS viewer FROM battles b JOIN heroes h ON ${PARTICIPANT}
      WHERE b.id = $1 AND h.user_id = $2`,
    [Number(req.params.id) || 0, req.session.userId],
  );
  if (!rows[0] || !isCurrentFormat(rows[0])) {
    res.status(404).json({ error: "Бой не найден" });
    return;
  }
  return sendBattle(res, rows[0], rows[0].viewer);
});

function parseAction(req: Request): BattleAction | null {
  const b = req.body ?? {};
  const x = Number(b.x);
  const y = Number(b.y);
  switch (b.type) {
    case "move":
      return Number.isInteger(x) && Number.isInteger(y) ? { type: "move", x, y } : null;
    case "attack":
      return Number.isInteger(x) && Number.isInteger(y) ? { type: "attack", x, y } : null;
    case "skill":
      return typeof b.skillId === "string" && Number.isInteger(x) && Number.isInteger(y)
        ? { type: "skill", skillId: b.skillId, x, y }
        : null;
    case "end_turn":
    case "surrender":
    case "auto":
      return { type: b.type };
    default:
      return null;
  }
}

battleRouter.post("/:id/action", async (req, res) => {
  const action = parseAction(req);
  if (!action) {
    res.status(400).json({ error: "Некорректное действие" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hero = await getHeroByUser(req.session.userId!, client, true);
    const { rows } = await client.query<BattleRow>(
      `SELECT ${BATTLE_COLUMNS} FROM battles b
        WHERE b.id = $1 AND (b.hero_id = $2 OR b.opponent_hero_id = $2) FOR UPDATE`,
      [Number(req.params.id) || 0, hero?.id ?? 0],
    );
    const row = rows[0];
    if (!hero || !row || !isCurrentFormat(row)) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Бой не найден" });
      return;
    }

    if (row.mode === "pvp") return await pvpAction(client, res, row, hero.id, action);

    let events: BattleEvent[];
    try {
      events = applyPlayerAction(row.state, action, simpleBot);
    } catch (err) {
      await client.query("ROLLBACK");
      if (err instanceof BattleError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    if (row.state.status !== "active") {
      row.rewards = await grantRewards(client, hero, row.state);
    }
    row.status = row.state.status;

    await client.query(
      `UPDATE battles SET state = $2, status = $3, rewards = $4, updated_at = now(),
              finished_at = CASE WHEN $3 = 'active' THEN NULL ELSE now() END
        WHERE id = $1`,
      [row.id, row.state, row.status, row.rewards],
    );
    await client.query("COMMIT");
    if (row.state.status !== "active") {
      const { player, bot } = row.state.units;
      const [winner, loser] = row.state.status === "won" ? [player, bot] : [bot, player];
      void postSystemMessage(`${winner.name} победил ${loser.name} (бой с ботом)`);
    }
    return sendBattle(res, row, hero.id, events);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

/** PvP action inside the open transaction (battle row locked). Commits or rolls back. */
async function pvpAction(client: PoolClient, res: Response, row: BattleRow, heroId: number, action: BattleAction) {
  const events: BattleEvent[] = [];
  // A turn that already ran out ends first, so a late click cannot act on the opponent's time.
  const timedOut = await applyTimeout(client, row, events);
  const actorBefore = `${row.state.turn}:${activeActor(row.state)}:${row.state.time}`;
  try {
    events.push(...applySideAction(row.state, sideOf(row, heroId), action, Math.random, simpleBot));
  } catch (err) {
    if (!(err instanceof BattleError)) throw err;
    await client.query(timedOut ? "COMMIT" : "ROLLBACK");
    if (timedOut) {
      void notifyBattle(row);
      if (row.state.status !== "active") announcePvpResult(row);
    }
    res.status(400).json({ error: timedOut ? "Время хода вышло" : err.message });
    return;
  }
  await savePvp(client, row, actorBefore !== `${row.state.turn}:${activeActor(row.state)}:${row.state.time}`);
  await client.query("COMMIT");
  void notifyBattle(row);
  if (row.state.status !== "active") announcePvpResult(row);
  return sendBattle(res, row, heroId, events);
}


/** Hero XP and bot win/loss counter. */
async function grantRewards(client: PoolClient, hero: HeroRow, state: BattleState): Promise<Rewards> {
  const won = state.status === "won";
  const experience = won ? 30 + 10 * state.units.bot.level : 10;
  const levelsGained = await grantHeroBattleResult(client, hero, won, experience);
  return { experience, levelsGained };
}
