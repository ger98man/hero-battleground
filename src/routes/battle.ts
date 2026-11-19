import { Router, type Request, type Response } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import { ARTIFACT_DROP_CHANCE, ARTIFACTS } from "../game/artifacts.js";
import {
  applyPlayerAction,
  BattleError,
  createBattle,
  reachableCells,
  skillBlocker,
  unitArtifact,
  type BattleAction,
  type BattleEvent,
  type BattleState,
} from "../game/battle.js";
import { simpleBot } from "../game/bot.js";
import { baseStatsForLevel, combatStats } from "../game/stats.js";
import { getHeroByUser, grantBattleResult, heroCombatStats, ownedArtifactIds } from "../services/heroes.js";

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
  droppedArtifact: { id: string; name: string } | null;
}

const BOT_NAMES = ["Тренировочный манекен", "Страж арены", "Безымянный наёмник", "Призрак арены"];

/** What the client needs to draw the battle screen. */
function battleView(row: BattleRow) {
  const s = row.state;
  const player = s.units.player;
  const playerArtifact = unitArtifact(player);
  const botArtifact = unitArtifact(s.units.bot);
  const myTurn = s.status === "active" && s.turn === "player";
  const brief = (a: typeof playerArtifact) => ({ id: a.id, name: a.name, className: a.className, icon: a.icon });
  return {
    id: row.id,
    status: s.status,
    rewards: row.rewards,
    state: s,
    playerArtifact: brief(playerArtifact),
    botArtifact: brief(botArtifact),
    skills: playerArtifact.skills.map((sk) => ({
      ...sk,
      cooldownLeft: player.cooldowns[sk.id] ?? 0,
      blocker: myTurn ? skillBlocker(player, sk) : "Сейчас не ваш ход",
    })),
    botSkills: botArtifact.skills.map((sk) => ({ id: sk.id, name: sk.name, icon: sk.icon })),
    reachable: myTurn ? [...reachableCells(s, "player").keys()].map((k) => k.split(",").map(Number)) : [],
  };
}

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

  const stats = heroCombatStats(hero);
  if (!stats || !hero.equipped_artifact) {
    res.status(400).json({ error: "Сначала выберите артефакт" });
    return;
  }
  const botArtifact = ARTIFACTS[Math.floor(Math.random() * ARTIFACTS.length)];
  const state = createBattle(
    { name: hero.name, level: hero.level, artifactId: hero.equipped_artifact, stats },
    {
      name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
      level: hero.level,
      artifactId: botArtifact.id,
      stats: combatStats(baseStatsForLevel(hero.level), botArtifact),
    },
  );
  try {
    const { rows } = await pool.query<BattleRow>(
      "INSERT INTO battles (hero_id, state) VALUES ($1, $2) RETURNING id::int, status, state, rewards",
      [hero.id, state],
    );
    res.status(201);
    return sendBattle(res, rows[0]);
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
  res.json({ battle: rows[0] ? battleView(rows[0]) : null });
});

battleRouter.get("/:id", async (req, res) => {
  const { rows } = await pool.query<BattleRow>(
    `SELECT b.id::int, b.status, b.state, b.rewards FROM battles b JOIN heroes h ON h.id = b.hero_id
      WHERE b.id = $1 AND h.user_id = $2`,
    [Number(req.params.id) || 0, req.session.userId],
  );
  if (!rows[0]) {
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
    if (!hero || !row) {
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
      const won = row.state.status === "won";
      const experience = won ? 30 + 10 * row.state.units.bot.level : 10;
      const levelsGained = await grantBattleResult(client, hero, won, experience);
      let droppedArtifact: Rewards["droppedArtifact"] = null;
      if (won && Math.random() < ARTIFACT_DROP_CHANCE) {
        const owned = new Set(await ownedArtifactIds(hero.id, client));
        const candidates = ARTIFACTS.filter((a) => !owned.has(a.id));
        const drop = candidates[Math.floor(Math.random() * candidates.length)];
        if (drop) {
          await client.query(
            "INSERT INTO hero_artifacts (hero_id, artifact_id, source) VALUES ($1, $2, 'drop') ON CONFLICT DO NOTHING",
            [hero.id, drop.id],
          );
          droppedArtifact = { id: drop.id, name: drop.name };
        }
      }
      row.rewards = { experience, levelsGained, droppedArtifact };
    }
    row.status = row.state.status;

    await client.query(
      `UPDATE battles SET state = $2, status = $3, rewards = $4, updated_at = now(),
              finished_at = CASE WHEN $3 = 'active' THEN NULL ELSE now() END
        WHERE id = $1`,
      [row.id, row.state, row.status, row.rewards],
    );
    await client.query("COMMIT");
    return sendBattle(res, row, events);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

