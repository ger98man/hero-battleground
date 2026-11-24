/**
 * Classes, specializations, hybrids, talents and relic (game version 0.1).
 * All names and numbers are placeholders until the game owner approves them.
 *
 * A hero builds their own class: a base class at level 1, class ranks every 3rd level,
 * a new class every 6th level (max 3). The two highest-ranked classes give the hybrid
 * name (Воин + Монах = Паладин) and unlock hybrid skills.
 */

/** Seven stats (design of 24.11.2026). `dexterity` is Ловкость. Mana is a resource, not a stat. */
export type StatKey = "strength" | "dexterity" | "intellect" | "mastery" | "initiative" | "health" | "craft";
export type Stats = Record<StatKey, number>;
export type DamageType = "physical" | "magic";
export type ArmorType = DamageType;
/** Stat that a skill's power scales with. */
export type ScaleStat = "strength" | "dexterity" | "intellect";

export const STAT_NAMES: Record<StatKey, string> = {
  strength: "Сила",
  dexterity: "Ловкость",
  intellect: "Интеллект",
  mastery: "Мастерство",
  initiative: "Инициатива",
  health: "Здоровье",
  craft: "Ремесло",
};

export type SkillEffect =
  /** Damage = power × stat. Hits armor of its type first, then HP. */
  | { type: "damage"; power: number; stat: ScaleStat; damageType: DamageType; hits?: number; executeBelow?: number }
  /** Heal = power × stat. */
  | { type: "heal"; power: number; stat: ScaleStat }
  /** Restores armor by a percent of its maximum. */
  | { type: "armor"; armor: ArmorType | "both"; percent: number }
  /** Damage over time at the start of the target's turn: power × caster stat per tick. */
  | { type: "dot"; name: string; power: number; stat: ScaleStat; damageType: DamageType; turns: number }
  /** Target skips N turns, only if its armor of type `gate` is broken (0). */
  | { type: "stun"; name: string; turns: number; gate: ArmorType };

export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  target: "enemy" | "self";
  /** Max distance (Chebyshev). 0 for self skills. */
  range: number;
  cost: "action" | "bonus";
  mana: number;
  cooldown: number;
  effects: SkillEffect[];
  /** Element tag; a matching mage specialization gives +15% damage. */
  element?: string;
}

/** Skill as it appears in a class: who can learn it. */
export interface ClassSkill extends Skill {
  /** Required class rank. */
  rank: number;
  /** Required specialization of this class, if any. */
  spec?: string;
}

export interface Specialization {
  id: string;
  name: string;
  description: string;
  /** Passive bonus of the spec, applied to battle stats. */
  passive: Partial<PassiveMods>;
}

export interface GameClass {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Has skills in this version; only playable classes can be taken. */
  playable: boolean;
  /** Stats added per rank of this class. */
  perRank: Partial<Stats>;
  /** Armor added per rank of this class. */
  armorPerRank: { physical: number; magic: number };
  /** Basic attack of the class (free, does not take a skill slot). */
  basic: Skill;
  specs: Specialization[];
  skills: ClassSkill[];
}

export interface Hybrid {
  /** Two class ids, sorted. */
  classes: [string, string];
  name: string;
  description: string;
  skills: Skill[];
}

/** Modifiers from specs, relic and talents, used by the battle engine. */
export interface PassiveMods {
  physicalDamage: number; // multiplier bonus, 0.1 = +10%
  magicDamage: number;
  healing: number;
  physicalArmor: number; // multiplier bonus on max physical armor
  magicArmor: number;
  /** Element tag that gets +15% damage (mage specs). */
  element?: string;
  /** Part of physical damage dealt restored as own physical armor. */
  armorOnHit: number;
  /** Part of physical damage dealt added as extra magic damage. */
  magicOnPhysicalHit: number;
}

const basic = (id: string, name: string, icon: string, stat: ScaleStat, damageType: DamageType, range: number, power = 1): Skill => ({
  id, name, icon, description: range > 1 ? `Обычная атака на расстоянии до ${range} клеток.` : "Обычная атака в ближнем бою.",
  target: "enemy", range, cost: "action", mana: 0, cooldown: 0,
  effects: [{ type: "damage", power, stat, damageType }],
});

const notYet = (id: string, name: string, icon: string, description: string, specs: [string, string][]): GameClass => ({
  id, name, icon, description, playable: false,
  perRank: {}, armorPerRank: { physical: 0, magic: 0 },
  basic: basic(`${id}_basic`, "Атака", "⚔️", "strength", "physical", 1),
  specs: specs.map(([sid, sname]) => ({ id: sid, name: sname, description: "Скоро.", passive: {} })),
  skills: [],
});

export const CLASSES: readonly GameClass[] = [
  {
    id: "warrior",
    name: "Воин",
    icon: "⚔️",
    description: "Ближний бой, физическая броня и сила.",
    playable: true,
    perRank: { strength: 3, health: 2 },
    armorPerRank: { physical: 12, magic: 2 },
    basic: basic("warrior_basic", "Удар оружием", "🗡️", "strength", "physical", 1),
    specs: [
      { id: "warrior_shield", name: "Щит и меч", description: "+30% физической брони.", passive: { physicalArmor: 0.3 } },
      { id: "warrior_twohand", name: "Двуручное оружие", description: "+15% физического урона.", passive: { physicalDamage: 0.15 } },
      { id: "warrior_dual", name: "Парное оружие", description: "+10% физического урона, умения с несколькими ударами.", passive: { physicalDamage: 0.1 } },
    ],
    skills: [
      { id: "warrior_power", name: "Мощный удар", icon: "💥", description: "Сильный удар оружием.", rank: 1,
        target: "enemy", range: 1, cost: "action", mana: 15, cooldown: 2,
        effects: [{ type: "damage", power: 1.7, stat: "strength", damageType: "physical" }] },
      { id: "warrior_bash", name: "Удар щитом", icon: "🛡️", description: "Урон и сбивание с ног на 1 ход, если физическая броня цели пробита.", rank: 1, spec: "warrior_shield",
        target: "enemy", range: 1, cost: "action", mana: 15, cooldown: 3,
        effects: [{ type: "damage", power: 1, stat: "strength", damageType: "physical" }, { type: "stun", name: "Сбит с ног", turns: 1, gate: "physical" }] },
      { id: "warrior_execute", name: "Казнь", icon: "🪓", description: "Двойной урон, если у цели меньше 35% здоровья.", rank: 1, spec: "warrior_twohand",
        target: "enemy", range: 1, cost: "action", mana: 20, cooldown: 3,
        effects: [{ type: "damage", power: 1.4, stat: "strength", damageType: "physical", executeBelow: 0.35 }] },
      { id: "warrior_flurry", name: "Вихрь клинков", icon: "🌀", description: "Два быстрых удара.", rank: 1, spec: "warrior_dual",
        target: "enemy", range: 1, cost: "action", mana: 15, cooldown: 2,
        effects: [{ type: "damage", power: 0.85, stat: "strength", damageType: "physical", hits: 2 }] },
      { id: "warrior_cry", name: "Боевой клич", icon: "📯", description: "Бонусное действие: восстанавливает 30% физической брони.", rank: 2,
        target: "self", range: 0, cost: "bonus", mana: 15, cooldown: 4,
        effects: [{ type: "armor", armor: "physical", percent: 30 }] },
      { id: "warrior_wound", name: "Глубокая рана", icon: "🩸", description: "Бонусное действие: кровотечение на 3 хода.", rank: 3,
        target: "enemy", range: 1, cost: "bonus", mana: 10, cooldown: 3,
        effects: [{ type: "dot", name: "Кровотечение", power: 0.4, stat: "strength", damageType: "physical", turns: 3 }] },
    ],
  },
  {
    id: "mage",
    name: "Маг",
    icon: "🔮",
    description: "Магия стихий на расстоянии, много маны и магической брони.",
    playable: true,
    perRank: { intellect: 3, mastery: 2 },
    armorPerRank: { physical: 2, magic: 12 },
    basic: basic("mage_basic", "Магическая стрела", "✨", "intellect", "magic", 5, 0.9),
    specs: [
      { id: "mage_fire", name: "Огонь", description: "+15% урона огнём.", passive: { element: "fire" } },
      { id: "mage_ice", name: "Лёд", description: "+15% урона льдом.", passive: { element: "ice" } },
      { id: "mage_air", name: "Воздух", description: "+15% урона воздухом.", passive: { element: "air" } },
      { id: "mage_earth", name: "Земля", description: "+15% урона землёй.", passive: { element: "earth" } },
      { id: "mage_lightning", name: "Молния", description: "+15% урона молнией.", passive: { element: "lightning" } },
    ],
    skills: [
      { id: "mage_fireball", name: "Огненный шар", icon: "🔥", description: "Урон огнём и горение на 2 хода.", rank: 1, spec: "mage_fire", element: "fire",
        target: "enemy", range: 5, cost: "action", mana: 25, cooldown: 2,
        effects: [{ type: "damage", power: 1.5, stat: "intellect", damageType: "magic" }, { type: "dot", name: "Горение", power: 0.3, stat: "intellect", damageType: "magic", turns: 2 }] },
      { id: "mage_frost", name: "Ледяная стрела", icon: "❄️", description: "Урон льдом и заморозка на 1 ход, если магическая броня цели пробита.", rank: 1, spec: "mage_ice", element: "ice",
        target: "enemy", range: 5, cost: "action", mana: 20, cooldown: 2,
        effects: [{ type: "damage", power: 1.2, stat: "intellect", damageType: "magic" }, { type: "stun", name: "Заморозка", turns: 1, gate: "magic" }] },
      { id: "mage_gust", name: "Порыв ветра", icon: "🌪️", description: "Бонусное действие: быстрый удар воздухом.", rank: 1, spec: "mage_air", element: "air",
        target: "enemy", range: 4, cost: "bonus", mana: 15, cooldown: 2,
        effects: [{ type: "damage", power: 0.8, stat: "intellect", damageType: "magic" }] },
      { id: "mage_stoneskin", name: "Каменная кожа", icon: "🪨", description: "Бонусное действие: восстанавливает 40% физической брони.", rank: 1, spec: "mage_earth", element: "earth",
        target: "self", range: 0, cost: "bonus", mana: 20, cooldown: 4,
        effects: [{ type: "armor", armor: "physical", percent: 40 }] },
      { id: "mage_shock", name: "Шок", icon: "⚡", description: "Урон молнией и оглушение на 1 ход, если магическая броня цели пробита.", rank: 1, spec: "mage_lightning", element: "lightning",
        target: "enemy", range: 5, cost: "action", mana: 25, cooldown: 3,
        effects: [{ type: "damage", power: 1.3, stat: "intellect", damageType: "magic" }, { type: "stun", name: "Шок", turns: 1, gate: "magic" }] },
      { id: "mage_barrier", name: "Магический барьер", icon: "🔷", description: "Бонусное действие: восстанавливает 40% магической брони.", rank: 2,
        target: "self", range: 0, cost: "bonus", mana: 20, cooldown: 4,
        effects: [{ type: "armor", armor: "magic", percent: 40 }] },
      { id: "mage_missiles", name: "Чародейский залп", icon: "☄️", description: "Три магических снаряда.", rank: 3,
        target: "enemy", range: 6, cost: "action", mana: 30, cooldown: 3,
        effects: [{ type: "damage", power: 0.7, stat: "intellect", damageType: "magic", hits: 3 }] },
    ],
  },
  {
    id: "monk",
    name: "Монах",
    icon: "☯️",
    description: "Ловкий боец: свет, боевые искусства и лечение.",
    playable: true,
    perRank: { dexterity: 2, intellect: 1, health: 2 },
    armorPerRank: { physical: 6, magic: 6 },
    basic: basic("monk_basic", "Удар ладонью", "✋", "dexterity", "physical", 1),
    specs: [
      { id: "monk_light", name: "Жрец Света", description: "+15% магического урона.", passive: { magicDamage: 0.15 } },
      { id: "monk_arts", name: "Боевые искусства", description: "+15% физического урона.", passive: { physicalDamage: 0.15 } },
      { id: "monk_healing", name: "Врачевание", description: "+25% лечения.", passive: { healing: 0.25 } },
    ],
    skills: [
      { id: "monk_heal", name: "Исцеление", icon: "💚", description: "Бонусное действие: лечение.", rank: 1,
        target: "self", range: 0, cost: "bonus", mana: 20, cooldown: 4,
        effects: [{ type: "heal", power: 1.5, stat: "intellect" }] },
      { id: "monk_smite", name: "Кара света", icon: "🌟", description: "Удар светом на расстоянии.", rank: 1, spec: "monk_light", element: "light",
        target: "enemy", range: 4, cost: "action", mana: 20, cooldown: 2,
        effects: [{ type: "damage", power: 1.4, stat: "intellect", damageType: "magic" }] },
      { id: "monk_combo", name: "Серия ударов", icon: "👊", description: "Два удара подряд.", rank: 1, spec: "monk_arts",
        target: "enemy", range: 1, cost: "action", mana: 15, cooldown: 2,
        effects: [{ type: "damage", power: 0.9, stat: "dexterity", damageType: "physical", hits: 2 }] },
      { id: "monk_renew", name: "Обновление", icon: "🌿", description: "Сильное лечение и 20% магической брони.", rank: 1, spec: "monk_healing",
        target: "self", range: 0, cost: "action", mana: 30, cooldown: 4,
        effects: [{ type: "heal", power: 2.2, stat: "intellect" }, { type: "armor", armor: "magic", percent: 20 }] },
      { id: "monk_meditate", name: "Медитация", icon: "🧘", description: "Бонусное действие: восстанавливает 25% обеих броней.", rank: 2,
        target: "self", range: 0, cost: "bonus", mana: 20, cooldown: 4,
        effects: [{ type: "armor", armor: "both", percent: 25 }] },
      { id: "monk_stun", name: "Оглушающий удар", icon: "💫", description: "Урон и оглушение на 1 ход, если физическая броня цели пробита.", rank: 3,
        target: "enemy", range: 1, cost: "action", mana: 20, cooldown: 4,
        effects: [{ type: "damage", power: 1, stat: "dexterity", damageType: "physical" }, { type: "stun", name: "Оглушение", turns: 1, gate: "physical" }] },
    ],
  },
  notYet("archer", "Стрелок", "🏹", "Дальний бой оружием.", [["archer_crossbow", "Арбалет"], ["archer_bow", "Лук"], ["archer_gun", "Огнестрел"], ["archer_dual", "Парное оружие"]]),
  notYet("necromancer", "Некромант", "💀", "Тёмная магия, проклятия и нежить.", [["necro_raise", "Воскрешатель"], ["necro_dark", "Тёмная магия"], ["necro_curse", "Проклятия и болезни"]]),
  notYet("engineer", "Инженер", "⚙️", "Мины, турели и роботы.", [["eng_mines", "Минёр"], ["eng_turrets", "Мастер турелей"], ["eng_robots", "Робототехника"]]),
  notYet("druid", "Друид", "🌳", "Силы природы и превращения.", [["druid_nature", "Силы природы"], ["druid_shift", "Метаморф"], ["druid_shaman", "Шаманство"]]),
  notYet("assassin", "Ассассин", "🗡️", "Скрытность, яды и ловкость.", [["assassin_stealth", "Скрытность"], ["assassin_poison", "Яды"], ["assassin_trick", "Ловкач"]]),
];

const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export const HYBRIDS: readonly Hybrid[] = [
  {
    classes: pair("warrior", "monk"),
    name: "Паладин",
    description: "Урон, защита и свет.",
    skills: [
      { id: "paladin_strike", name: "Святой удар", icon: "✝️", description: "Удар оружием, восстанавливает 15% своей физической брони.",
        target: "enemy", range: 1, cost: "action", mana: 20, cooldown: 2,
        effects: [{ type: "damage", power: 1.3, stat: "strength", damageType: "physical" }, { type: "armor", armor: "physical", percent: 15 }] },
      { id: "paladin_aura", name: "Аура защиты", icon: "🔆", description: "Бонусное действие: 25% обеих броней и немного здоровья.",
        target: "self", range: 0, cost: "bonus", mana: 25, cooldown: 5,
        effects: [{ type: "armor", armor: "both", percent: 25 }, { type: "heal", power: 1, stat: "intellect" }] },
    ],
  },
  {
    classes: pair("warrior", "mage"),
    name: "Боевой маг",
    description: "Зачарованное оружие: физический и магический урон сразу.",
    skills: [
      { id: "battlemage_blade", name: "Зачарованный клинок", icon: "🗡️", description: "Физический и магический урон одним ударом.",
        target: "enemy", range: 1, cost: "action", mana: 20, cooldown: 2,
        effects: [{ type: "damage", power: 0.9, stat: "strength", damageType: "physical" }, { type: "damage", power: 0.9, stat: "intellect", damageType: "magic" }] },
      { id: "battlemage_ward", name: "Рунный щит", icon: "🔰", description: "Бонусное действие: 30% магической и 15% физической брони.",
        target: "self", range: 0, cost: "bonus", mana: 20, cooldown: 4,
        effects: [{ type: "armor", armor: "magic", percent: 30 }, { type: "armor", armor: "physical", percent: 15 }] },
    ],
  },
  { classes: pair("warrior", "necromancer"), name: "Рыцарь смерти", description: "Вампиризм и проклятия.", skills: [] },
  { classes: pair("warrior", "engineer"), name: "Механорыцарь", description: "Броня и механизмы.", skills: [] },
  { classes: pair("assassin", "mage"), name: "Чародейский убийца", description: "Телепортация и магический взрыв.", skills: [] },
  { classes: pair("archer", "druid"), name: "Следопыт", description: "Природа, ловушки и дальний бой.", skills: [] },
  { classes: pair("necromancer", "monk"), name: "Инквизитор", description: "Свет и тёмная магия.", skills: [] },
  { classes: pair("engineer", "necromancer"), name: "Технолич", description: "Механические и некротические конструкции.", skills: [] },
];

export interface Talent {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Talents in the same group exclude each other. */
  group?: string;
}

export const TALENTS: readonly Talent[] = [
  { id: "opportunist", name: "Оппортунист", icon: "🎯", description: "Реакция: если противник уходит с соседней клетки, вы бьёте его обычной атакой. Раз за раунд." },
  { id: "last_stand", name: "Последний рубеж", icon: "🛡️", description: "Раз за бой смертельный удар оставляет вам 1 здоровья.", group: "survival" },
  { id: "blood_magic", name: "Магия крови", icon: "🩸", description: "Если не хватает маны, недостающее платится здоровьем (×2).", group: "survival" },
  { id: "thick_skin", name: "Толстая кожа", icon: "🐢", description: "+20% физической и магической брони." },
];

/** Levels at which talents are unlocked. */
export const TALENT_EVERY = 4;
export const MAX_CLASSES = 3;
export const MAX_CLASS_RANK = 5;
/** Base number of skill slots; the hero level adds one per LEVELS_PER_SLOT (placeholder). */
export const BASE_SKILL_SLOTS = 4;
export const LEVELS_PER_SLOT = 5;
export const MAX_SKILL_SLOTS = 8;

const classById = new Map(CLASSES.map((c) => [c.id, c]));
export const getClass = (id: string) => classById.get(id);
export const getTalent = (id: string) => TALENTS.find((t) => t.id === id);

export function getHybrid(a: string, b: string): Hybrid {
  const [x, y] = pair(a, b);
  return (
    HYBRIDS.find((h) => h.classes[0] === x && h.classes[1] === y) ?? {
      classes: [x, y],
      name: `${getClass(x)?.name ?? x}/${getClass(y)?.name ?? y}`,
      description: "Название гибрида ещё не придумано.",
      skills: [],
    }
  );
}

/** Every skill that exists, by id (basic attacks, class and hybrid skills). */
export const ALL_SKILLS: ReadonlyMap<string, Skill> = new Map(
  [
    ...CLASSES.flatMap((c) => [c.basic, ...c.skills]),
    ...HYBRIDS.flatMap((h) => h.skills),
  ].map((s) => [s.id, s]),
);
