import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { ARTIFACT_MAX_LEVEL, ARTIFACTS, artifactBonuses, getArtifact, SHARDS_TO_CRAFT } from "../game/artifacts.js";
import { combatStats, LEVEL_GAINS, xpForNextLevel } from "../game/stats.js";

type Db = Pick<PoolClient, "query">;

export interface HeroRow {
  id: number;
  name: string;
  level: number;
  experience: number;
  health: number;
  attack: number;
  defense: number;
  speed: number;
  wins: number;
  losses: number;
  bot_wins: number;
  bot_losses: number;
  equipped_artifact: string | null;
}

export interface OwnedArtifact {
  artifactId: string;
  level: number;
  experience: number;
}

export async function getHeroByUser(userId: number, db: Db = pool, forUpdate = false): Promise<HeroRow | undefined> {
  const { rows } = await db.query<HeroRow>(
    `SELECT id::int, name, level, experience, health, attack, defense, speed, wins, losses,
            bot_wins, bot_losses, equipped_artifact
       FROM heroes WHERE user_id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [userId],
  );
  return rows[0];
}

export async function getHeroById(heroId: number, db: Db = pool, forUpdate = false): Promise<HeroRow | undefined> {
  const { rows } = await db.query<HeroRow>(
    `SELECT id::int, name, level, experience, health, attack, defense, speed, wins, losses,
            bot_wins, bot_losses, equipped_artifact
       FROM heroes WHERE id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [heroId],
  );
  return rows[0];
}

export async function ownedArtifacts(heroId: number, db: Db = pool): Promise<OwnedArtifact[]> {
  const { rows } = await db.query<{ artifact_id: string; level: number; experience: number }>(
    "SELECT artifact_id, level, experience FROM hero_artifacts WHERE hero_id = $1 ORDER BY acquired_at",
    [heroId],
  );
  return rows
    .filter((r) => getArtifact(r.artifact_id))
    .map((r) => ({ artifactId: r.artifact_id, level: r.level, experience: r.experience }));
}

export async function shardCounts(heroId: number, db: Db = pool): Promise<Map<string, number>> {
  const { rows } = await db.query<{ artifact_id: string; amount: number }>(
    "SELECT artifact_id, amount FROM artifact_shards WHERE hero_id = $1",
    [heroId],
  );
  return new Map(rows.map((r) => [r.artifact_id, r.amount]));
}

/** Progress block shown for an owned artifact. */
export function artifactProgress(o: OwnedArtifact) {
  const maxed = o.level >= ARTIFACT_MAX_LEVEL;
  return { level: o.level, experience: o.experience, experienceToNext: maxed ? null : xpForNextLevel(o.level), maxLevel: ARTIFACT_MAX_LEVEL };
}

/** Full catalog with ownership, level and shard info, for the artifact menu. */
export function catalogView(owned: OwnedArtifact[], shards: Map<string, number>, equipped: string | null) {
  const byId = new Map(owned.map((o) => [o.artifactId, o]));
  return ARTIFACTS.map((a) => {
    const o = byId.get(a.id);
    return {
      ...a,
      owned: Boolean(o),
      equipped: equipped === a.id,
      progress: o ? artifactProgress(o) : null,
      currentBonuses: artifactBonuses(a, o?.level ?? 1),
      shards: shards.get(a.id) ?? 0,
      shardsToCraft: SHARDS_TO_CRAFT,
    };
  });
}

export function heroCombatStats(hero: HeroRow, artifactLevel: number) {
  const artifact = getArtifact(hero.equipped_artifact);
  return artifact ? combatStats(hero, artifact, artifactLevel) : null;
}

/** Hero XP with level-ups and win/loss counters (bot or PvP). Returns levels gained. */
export async function grantHeroBattleResult(
  db: Db,
  hero: HeroRow,
  won: boolean,
  xp: number,
  kind: "bot" | "pvp" = "bot",
): Promise<number> {
  const [winsCol, lossesCol] = kind === "pvp" ? ["wins", "losses"] : ["bot_wins", "bot_losses"];
  let level = hero.level;
  let experience = hero.experience + xp;
  let gained = 0;
  while (experience >= xpForNextLevel(level)) {
    experience -= xpForNextLevel(level);
    level += 1;
    gained += 1;
  }
  await db.query(
    `UPDATE heroes SET level = $2, experience = $3,
            health = health + $4, attack = attack + $5, defense = defense + $6, speed = speed + $7,
            ${winsCol} = ${winsCol} + $8, ${lossesCol} = ${lossesCol} + $9
      WHERE id = $1`,
    [
      hero.id, level, experience,
      LEVEL_GAINS.health * gained, LEVEL_GAINS.attack * gained, LEVEL_GAINS.defense * gained, LEVEL_GAINS.speed * gained,
      won ? 1 : 0, won ? 0 : 1,
    ],
  );
  return gained;
}

/** Artifact XP with level-ups (capped at max level). Returns levels gained. */
export async function grantArtifactExperience(db: Db, heroId: number, artifactId: string, xp: number): Promise<number> {
  const { rows } = await db.query<{ level: number; experience: number }>(
    "SELECT level, experience FROM hero_artifacts WHERE hero_id = $1 AND artifact_id = $2 FOR UPDATE",
    [heroId, artifactId],
  );
  if (!rows[0]) return 0;
  let { level, experience } = rows[0];
  let gained = 0;
  if (level < ARTIFACT_MAX_LEVEL) {
    experience += xp;
    while (level < ARTIFACT_MAX_LEVEL && experience >= xpForNextLevel(level)) {
      experience -= xpForNextLevel(level);
      level += 1;
      gained += 1;
    }
    if (level >= ARTIFACT_MAX_LEVEL) experience = 0;
  }
  await db.query("UPDATE hero_artifacts SET level = $3, experience = $4 WHERE hero_id = $1 AND artifact_id = $2", [
    heroId, artifactId, level, experience,
  ]);
  return gained;
}

export async function addShards(db: Db, heroId: number, artifactId: string, amount: number) {
  await db.query(
    `INSERT INTO artifact_shards (hero_id, artifact_id, amount) VALUES ($1, $2, $3)
     ON CONFLICT (hero_id, artifact_id) DO UPDATE SET amount = artifact_shards.amount + EXCLUDED.amount`,
    [heroId, artifactId, amount],
  );
}
