import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import {
  availableSkills,
  classPoints,
  classSlots,
  combatProfile,
  statSources,
  overallClass,
  parseBuild,
  relicFor,
  talentSlots,
  xpForNextLevel,
  type HeroBuild,
} from "../game/build.js";
import { addGuildPoints, GUILDS, guildStatBonus, parseGuilds, pendingPicks, pointsForNextGuildLevel, GUILD_RULES, type GuildId, type GuildProgress } from "../game/guilds.js";
import { armyCost, factionHeroOf, heroClasses, leadership, MAX_ARMY_STACKS, parseArmy, type ArmyStack } from "../game/factions.js";

/**
 * Classes come from the chosen faction hero and the level (see heroClasses), not from the player.
 * A hero without a faction hero has no classes yet and has to pick one first.
 */
export function withHeroClasses(hero: HeroRow): HeroRow {
  const factionHero = factionHeroOf({ faction: hero.faction, heroId: hero.faction_hero });
  const classes = factionHero ? heroClasses({ hero: factionHero, level: hero.level }) : [];
  return { ...hero, build: { ...hero.build, classes } };
}

/** The name shown next to the hero: the faction hero (Паладин, Некромант…), or the class for old data. */
export function heroTitle({ faction, factionHero, build }: { faction: string | null; factionHero: string | null; build: HeroBuild }): string {
  return factionHeroOf({ faction, heroId: factionHero })?.name ?? overallClass(build).name;
}

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
  guilds: GuildProgress[];
}

const GUILDS_JSON = `COALESCE((SELECT json_agg(json_build_object('guildId', g.guild_id, 'level', g.level, 'points', g.points, 'picks', g.picks))
    FROM hero_guilds g WHERE g.hero_id = heroes.id), '[]'::json) AS guilds`;

function toHero(hero: HeroRow | undefined): HeroRow | undefined {
  return hero ? withHeroClasses({ ...hero, build: parseBuild(hero.build), army: parseArmy(hero.army), guilds: parseGuilds(hero.guilds) }) : undefined;
}

/** Battle profile of a hero: level, classes and guild bonuses. */
export const heroProfile = (hero: Pick<HeroRow, "level" | "build" | "guilds">) =>
  combatProfile(hero.level, hero.build, guildStatBonus(hero.guilds ?? []));

export async function getHeroByUser(userId: number, db: Db = pool, forUpdate = false): Promise<HeroRow | undefined> {
  const { rows } = await db.query<HeroRow>(
    `SELECT id::int, name, level, experience, wins, losses, bot_wins, bot_losses, build, faction, faction_hero, army, ${GUILDS_JSON}
       FROM heroes WHERE user_id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [userId],
  );
  return toHero(rows[0]);
}

export async function getHeroById(heroId: number, db: Db = pool, forUpdate = false): Promise<HeroRow | undefined> {
  const { rows } = await db.query<HeroRow>(
    `SELECT id::int, name, level, experience, wins, losses, bot_wins, bot_losses, build, faction, faction_hero, army, ${GUILDS_JSON}
       FROM heroes WHERE id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [heroId],
  );
  return toHero(rows[0]);
}

/** Everything the hero page shows: progress, build, derived stats, relic. */
export function heroView(row: HeroRow) {
  const hero = withHeroClasses(row);
  const b = hero.build;
  const hasClass = b.classes.length > 0;
  const profile = hasClass ? heroProfile(hero) : null;
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
    className: heroTitle({ faction: hero.faction, factionHero: hero.faction_hero, build: b }),
    limits: {
      classPoints: classPoints(hero.level),
      classPointsUsed: b.classes.reduce((sum, c) => sum + c.rank, 0),
      classSlots: classSlots(hero.level),
      talentSlots: talentSlots(hero.level),
      skillSlots: profile?.skillSlots ?? 0,
    },
    profile,
    statSources: hasClass ? statSources(hero.level, b, guildStatBonus(hero.guilds ?? [])) : null,
    availableSkills: availableSkills(b).map((s) => s.id),
    relic: hasClass ? relicFor(b).view : null,
    faction: hero.faction,
    factionHero: hero.faction_hero,
    army: hero.army,
    guilds: guildsView(hero.guilds ?? []),
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

/** Every guild with the hero's level and points in it. */
export function guildsView(progress: GuildProgress[]) {
  return GUILDS.map((def) => {
    const g = progress.find((p) => p.guildId === def.id) ?? { guildId: def.id, level: 0, points: 0, picks: [] };
    return {
      id: def.id,
      level: g.level,
      points: g.points,
      pointsToNext: g.level >= GUILD_RULES.maxLevel ? null : pointsForNextGuildLevel(g.level),
      picks: g.picks,
      pendingPicks: pendingPicks(g),
    };
  });
}

/** Adds guild points (creates the row on first points). Returns guild levels gained. */
export async function grantGuildPoints(db: Db, hero: HeroRow, guildId: GuildId, points: number): Promise<number> {
  const current = hero.guilds?.find((g) => g.guildId === guildId) ?? { level: 0, points: 0 };
  const next = addGuildPoints(current, points);
  await db.query(
    `INSERT INTO hero_guilds (hero_id, guild_id, level, points) VALUES ($1, $2, $3, $4)
     ON CONFLICT (hero_id, guild_id) DO UPDATE SET level = EXCLUDED.level, points = EXCLUDED.points`,
    [hero.id, guildId, next.level, next.points],
  );
  return next.gained;
}
