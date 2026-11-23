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
import { armyCost, leadership, MAX_ARMY_STACKS, parseArmy, type ArmyStack } from "../game/factions.js";

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
  faction: string | null;
  faction_hero: string | null;
  army: ArmyStack[];
}

export async function getHeroByUser(userId: number, db: Db = pool, forUpdate = false): Promise<HeroRow | undefined> {
  const { rows } = await db.query<HeroRow>(
    `SELECT id::int, name, level, experience, wins, losses, bot_wins, bot_losses, build, faction, faction_hero, army
       FROM heroes WHERE user_id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [userId],
  );
  const hero = rows[0];
  if (hero) {
    hero.build = parseBuild(hero.build);
    hero.army = parseArmy(hero.army);
  }
  return hero;
}

export async function getHeroById(heroId: number, db: Db = pool, forUpdate = false): Promise<HeroRow | undefined> {
  const { rows } = await db.query<HeroRow>(
    `SELECT id::int, name, level, experience, wins, losses, bot_wins, bot_losses, build, faction, faction_hero, army
       FROM heroes WHERE id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [heroId],
  );
  const hero = rows[0];
  if (hero) {
    hero.build = parseBuild(hero.build);
    hero.army = parseArmy(hero.army);
  }
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
    faction: hero.faction,
    factionHero: hero.faction_hero,
    army: hero.army,
    armyLimits: { leadership: leadership(hero.level), used: armyCost(hero.army), maxStacks: MAX_ARMY_STACKS },
  };
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
    `UPDATE heroes SET level = $2, experience = $3, ${winsCol} = ${winsCol} + $4, ${lossesCol} = ${lossesCol} + $5
      WHERE id = $1`,
    [hero.id, level, experience, won ? 1 : 0, won ? 0 : 1],
  );
  return gained;
}
