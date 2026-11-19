/**
 * PvP 1x1: challenges ("заявки") and the shared rules for battles between two heroes.
 * The battle engine is the same as for bot battles (src/game/battle.ts); the creator of the
 * challenge plays the "player" side and the opponent plays the "bot" side.
 */
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { combatProfile, overallClass, parseBuild } from "../game/build.js";
import { createBattle, other, timeoutTurn, type BattleEvent, type BattleState, type Side } from "../game/battle.js";
import { broadcastEvent, postSystemMessage, sendToUser } from "../realtime/chat.js";
import {
  getHeroById,
  getHeroByUser,
  grantHeroBattleResult,
  type HeroRow,
} from "./heroes.js";

type Db = Pick<PoolClient, "query">;

/** Placeholder numbers until game design settles them. */
export const PVP_RULES = {
  /** A challenge nobody joined is removed after this many minutes. */
  challengeLifetimeMinutes: 10,
  /** Time for one turn in a PvP battle. */
  turnSeconds: 30,
  /** PvP gives more experience than a bot battle: bot XP (win 30 + 10 × enemy level, loss 10) times this. */
  experienceMultiplier: 1.5,
};

export class PvpError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface Rewards {
  experience: number;
  levelsGained: number;
}

/** PvP rewards are stored per hero: `{ byHero: { [heroId]: Rewards } }`. */
export interface PvpRewards {
  byHero: Record<string, Rewards>;
}

export interface BattleRow {
  id: number;
  mode: "bot" | "pvp";
  hero_id: number;
  opponent_hero_id: number | null;
  status: string;
  state: BattleState;
  rewards: Rewards | PvpRewards | null;
  turn_deadline: Date | null;
}

export const BATTLE_COLUMNS =
  "b.id::int, b.mode, b.hero_id::int, b.opponent_hero_id::int, b.status, b.state, b.rewards, b.turn_deadline";

/** The side the hero plays in this battle. */
export function sideOf(row: BattleRow, heroId: number): Side {
  return row.mode === "pvp" && row.opponent_hero_id === heroId ? "bot" : "player";
}

/** Whether the hero is in any unfinished battle (bot or PvP, either side). */
export async function heroInBattle(db: Db, heroId: number): Promise<boolean> {
  const { rowCount } = await db.query(
    "SELECT 1 FROM battles WHERE status = 'active' AND (hero_id = $1 OR opponent_hero_id = $1)",
    [heroId],
  );
  return Boolean(rowCount);
}

export async function openChallengeOf(db: Db, heroId: number): Promise<number | null> {
  const { rows } = await db.query<{ id: number }>(
    "SELECT id::int FROM battle_challenges WHERE hero_id = $1 AND status = 'open' AND expires_at > now()",
    [heroId],
  );
  return rows[0]?.id ?? null;
}

async function userIdsOf(db: Db, heroIds: number[]): Promise<number[]> {
  const { rows } = await db.query<{ user_id: number }>("SELECT user_id::int FROM heroes WHERE id = ANY($1)", [heroIds]);
  return rows.map((r) => r.user_id);
}

/** Tells both players' tabs that their battle changed, so they refetch it. */
export async function notifyBattle(row: BattleRow) {
  if (row.mode !== "pvp") return;
  try {
    for (const userId of await userIdsOf(pool, [row.hero_id, row.opponent_hero_id!])) {
      sendToUser(userId, { type: "battle", battleId: row.id });
    }
  } catch (err) {
    console.error("battle notify failed", err);
  }
}

export function challengesChanged() {
  broadcastEvent({ type: "challenges" });
}

// ---------------------------------------------------------------- challenges

export interface ChallengeView {
  id: number;
  heroName: string;
  level: number;
  mode: string;
  /** Overall class name of the hero (placeholder names until the owner approves them). */
  className: string;
  createdAt: string;
  expiresAt: string;
  mine: boolean;
}

export async function listChallenges(viewerHeroId: number): Promise<ChallengeView[]> {
  const { rows } = await pool.query(
    `SELECT c.id::int, h.name AS "heroName", c.level, c.mode, h.build,
            c.created_at AS "createdAt", c.expires_at AS "expiresAt", c.hero_id::int AS "heroId"
       FROM battle_challenges c JOIN heroes h ON h.id = c.hero_id
      WHERE c.status = 'open' AND c.expires_at > now()
      ORDER BY c.created_at DESC
      LIMIT 200`,
  );
  return rows.map((r) => {
    return {
      id: r.id,
      heroName: r.heroName,
      level: r.level,
      mode: r.mode,
      className: overallClass(parseBuild(r.build)).name,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      mine: r.heroId === viewerHeroId,
    };
  });
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function createChallenge(userId: number): Promise<number> {
  const created = await withTransaction(async (client) => {
    // Locking the hero row serializes this with starting a bot battle and joining challenges.
    const hero = await getHeroByUser(userId, client, true);
    if (!hero) throw new PvpError("Герой не найден", 404);
    if (!hero.build.classes.length) throw new PvpError("Сначала выберите класс");
    if (await heroInBattle(client, hero.id)) throw new PvpError("Вы уже в бою", 409);
    if (await openChallengeOf(client, hero.id)) throw new PvpError("У вас уже есть заявка", 409);
    await expireOld(client);
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO battle_challenges (hero_id, level, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3)) RETURNING id::int`,
      [hero.id, hero.level, PVP_RULES.challengeLifetimeMinutes],
    );
    return { id: rows[0].id, name: hero.name, level: hero.level };
  });
  challengesChanged();
  void postSystemMessage(`${created.name} [${created.level}] ищет соперника для PvP 1×1`);
  return created.id;
}

export async function cancelChallenge(userId: number, challengeId: number): Promise<void> {
  await withTransaction(async (client) => {
    const hero = await getHeroByUser(userId, client, true);
    const { rows } = await client.query<{ hero_id: number; status: string; expired: boolean }>(
      `SELECT hero_id::int, status, expires_at <= now() AS expired FROM battle_challenges WHERE id = $1 FOR UPDATE`,
      [challengeId],
    );
    const c = rows[0];
    if (!hero || !c || c.hero_id !== hero.id) throw new PvpError("Заявка не найдена", 404);
    if (c.status === "started") throw new PvpError("Соперник уже вступил, бой начался", 409);
    if (c.status !== "open" || c.expired) throw new PvpError("Заявка уже закрыта", 409);
    await client.query("UPDATE battle_challenges SET status = 'cancelled', closed_at = now() WHERE id = $1", [challengeId]);
  });
  challengesChanged();
}

/** Joins a challenge and starts the battle. Returns the battle id. */
export async function joinChallenge(userId: number, challengeId: number): Promise<number> {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query<{ hero_id: number; level: number; status: string; expired: boolean }>(
      `SELECT hero_id::int, level, status, expires_at <= now() AS expired FROM battle_challenges WHERE id = $1 FOR UPDATE`,
      [challengeId],
    );
    const c = rows[0];
    if (!c || c.status !== "open" || c.expired) throw new PvpError("Заявка уже закрыта", 409);

    const joiner = await getHeroByUser(userId, client, false);
    if (!joiner) throw new PvpError("Герой не найден", 404);
    if (joiner.id === c.hero_id) throw new PvpError("Нельзя вступить в свою заявку");
    // Lock both heroes in id order so two joins can never deadlock.
    const [first, second] = [joiner.id, c.hero_id].sort((a, b) => a - b);
    await client.query("SELECT id FROM heroes WHERE id = ANY($1) ORDER BY id FOR UPDATE", [[first, second]]);
    // Re-read after locking: levels or builds may have changed meanwhile.
    const me = (await getHeroById(joiner.id, client))!;
    const creator = await getHeroById(c.hero_id, client);
    if (!creator) throw new PvpError("Заявка уже закрыта", 409);

    if (me.level !== c.level || creator.level !== c.level) {
      throw new PvpError(`Вступить могут только герои ${c.level} уровня`);
    }
    if (await heroInBattle(client, me.id)) throw new PvpError("Вы уже в бою", 409);
    if (await heroInBattle(client, creator.id)) throw new PvpError("Создатель заявки сейчас в бою", 409);

    const meStats = fighterOf(me);
    const creatorStats = fighterOf(creator);
    if (!meStats) throw new PvpError("Сначала выберите класс");
    if (!creatorStats) throw new PvpError("У создателя заявки нет класса", 409);

    // Your own open challenge is closed when you join someone else's.
    await client.query(
      "UPDATE battle_challenges SET status = 'cancelled', closed_at = now() WHERE hero_id = $1 AND status = 'open'",
      [me.id],
    );
    const state = createBattle(creatorStats, meStats, Math.random, "pvp");
    const { rows: battleRows } = await client.query<{ id: number }>(
      `INSERT INTO battles (hero_id, opponent_hero_id, mode, state, turn_deadline)
       VALUES ($1, $2, 'pvp', $3, now() + make_interval(secs => $4)) RETURNING id::int`,
      [creator.id, me.id, state, PVP_RULES.turnSeconds],
    );
    const battleId = battleRows[0].id;
    await client.query(
      `UPDATE battle_challenges SET status = 'started', opponent_hero_id = $2, battle_id = $3, closed_at = now()
        WHERE id = $1`,
      [challengeId, me.id, battleId],
    );
    const [creatorUserId] = await userIdsOf(client, [creator.id]);
    return { battleId, creatorUserId };
  });
  challengesChanged();
  sendToUser(result.creatorUserId, { type: "battle-start", battleId: result.battleId });
  return result.battleId;
}

function fighterOf(hero: HeroRow) {
  if (!hero.build.classes.length) return null;
  return { name: hero.name, level: hero.level, profile: combatProfile(hero.level, hero.build) };
}

async function expireOld(db: Db): Promise<number> {
  const { rowCount } = await db.query(
    "UPDATE battle_challenges SET status = 'expired', closed_at = now() WHERE status = 'open' AND expires_at <= now()",
  );
  return rowCount ?? 0;
}

// ---------------------------------------------------------------- PvP battle flow

/** XP for both heroes and PvP win/loss counters. */
export async function grantPvpRewards(client: PoolClient, row: BattleRow): Promise<PvpRewards> {
  const state = row.state;
  const winnerSide: Side = state.status === "won" ? "player" : "bot";
  const byHero: Record<string, Rewards> = {};
  for (const side of ["player", "bot"] as Side[]) {
    const heroId = side === "player" ? row.hero_id : row.opponent_hero_id!;
    const hero = await getHeroById(heroId, client, true);
    if (!hero) continue;
    const won = side === winnerSide;
    const experience = Math.round((won ? 30 + 10 * state.units[other(side)].level : 10) * PVP_RULES.experienceMultiplier);
    const levelsGained = await grantHeroBattleResult(client, hero, won, experience, "pvp");
    byHero[heroId] = { experience, levelsGained };
  }
  return { byHero };
}

/** Saves a PvP battle after a change: rewards on finish, a fresh turn timer when a new turn started. */
export async function savePvp(client: PoolClient, row: BattleRow, newTurn: boolean) {
  if (row.state.status !== "active") {
    row.rewards = await grantPvpRewards(client, row);
    row.turn_deadline = null;
  } else if (newTurn || !row.turn_deadline) {
    row.turn_deadline = new Date(Date.now() + PVP_RULES.turnSeconds * 1000);
  }
  row.status = row.state.status;
  await client.query(
    `UPDATE battles SET state = $2, status = $3, rewards = $4, turn_deadline = $5, updated_at = now(),
            finished_at = CASE WHEN $3 = 'active' THEN NULL ELSE now() END
      WHERE id = $1`,
    [row.id, row.state, row.status, row.rewards, row.turn_deadline],
  );
}

export function announcePvpResult(row: BattleRow) {
  const { player, bot } = row.state.units;
  const [winner, loser] = row.state.status === "won" ? [player, bot] : [bot, player];
  void postSystemMessage(`${winner.name} победил ${loser.name} (PvP 1×1)`);
}

/**
 * If the current turn's time is up, ends it automatically (once).
 * Expects the battle row locked FOR UPDATE inside `client`'s transaction. Returns true if it changed.
 */
export async function applyTimeout(client: PoolClient, row: BattleRow, events: BattleEvent[] = []): Promise<boolean> {
  if (row.mode !== "pvp" || row.state.status !== "active" || !row.turn_deadline) return false;
  if (row.turn_deadline.getTime() > Date.now()) return false;
  events.push(...timeoutTurn(row.state));
  // The next turn always gets the full time, even if the server was asleep for a while.
  await savePvp(client, row, true);
  return true;
}

/** Background job: ends timed-out PvP turns and removes expired challenges. */
export async function sweep(): Promise<void> {
  const expired = await expireOld(pool);
  if (expired) challengesChanged();

  const { rows } = await pool.query<{ id: number }>(
    "SELECT id::int FROM battles WHERE status = 'active' AND mode = 'pvp' AND turn_deadline <= now() LIMIT 50",
  );
  for (const { id } of rows) {
    let changed: BattleRow | null = null;
    await withTransaction(async (client) => {
      const { rows: locked } = await client.query<BattleRow>(
        `SELECT ${BATTLE_COLUMNS} FROM battles b WHERE b.id = $1 FOR UPDATE SKIP LOCKED`,
        [id],
      );
      if (locked[0] && (await applyTimeout(client, locked[0]))) changed = locked[0];
    });
    if (changed) {
      const row = changed as BattleRow;
      void notifyBattle(row);
      if (row.state.status !== "active") announcePvpResult(row);
    }
  }
}

export function startPvpSweeper(intervalMs = 2000) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await sweep();
    } catch (err) {
      console.error("pvp sweep failed", err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return timer;
}
