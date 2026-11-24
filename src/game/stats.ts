/**
 * Characteristics system v2 (design of 24.11.2026): seven stats and how they meet in combat.
 *
 * Сила — damage + parry. Ловкость — damage + dodge. Интеллект — mana (and spell damage).
 * Мастерство — beats parry and dodge, raises the chance of special effects.
 * Инициатива — turn order. Здоровье — hit points. Ремесло — crafting (economy, later).
 *
 * EVERY NUMBER HERE IS A PLACEHOLDER until the balance pass. Keep all coefficients in
 * STAT_RULES so balancing touches one place.
 */
import type { StatKey } from "./classes.js";

export const STAT_RULES = {
  /** Base value of Сила, Ловкость, Интеллект, Инициатива and Здоровье at level 1. */
  base: 10,
  /** Hit points: hpBase + hpPerHealth × Здоровье. */
  hpBase: 40,
  hpPerHealth: 6,
  /** Mana: manaBase + manaPerIntellect × Интеллект. */
  manaBase: 40,
  manaPerIntellect: 4,
  /** Parry chance per point of Сила above base. */
  parryPerStrength: 0.01,
  /** Dodge chance per point of Ловкость above base. */
  dodgePerDexterity: 0.01,
  /** Parry and dodge never go above this (before the attacker's Мастерство). */
  defenseCap: 0.25,
  /** Each point of the attacker's Мастерство takes this much off the defender's parry and off dodge. */
  masteryVsDefense: 0.01,
  /** Each point of Мастерство adds this much to the chance of special effects. */
  procPerMastery: 0.01,
  /** Army units gain this much damage per point of the hero's matching stat above base. */
  unitDamagePerStat: 0.01,
} as const;

/** The stat an army unit is built on. Its damage grows with the hero's value of that stat. */
export type UnitAttribute = "strength" | "dexterity" | "intellect";

export const UNIT_ATTRIBUTE_NAMES: Record<UnitAttribute, string> = {
  strength: "Сила",
  dexterity: "Ловкость",
  intellect: "Интеллект",
};

const over = (v: number) => Math.max(0, v - STAT_RULES.base);

export const maxHpFor = (health: number) => STAT_RULES.hpBase + STAT_RULES.hpPerHealth * health;
export const maxManaFor = (intellect: number) => STAT_RULES.manaBase + STAT_RULES.manaPerIntellect * intellect;
export const parryFor = (strength: number) => Math.min(STAT_RULES.defenseCap, over(strength) * STAT_RULES.parryPerStrength);
export const dodgeFor = (dexterity: number) => Math.min(STAT_RULES.defenseCap, over(dexterity) * STAT_RULES.dodgePerDexterity);

/** The defender's parry or dodge chance after the attacker's Мастерство. */
export const effectiveDefense = (chance: number, attackerMastery: number) =>
  Math.max(0, chance - Math.max(0, attackerMastery) * STAT_RULES.masteryVsDefense);

/** Extra chance of special effects of attacks and abilities (no random effects in the game yet). */
export const procBonusFor = (mastery: number) => Math.max(0, mastery) * STAT_RULES.procPerMastery;

/** Damage multiplier for the hero's army units built on `attribute`. */
export const unitDamageMultiplier = (stats: Pick<Record<StatKey, number>, UnitAttribute>, attribute: UnitAttribute) =>
  1 + over(stats[attribute]) * STAT_RULES.unitDamagePerStat;
