import { artifactBonuses, type Artifact } from "./artifacts.js";

/** Base hero stats as stored in the `heroes` table. */
export interface HeroBaseStats {
  level: number;
  health: number;
  attack: number;
  defense: number;
  speed: number;
}

/** Stats used in battle: base stats + artifact bonuses. */
export interface CombatStats {
  maxHp: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  moveRange: number;
}

export const BASE_MANA = 100;
export const MANA_REGEN_PER_TURN = 10;

/** Stat gains per hero level. Applied on level-up and used to build bots. */
export const LEVEL_GAINS = { health: 10, attack: 2, defense: 1, speed: 1 } as const;

/** XP needed to go from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return 100 * level;
}

export function baseStatsForLevel(level: number): HeroBaseStats {
  const n = level - 1;
  return {
    level,
    health: 100 + LEVEL_GAINS.health * n,
    attack: 10 + LEVEL_GAINS.attack * n,
    defense: 5 + LEVEL_GAINS.defense * n,
    speed: 5 + LEVEL_GAINS.speed * n,
  };
}

export function combatStats(base: HeroBaseStats, artifact: Artifact, artifactLevel = 1): CombatStats {
  const b = artifactBonuses(artifact, artifactLevel);
  const speed = base.speed + b.speed;
  return {
    maxHp: base.health + b.health,
    maxMana: BASE_MANA + b.mana,
    attack: base.attack + b.attack,
    defense: base.defense + b.defense,
    speed,
    // Every 10 speed gives +1 cell of movement.
    moveRange: artifact.moveRange + Math.floor(speed / 10),
  };
}
