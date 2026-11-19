/**
 * Artifact catalog. An artifact is the hero's class: it gives stat bonuses,
 * a movement range and a set of skills (a "spec", like in WoW).
 * The catalog lives in code; the DB only stores which artifacts a hero owns.
 */

export type SkillEffect =
  /** Damage = power × caster attack, reduced by target defense. */
  | { type: "damage"; power: number }
  /** Heal = power × caster attack. */
  | { type: "heal"; power: number }
  /** Absorbs damage: percent of target max HP, lasts N of the target's turns. */
  | { type: "shield"; percent: number; turns: number }
  /** Damage over time at the start of the target's turn: power × caster attack per tick, ignores defense. */
  | { type: "dot"; name: string; power: number; turns: number }
  /** Target skips its next N turns. */
  | { type: "stun"; turns: number };

export type SkillTarget = "enemy" | "self";
/** Each turn a unit has one main action and one bonus action (see the reference screenshots). */
export type SkillCost = "action" | "bonus";

export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  target: SkillTarget;
  /** Max distance to the target in cells (Chebyshev, diagonals count as 1). 0 for self skills. */
  range: number;
  cost: SkillCost;
  mana: number;
  /** After use the skill becomes available again this many own turns later. 0 = every turn. */
  cooldown: number;
  effects: SkillEffect[];
}

export interface StatBonuses {
  health: number;
  attack: number;
  defense: number;
  speed: number;
  mana: number;
}

export interface Artifact {
  id: string;
  name: string;
  /** Class name shown in UI. */
  className: string;
  icon: string;
  description: string;
  /** Can be picked as the very first artifact. Others are obtained only by drop/craft. */
  starter: boolean;
  bonuses: StatBonuses;
  /** Cells the hero can move per turn (before speed bonus). */
  moveRange: number;
  skills: Skill[];
}

export const ARTIFACTS: readonly Artifact[] = [
  {
    id: "ash_blade",
    name: "Клинок Пепла",
    className: "Воин пламени",
    icon: "🗡️",
    description: "Ближний бой, огонь и живучесть. Хорош против магов, если до них дойти.",
    starter: true,
    bonuses: { health: 40, attack: 4, defense: 2, speed: 0, mana: 0 },
    moveRange: 4,
    skills: [
      { id: "ash_slash", name: "Удар клинком", icon: "⚔️", description: "Обычная атака в ближнем бою.",
        target: "enemy", range: 1, cost: "action", mana: 0, cooldown: 0, effects: [{ type: "damage", power: 2 }] },
      { id: "ash_flame_strike", name: "Пылающий удар", icon: "🔥", description: "Сильный удар, поджигает цель на 2 хода.",
        target: "enemy", range: 1, cost: "action", mana: 20, cooldown: 2,
        effects: [{ type: "damage", power: 2.4 }, { type: "dot", name: "Горение", power: 0.6, turns: 2 }] },
      { id: "ash_ember_throw", name: "Брошенный пепел", icon: "☄️", description: "Бонусное действие: бросок раскалённого пепла на 3 клетки.",
        target: "enemy", range: 3, cost: "bonus", mana: 15, cooldown: 3, effects: [{ type: "damage", power: 1 }] },
      { id: "ash_second_wind", name: "Второе дыхание", icon: "❤️‍🔥", description: "Бонусное действие: восстанавливает здоровье.",
        target: "self", range: 0, cost: "bonus", mana: 20, cooldown: 4, effects: [{ type: "heal", power: 2 }] },
    ],
  },
  {
    id: "abyss_staff",
    name: "Посох Бездны",
    className: "Маг",
    icon: "🔮",
    description: "Дальний бой и контроль. Мало здоровья, много маны.",
    starter: true,
    bonuses: { health: 0, attack: 6, defense: 0, speed: 0, mana: 60 },
    moveRange: 3,
    skills: [
      { id: "abyss_bolt", name: "Тайная стрела", icon: "✨", description: "Обычная атака на расстоянии до 5 клеток.",
        target: "enemy", range: 5, cost: "action", mana: 0, cooldown: 0, effects: [{ type: "damage", power: 1.5 }] },
      { id: "abyss_fireball", name: "Огненный шар", icon: "🔥", description: "Мощный урон на расстоянии.",
        target: "enemy", range: 5, cost: "action", mana: 30, cooldown: 2, effects: [{ type: "damage", power: 3 }] },
      { id: "abyss_frost", name: "Ледяные оковы", icon: "❄️", description: "Небольшой урон и оглушение на 1 ход.",
        target: "enemy", range: 4, cost: "action", mana: 25, cooldown: 4,
        effects: [{ type: "damage", power: 1 }, { type: "stun", turns: 1 }] },
      { id: "abyss_mana_shield", name: "Щит маны", icon: "🛡️", description: "Бонусное действие: щит на 25% здоровья на 2 хода.",
        target: "self", range: 0, cost: "bonus", mana: 20, cooldown: 4, effects: [{ type: "shield", percent: 25, turns: 2 }] },
    ],
  },
  {
    id: "dawn_shield",
    name: "Щит Рассвета",
    className: "Паладин",
    icon: "🛡️",
    description: "Танк с лечением и оглушением. Медленный, но очень прочный.",
    starter: true,
    bonuses: { health: 70, attack: 1, defense: 6, speed: 0, mana: 20 },
    moveRange: 3,
    skills: [
      { id: "dawn_mace", name: "Удар булавой", icon: "🔨", description: "Обычная атака в ближнем бою.",
        target: "enemy", range: 1, cost: "action", mana: 0, cooldown: 0, effects: [{ type: "damage", power: 1.8 }] },
      { id: "dawn_bash", name: "Удар щитом", icon: "💥", description: "Урон и оглушение на 1 ход.",
        target: "enemy", range: 1, cost: "action", mana: 20, cooldown: 3,
        effects: [{ type: "damage", power: 1.4 }, { type: "stun", turns: 1 }] },
      { id: "dawn_holy_light", name: "Святой свет", icon: "🌟", description: "Бонусное действие: сильное лечение.",
        target: "self", range: 0, cost: "bonus", mana: 25, cooldown: 3, effects: [{ type: "heal", power: 3 }] },
      { id: "dawn_aegis", name: "Эгида", icon: "🔰", description: "Бонусное действие: щит на 30% здоровья на 2 хода.",
        target: "self", range: 0, cost: "bonus", mana: 20, cooldown: 4, effects: [{ type: "shield", percent: 30, turns: 2 }] },
    ],
  },
  {
    id: "wind_bow",
    name: "Лук Ветра",
    className: "Следопыт",
    icon: "🏹",
    description: "Самая большая дальность и подвижность. Выпадает в бою.",
    starter: false,
    bonuses: { health: 20, attack: 5, defense: 1, speed: 0, mana: 20 },
    moveRange: 5,
    skills: [
      { id: "wind_shot", name: "Выстрел", icon: "🏹", description: "Обычная атака на расстоянии до 6 клеток.",
        target: "enemy", range: 6, cost: "action", mana: 0, cooldown: 0, effects: [{ type: "damage", power: 1.6 }] },
      { id: "wind_aimed", name: "Прицельный выстрел", icon: "🎯", description: "Сильный выстрел на 7 клеток.",
        target: "enemy", range: 7, cost: "action", mana: 25, cooldown: 2, effects: [{ type: "damage", power: 2.8 }] },
      { id: "wind_poison", name: "Ядовитая стрела", icon: "🧪", description: "Бонусное действие: отравляет цель на 3 хода.",
        target: "enemy", range: 6, cost: "bonus", mana: 15, cooldown: 3,
        effects: [{ type: "damage", power: 0.6 }, { type: "dot", name: "Яд", power: 0.6, turns: 3 }] },
      { id: "wind_herbs", name: "Целебные травы", icon: "🌿", description: "Бонусное действие: лечение.",
        target: "self", range: 0, cost: "bonus", mana: 20, cooldown: 4, effects: [{ type: "heal", power: 1.5 }] },
    ],
  },
  {
    id: "shadow_dagger",
    name: "Кинжал Тени",
    className: "Убийца",
    icon: "🔪",
    description: "Огромный урон вблизи, мало защиты. Выпадает в бою.",
    starter: false,
    bonuses: { health: 10, attack: 8, defense: 0, speed: 0, mana: 30 },
    moveRange: 5,
    skills: [
      { id: "shadow_stab", name: "Укол", icon: "🔪", description: "Обычная атака в ближнем бою.",
        target: "enemy", range: 1, cost: "action", mana: 0, cooldown: 0, effects: [{ type: "damage", power: 2.2 }] },
      { id: "shadow_backstab", name: "Удар в спину", icon: "🗡️", description: "Очень сильный удар.",
        target: "enemy", range: 1, cost: "action", mana: 25, cooldown: 2, effects: [{ type: "damage", power: 3.5 }] },
      { id: "shadow_knife", name: "Метательный нож", icon: "🌙", description: "Бонусное действие: бросок на 4 клетки.",
        target: "enemy", range: 4, cost: "bonus", mana: 15, cooldown: 2, effects: [{ type: "damage", power: 1 }] },
      { id: "shadow_venom", name: "Яд тени", icon: "☠️", description: "Бонусное действие: сильный яд на 3 хода.",
        target: "enemy", range: 1, cost: "bonus", mana: 20, cooldown: 3, effects: [{ type: "dot", name: "Яд", power: 1, turns: 3 }] },
    ],
  },
];

const byId = new Map(ARTIFACTS.map((a) => [a.id, a]));

export function getArtifact(id: string | null | undefined): Artifact | undefined {
  return id ? byId.get(id) : undefined;
}

export function findSkill(artifact: Artifact, skillId: string): Skill | undefined {
  return artifact.skills.find((s) => s.id === skillId);
}

/** Chance that a won bot battle drops an artifact the hero does not own yet. */
export const ARTIFACT_DROP_CHANCE = 0.3;
