/**
 * Hero build: chosen classes (with rank and specialization), talents and skill loadout.
 * Validation against the hero level, and everything derived from it: stats, armor,
 * overall class name, available skills, relic and passive modifiers.
 */
import {
  ALL_SKILLS,
  BASE_SKILL_SLOTS,
  getClass,
  getHybrid,
  getTalent,
  MASTERY_PER_SLOT,
  MAX_CLASS_RANK,
  MAX_CLASSES,
  MAX_SKILL_SLOTS,
  TALENT_EVERY,
  type PassiveMods,
  type Skill,
  type StatKey,
  type Stats,
} from "./classes.js";

export interface BuildClass {
  id: string;
  rank: number;
  spec: string;
}

export interface HeroBuild {
  classes: BuildClass[];
  talents: string[];
  /** Chosen skill ids for the battle slots (basic attack is always available). */
  loadout: string[];
}

export const emptyBuild = (): HeroBuild => ({ classes: [], talents: [], loadout: [] });

/** Class ranks available: 1 at level 1, +1 every 3rd level. */
export const classPoints = (level: number) => 1 + Math.floor(level / 3);
/** How many different classes the hero may have: +1 every 6th level, max 3. */
export const classSlots = (level: number) => Math.min(MAX_CLASSES, 1 + Math.floor(level / 6));
export const talentSlots = (level: number) => Math.floor(level / TALENT_EVERY);

/** Normalizes untrusted input into a HeroBuild shape (does not check game rules). */
export function parseBuild(raw: unknown): HeroBuild {
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    classes: arr(r.classes).slice(0, 10).map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return { id: String(o.id ?? ""), rank: Number(o.rank) || 0, spec: String(o.spec ?? "") };
    }),
    talents: arr(r.talents).slice(0, 20).map(String),
    loadout: arr(r.loadout).slice(0, 20).map(String),
  };
}

/** Returns an error message, or null if the build is legal for this level. */
export function validateBuild(build: HeroBuild, level: number): string | null {
  const { classes, talents } = build;
  if (classes.length === 0) return "Выберите класс";
  if (classes.length > classSlots(level)) return `На ${level} уровне можно иметь классов: ${classSlots(level)}`;
  const seen = new Set<string>();
  let ranks = 0;
  for (const c of classes) {
    const def = getClass(c.id);
    if (!def) return "Неизвестный класс";
    if (!def.playable) return `Класс «${def.name}» пока недоступен`;
    if (seen.has(c.id)) return "Класс выбран дважды";
    seen.add(c.id);
    if (!Number.isInteger(c.rank) || c.rank < 1 || c.rank > MAX_CLASS_RANK) return `Ранг класса: от 1 до ${MAX_CLASS_RANK}`;
    if (!def.specs.some((s) => s.id === c.spec)) return `Выберите специализацию для класса «${def.name}»`;
    ranks += c.rank;
  }
  if (ranks > classPoints(level)) return `Очков классов: ${classPoints(level)}, распределено: ${ranks}`;
  if (talents.length > talentSlots(level)) return `Талантов на ${level} уровне: ${talentSlots(level)}`;
  const groups = new Set<string>();
  for (const id of talents) {
    const t = getTalent(id);
    if (!t) return "Неизвестный талант";
    if (talents.indexOf(id) !== talents.lastIndexOf(id)) return "Талант выбран дважды";
    if (t.group) {
      if (groups.has(t.group)) return `«${t.name}» нельзя взять вместе с похожим талантом`;
      groups.add(t.group);
    }
  }
  return null;
}

/** Classes sorted by rank (desc); ties keep the order they were taken in. */
export function rankedClasses(build: HeroBuild): BuildClass[] {
  return build.classes.map((c, i) => ({ c, i })).sort((a, b) => b.c.rank - a.c.rank || a.i - b.i).map((x) => x.c);
}

/** Overall class name: the class itself, or the hybrid of the two highest-ranked classes. */
export function overallClass(build: HeroBuild): { name: string; hybrid: boolean; classIds: string[] } {
  const ranked = rankedClasses(build);
  if (ranked.length === 0) return { name: "Без класса", hybrid: false, classIds: [] };
  if (ranked.length === 1) return { name: getClass(ranked[0].id)?.name ?? ranked[0].id, hybrid: false, classIds: [ranked[0].id] };
  return { name: getHybrid(ranked[0].id, ranked[1].id).name, hybrid: true, classIds: [ranked[0].id, ranked[1].id] };
}

export function heroStats(level: number, build: HeroBuild): Stats {
  const stats: Stats = {
    strength: 10,
    dexterity: 10,
    intellect: 10,
    mastery: 0,
    // Hero level: +1 Стойкость every level, +1 Инициатива every 2nd level.
    initiative: 10 + Math.floor((level - 1) / 2),
    stamina: 10 + (level - 1),
  };
  for (const c of build.classes) {
    const def = getClass(c.id);
    if (!def) continue;
    for (const [k, v] of Object.entries(def.perRank) as [StatKey, number][]) stats[k] += v * c.rank;
  }
  return stats;
}

/** Skills the build can put into slots (without basic attacks). Hybrid skills come first. */
export function availableSkills(build: HeroBuild): Skill[] {
  const out: Skill[] = [];
  const top = overallClass(build);
  if (top.hybrid) out.push(...getHybrid(top.classIds[0], top.classIds[1]).skills);
  for (const c of build.classes) {
    const def = getClass(c.id);
    if (!def) continue;
    for (const s of def.skills) if (c.rank >= s.rank && (!s.spec || s.spec === c.spec)) out.push(s);
  }
  return out;
}

export const skillSlotCount = (stats: Stats) => Math.min(MAX_SKILL_SLOTS, BASE_SKILL_SLOTS + Math.floor(stats.mastery / MASTERY_PER_SLOT));

/** Loadout actually used in battle: valid chosen skills, or the first available ones by default. */
export function effectiveLoadout(build: HeroBuild, stats: Stats): string[] {
  const avail = availableSkills(build).map((s) => s.id);
  const slots = skillSlotCount(stats);
  const chosen = build.loadout.filter((id, i) => avail.includes(id) && build.loadout.indexOf(id) === i);
  return (chosen.length ? chosen : avail).slice(0, slots);
}

export interface RelicView {
  name: string;
  tier: number;
  effect: string;
  nextTiers: string[];
}

/** The hero's relic: one per hero, never lost; its tier-1 effect adapts to the overall class. */
export function relicFor(build: HeroBuild): { view: RelicView; mods: Partial<PassiveMods> } {
  const top = overallClass(build);
  const key = top.classIds.slice().sort().join("+");
  const byClass: Record<string, [string, Partial<PassiveMods>]> = {
    warrior: ["+10% физического урона.", { physicalDamage: 0.1 }],
    mage: ["+10% магического урона.", { magicDamage: 0.1 }],
    monk: ["+20% лечения.", { healing: 0.2 }],
    "monk+warrior": ["Световая метка: 20% нанесённого физического урона восстанавливает вашу физическую броню.", { armorOnHit: 0.2 }],
    "mage+warrior": ["Зачарование: физические удары наносят ещё 25% урона магией.", { magicOnPhysicalHit: 0.25 }],
  };
  const [effect, mods] = byClass[key] ?? ["+5% физического и магического урона.", { physicalDamage: 0.05, magicDamage: 0.05 }];
  return {
    view: {
      name: "Реликвия героя",
      tier: 1,
      effect: `${top.name}: ${effect}`,
      nextTiers: ["Ступень 2 (уровень 10): активная способность — в планах", "Ступень 3 (уровень 20): усиление гибрида — в планах"],
    },
    mods,
  };
}

function addMods(into: PassiveMods, m: Partial<PassiveMods>) {
  for (const [k, v] of Object.entries(m)) {
    if (k === "element") into.element = v as string;
    else (into as unknown as Record<string, number>)[k] += v as number;
  }
}

/** Everything the battle needs to know about a hero. */
export interface CombatProfile {
  className: string;
  stats: Stats;
  maxHp: number;
  maxMana: number;
  physicalArmor: number;
  magicArmor: number;
  moveRange: number;
  /** Extra turn speed from Инициатива, capped at 15%. */
  speedBonus: number;
  dodge: number;
  parry: number;
  basicSkill: string;
  skills: string[];
  skillSlots: number;
  talents: string[];
  mods: PassiveMods;
}

export function combatProfile(level: number, build: HeroBuild): CombatProfile {
  const stats = heroStats(level, build);
  const mods: PassiveMods = { physicalDamage: 0, magicDamage: 0, healing: 0, physicalArmor: 0, magicArmor: 0, armorOnHit: 0, magicOnPhysicalHit: 0 };
  let physArmor = 3 * stats.stamina;
  let magArmor = 2 * stats.stamina + stats.intellect;
  for (const c of build.classes) {
    const def = getClass(c.id);
    if (!def) continue;
    physArmor += def.armorPerRank.physical * c.rank;
    magArmor += def.armorPerRank.magic * c.rank;
    const spec = def.specs.find((s) => s.id === c.spec);
    if (spec) addMods(mods, spec.passive);
  }
  addMods(mods, relicFor(build).mods);
  if (build.talents.includes("thick_skin")) addMods(mods, { physicalArmor: 0.2, magicArmor: 0.2 });
  const over = (v: number) => Math.max(0, v - 10);
  const primary = rankedClasses(build)[0];
  return {
    className: overallClass(build).name,
    stats,
    maxHp: 40 + 6 * stats.stamina,
    maxMana: 40 + 4 * stats.intellect,
    physicalArmor: Math.round(physArmor * (1 + mods.physicalArmor)),
    magicArmor: Math.round(magArmor * (1 + mods.magicArmor)),
    moveRange: 4 + Math.min(2, Math.floor(over(stats.initiative) / 10)),
    speedBonus: Math.min(0.15, over(stats.initiative) * 0.01),
    dodge: Math.min(0.2, over(stats.dexterity) * 0.01),
    parry: Math.min(0.2, over(stats.strength) * 0.01),
    basicSkill: getClass(primary?.id ?? "warrior")!.basic.id,
    skills: effectiveLoadout(build, stats),
    skillSlots: skillSlotCount(stats),
    talents: [...build.talents],
    mods,
  };
}

export const skillById = (id: string) => ALL_SKILLS.get(id);

/** XP needed to go from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return 100 * level;
}
