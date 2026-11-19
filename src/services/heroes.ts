import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import {
  availableSkills,
  classPoints,
  classSlots,
  combatProfile,
  overallClass,
  parseBuild,
  relicFor,
  talentSlots,
  xpForNextLevel,
  type HeroBuild,
} from "../game/build.js";

type Db = Pick<PoolClient, "query">;

export interface HeroRow {
  id: number;
  name: string;
  level: number;
  experience: number;
  wins: number;
  losses: number;
  bot_wins: number;
  bot_losses: number;
  build: HeroBuild;
}

export async function getHeroByUser(userId: number, db: Db = pool, forUpdate = false): Promise<HeroRow | undefined> {
  const { rows } = await db.query<HeroRow>(
    `SELECT id::int, name, level, experience, wins, losses, bot_wins, bot_losses, build
       FROM heroes WHERE user_id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [userId],
  );
  const hero = rows[0];
  if (hero) hero.build = parseBuild(hero.build);
  return hero;
}

/** Everything the hero page shows: progress, build, derived stats, relic. */
export function heroView(hero: HeroRow) {
  const b = hero.build;
  const hasClass = b.classes.length > 0;
  const profile = hasClass ? combatProfile(hero.level, b) : null;
  return {
    id: hero.id,
    name: hero.name,
    level: hero.level,
    experience: hero.experience,
    experienceToNext: xpForNextLevel(hero.level),
    wins: hero.wins,
    losses: hero.losses,
    botWins: hero.bot_wins,
    botLosses: hero.bot_losses,
    build: b,
    needsClass: !hasClass,
    className: overallClass(b).name,
    limits: {
      classPoints: classPoints(hero.level),
      classPointsUsed: b.classes.reduce((sum, c) => sum + c.rank, 0),
      classSlots: classSlots(hero.level),
      talentSlots: talentSlots(hero.level),
      skillSlots: profile?.skillSlots ?? 0,
    },
    profile,
    availableSkills: availableSkills(b).map((s) => s.id),
    relic: hasClass ? relicFor(b).view : null,
  };
}

/** Hero XP with level-ups and bot win/loss counters. Returns levels gained. */
export async function grantHeroBattleResult(db: Db, hero: HeroRow, won: boolean, xp: number): Promise<number> {
  let level = hero.level;
  let experience = hero.experience + xp;
  let gained = 0;
  while (experience >= xpForNextLevel(level)) {
    experience -= xpForNextLevel(level);
    level += 1;
    gained += 1;
  }
  await db.query(
    `UPDATE heroes SET level = $2, experience = $3, bot_wins = bot_wins + $4, bot_losses = bot_losses + $5 WHERE id = $1`,
    [hero.id, level, experience, won ? 1 : 0, won ? 0 : 1],
  );
  return gained;
}
