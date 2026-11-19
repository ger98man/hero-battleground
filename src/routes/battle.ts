import { Router, type Request, type Response } from "express";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import {
  applyPlayerAction,
  BattleError,
  createBattle,
  reachableCells,
  skillBlocker,
  startBattle,
  turnQueue,
  unitSkill,
  visibleCells,
  type BattleAction,
  type BattleEvent,
  type BattleState,
} from "../game/battle.js";
import { randomBuild, simpleBot } from "../game/bot.js";
import { combatProfile } from "../game/build.js";
import { postSystemMessage } from "../realtime/chat.js";
import { getHeroByUser, grantHeroBattleResult, type HeroRow } from "../services/heroes.js";

export const battleRouter = Router();
battleRouter.use(requireAuth);

interface BattleRow {
  id: number;
  status: string;
  state: BattleState;
  rewards: Rewards | null;
}

interface Rewards {
  experience: number;
  levelsGained: number;
}

const BOT_NAMES = ["Тренировочный манекен", "Страж арены", "Безымянный наёмник", "Призрак арены"];

/** What the client needs to draw the battle screen. */
function battleView(row: BattleRow) {
  const s = row.state;
  const player = s.units.player;
  const myTurn = s.status === "active" && s.turn === "player";
  return {
    id: row.id,
    status: s.status,
    rewards: row.rewards,
    state: s,
    queue: s.status === "active" ? turnQueue(s, 8) : [],
    skills: player.skills.map((id, i) => {
      const sk = unitSkill(id);
      return {
        ...sk,
        basic: i === 0,
        cooldownLeft: player.cooldowns[sk.id] ?? 0,
        blocker: myTurn ? skillBlocker(player, sk) : "Сейчас не ваш ход",
      };
    }),
    botSkills: s.units.bot.skills.map((id) => {
      const sk = unitSkill(id);
      return { id: sk.id, name: sk.name, icon: sk.icon };
    }),
    reachable: myTurn ? [...reachableCells(s, "player").keys()].map((k) => k.split(",").map(Number)) : [],
    /** Cells the player can target from the current position (line of sight). */
    visible: myTurn ? visibleCells(s, "player") : [],
  };
}

/** Old battles (before classes) cannot be shown. */
const isCurrentFormat = (row: BattleRow) => row.state?.version === 2;

async function sendBattle(res: Response, row: BattleRow, events: BattleEvent[] = []) {
  res.json({ battle: battleView(row), events });
}

/** Start a battle against a bot, or return the one already in progress. */
battleRouter.post("/", async (req, res) => {
  const hero = await getHeroByUser(req.session.userId!);
  if (!hero) {
    res.status(404).json({ error: "Герой не найден" });
    return;
  }
  const existing = await pool.query<BattleRow>(
    "SELECT id::int, status, state, rewards FROM battles WHERE hero_id = $1 AND status = 'active'",
    [hero.id],
  );
  if (existing.rows[0]) return sendBattle(res, existing.rows[0]);

  if (!hero.build.classes.length) {
    res.status(400).json({ error: "Сначала выберите класс" });
    return;
  }
  const state = createBattle(
    { name: hero.name, level: hero.level, profile: combatProfile(hero.level, hero.build) },
    {
      name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
      // The bot has the same level and a random legal build.
      level: hero.level,
      profile: combatProfile(hero.level, randomBuild(hero.level)),
    },
  );
  const events = startBattle(state, simpleBot);
  try {
    const { rows } = await pool.query<BattleRow>(
      "INSERT INTO battles (hero_id, state) VALUES ($1, $2) RETURNING id::int, status, state, rewards",
      [hero.id, state],
    );
    res.status(201);
    return sendBattle(res, rows[0], events);
  } catch (err) {
    // Two clicks at once: the unique index keeps one active battle.
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Бой уже идёт" });
      return;
    }
    throw err;
  }
});

/** Current active battle, or null. */
battleRouter.get("/current", async (req, res) => {
  const { rows } = await pool.query<BattleRow>(
    `SELECT b.id::int, b.status, b.state, b.rewards FROM battles b JOIN heroes h ON h.id = b.hero_id
      WHERE h.user_id = $1 AND b.status = 'active'`,
    [req.session.userId],
  );
  res.json({ battle: rows[0] && isCurrentFormat(rows[0]) ? battleView(rows[0]) : null });
});

battleRouter.get("/:id", async (req, res) => {
  const { rows } = await pool.query<BattleRow>(
    `SELECT b.id::int, b.status, b.state, b.rewards FROM battles b JOIN heroes h ON h.id = b.hero_id
      WHERE b.id = $1 AND h.user_id = $2`,
    [Number(req.params.id) || 0, req.session.userId],
  );
  if (!rows[0] || !isCurrentFormat(rows[0])) {
    res.status(404).json({ error: "Бой не найден" });
    return;
  }
  return sendBattle(res, rows[0]);
});

function parseAction(req: Request): BattleAction | null {
  const b = req.body ?? {};
  const x = Number(b.x);
  const y = Number(b.y);
  switch (b.type) {
    case "move":
      return Number.isInteger(x) && Number.isInteger(y) ? { type: "move", x, y } : null;
    case "skill":
      return typeof b.skillId === "string" && Number.isInteger(x) && Number.isInteger(y)
        ? { type: "skill", skillId: b.skillId, x, y }
        : null;
    case "end_turn":
    case "surrender":
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
      "SELECT id::int, status, state, rewards FROM battles WHERE id = $1 AND hero_id = $2 FOR UPDATE",
      [Number(req.params.id) || 0, hero?.id ?? 0],
    );
    const row = rows[0];
    if (!hero || !row || !isCurrentFormat(row)) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Бой не найден" });
      return;
    }

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
    return sendBattle(res, row, events);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});


/** Hero XP and bot win/loss counter. */
async function grantRewards(client: PoolClient, hero: HeroRow, state: BattleState): Promise<Rewards> {
  const won = state.status === "won";
  const experience = won ? 30 + 10 * state.units.bot.level : 10;
  const levelsGained = await grantHeroBattleResult(client, hero, won, experience);
  return { experience, levelsGained };
}
