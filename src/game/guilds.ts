/**
 * Guilds (design of 24.11.2026): six lines of activity, each with its own level.
 * A guild level grows from guild points earned by that guild's activity and raises a stat
 * (or, later, opens spells, the black market, arena rewards).
 *
 * Names come from the game owner's design doc. All numbers are placeholders until balancing.
 */
import type { StatKey, Stats } from "./classes.js";

export enum GuildId {
  Syndicate = "syndicate",
  Craftsmen = "craftsmen",
  Arena = "arena",
  Mages = "mages",
  Mercenaries = "mercenaries",
  Bounty = "bounty",
}

/** "live": the guild already earns points in the game. "planned": its activity is not built yet. */
export type GuildStatus = "live" | "planned";

export interface GuildDef {
  id: GuildId;
  name: string;
  icon: string;
  kind: string;
  description: string;
  /** What earns guild points. */
  activity: string;
  /** What a guild level gives. */
  reward: string;
  /** Stat added per guild level, if the guild raises a fixed stat. */
  statPerLevel?: Partial<Stats>;
  /** The player picks one of these stats on every guild level (Союз Наёмников). */
  statChoice?: StatKey[];
  status: GuildStatus;
}

export const GUILD_RULES = {
  maxLevel: 10,
  /** Points from level L to L+1: pointsBase × (L + 1). */
  pointsBase: 10,
  /** Stat gained per guild level (fixed stat or the player's pick). */
  statPerLevel: 1,
  /** Points for a battle: win / loss. Bot battles feed Союз Наёмников, PvP feeds Арена. */
  winPoints: 3,
  lossPoints: 1,
} as const;

export const MERCENARY_CHOICES: StatKey[] = ["strength", "dexterity", "intellect"];

export const GUILDS: readonly GuildDef[] = [
  {
    id: GuildId.Syndicate,
    name: "Преступный синдикат",
    icon: "🗡️",
    kind: "PvP, грабежи игроков",
    description: "Нападения на базы других игроков ради их золота. Доступ к Чёрному рынку.",
    activity: "Победы в налётах на базы игроков",
    reward: "Инициатива, золото жертвы, Чёрный рынок",
    statPerLevel: { initiative: GUILD_RULES.statPerLevel },
    status: "planned",
  },
  {
    id: GuildId.Craftsmen,
    name: "Гильдия ремесленников",
    icon: "⚒️",
    kind: "Экономика, торговля, производство",
    description: "Основа экономики: покупка, продажа, изготовление и починка предметов.",
    activity: "Покупка, продажа, изготовление и починка предметов",
    reward: "Ремесло",
    statPerLevel: { craft: GUILD_RULES.statPerLevel },
    status: "planned",
  },
  {
    id: GuildId.Arena,
    name: "Арена",
    icon: "🏟️",
    kind: "Соревновательное PvP 1×1, 2×2, 3×3",
    description: "Организованные бои игроков. Каждый игрок ведёт одного героя и свою армию.",
    activity: "Бои на Арене (пока 1×1)",
    reward: "Будет определено (рейтинг и награды позже)",
    status: "live",
  },
  {
    id: GuildId.Mages,
    name: "Консорциум магов",
    icon: "🔮",
    kind: "PvE, тактические головоломки",
    description: "Боевые испытания-головоломки, где побеждает верное тактическое решение, а не характеристики.",
    activity: "Прохождение испытаний",
    reward: "Новые заклинания",
    status: "planned",
  },
  {
    id: GuildId.Mercenaries,
    name: "Союз Наёмников",
    icon: "🛡️",
    kind: "PvE против нейтральных противников",
    description: "Боевые задания против армий нейтральных существ под управлением ИИ.",
    activity: "Бои против ИИ (пока бои с ботом)",
    reward: "Сила, Ловкость или Интеллект на выбор за каждый уровень",
    statChoice: MERCENARY_CHOICES,
    status: "live",
  },
  {
    id: GuildId.Bounty,
    name: "Охота за головами",
    icon: "🎯",
    kind: "PvP против преступников",
    description: "Поручения шерифа: нападение на базы разыскиваемых преступников за награду.",
    activity: "Победы над преступниками из списка розыска",
    reward: "Инициатива, награды за розыск",
    statPerLevel: { initiative: GUILD_RULES.statPerLevel },
    status: "planned",
  },
];

const guildById = new Map(GUILDS.map((g) => [g.id as string, g]));
export const getGuild = (id: string) => guildById.get(id);

/** A hero's progress in one guild. `picks` holds the stat chosen for each level (Союз Наёмников). */
export interface GuildProgress {
  guildId: string;
  level: number;
  points: number;
  picks: StatKey[];
}

export const pointsForNextGuildLevel = (level: number) => GUILD_RULES.pointsBase * (level + 1);

/** Adds points and returns the new level/points (levels above max keep no extra points). */
export function addGuildPoints(progress: Pick<GuildProgress, "level" | "points">, add: number): { level: number; points: number; gained: number } {
  let { level, points } = progress;
  points += Math.max(0, add);
  let gained = 0;
  while (level < GUILD_RULES.maxLevel && points >= pointsForNextGuildLevel(level)) {
    points -= pointsForNextGuildLevel(level);
    level += 1;
    gained += 1;
  }
  if (level >= GUILD_RULES.maxLevel) points = 0;
  return { level, points, gained };
}

/** Normalizes untrusted rows (from the DB) into progress records for known guilds. */
export function parseGuilds(raw: unknown): GuildProgress[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const def = getGuild(String(o.guildId ?? ""));
    if (!def) return [];
    const level = Math.max(0, Math.min(GUILD_RULES.maxLevel, Math.floor(Number(o.level) || 0)));
    const picks = (Array.isArray(o.picks) ? o.picks : []).map(String).filter((s): s is StatKey => (def.statChoice ?? []).includes(s as StatKey)).slice(0, level);
    return [{ guildId: def.id, level, points: Math.max(0, Math.floor(Number(o.points) || 0)), picks }];
  });
}

/** Stats added by all guild levels. */
export function guildStatBonus(guilds: GuildProgress[]): Partial<Stats> {
  const out: Partial<Stats> = {};
  const add = (k: StatKey, v: number) => (out[k] = (out[k] ?? 0) + v);
  for (const g of guilds) {
    const def = getGuild(g.guildId);
    if (!def) continue;
    for (const [k, v] of Object.entries(def.statPerLevel ?? {}) as [StatKey, number][]) add(k, v * g.level);
    for (const pick of g.picks) add(pick, GUILD_RULES.statPerLevel);
  }
  return out;
}

/** Levels of a stat-choice guild that still wait for the player's pick. */
export const pendingPicks = (g: GuildProgress) => (getGuild(g.guildId)?.statChoice ? Math.max(0, g.level - g.picks.length) : 0);
