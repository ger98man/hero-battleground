import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { ARTIFACTS, getArtifact } from "../game/artifacts.js";
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
  equipped_artifact: string | null;
}

export async function getHeroByUser(userId: number, db: Db = pool, forUpdate = false): Promise<HeroRow | undefined> {
  const { rows } = await db.query<HeroRow>(
    `SELECT id::int, name, level, experience, health, attack, defense, speed, wins, losses, equipped_artifact
       FROM heroes WHERE user_id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [userId],
  );
  return rows[0];
}

export async function ownedArtifactIds(heroId: number, db: Db = pool): Promise<string[]> {
  const { rows } = await db.query<{ artifact_id: string }>(
    "SELECT artifact_id FROM hero_artifacts WHERE hero_id = $1 ORDER BY acquired_at",
    [heroId],
  );
  return rows.map((r) => r.artifact_id).filter((id) => getArtifact(id));
}

/** Public catalog entry with ownership flags, for the artifact menu. */
export function artifactView(id: string, owned: Set<string>, equipped: string | null) {
  const a = getArtifact(id)!;
  return { ...a, owned: owned.has(id), equipped: equipped === id };
}

export function catalogView(owned: string[], equipped: string | null) {
  const set = new Set(owned);
  return ARTIFACTS.map((a) => artifactView(a.id, set, equipped));
}

export function heroCombatStats(hero: HeroRow) {
  const artifact = getArtifact(hero.equipped_artifact);
  return artifact ? combatStats(hero, artifact) : null;
}

/** Adds XP, applying level-ups. Returns how many levels were gained. */
export async function grantBattleResult(db: Db, hero: HeroRow, won: boolean, xp: number): Promise<number> {
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
            wins = wins + $8, losses = losses + $9
      WHERE id = $1`,
    [
      hero.id, level, experience,
      LEVEL_GAINS.health * gained, LEVEL_GAINS.attack * gained, LEVEL_GAINS.defense * gained, LEVEL_GAINS.speed * gained,
      won ? 1 : 0, won ? 0 : 1,
    ],
  );
  return gained;
}
