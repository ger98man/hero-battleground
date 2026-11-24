/**
 * Factions 0.1: the hero belongs to one faction and leads one of its four heroes.
 * Every faction has a fixed roster of 7 tiers with two unit variants each; the player chooses
 * which units and how many to take, within the hero's leadership.
 *
 * All names are working titles until the game owner approves them.
 * The `model` of a hero or unit tells the client how to draw its placeholder figure (public/models.js).
 */
import type { UnitAttribute } from "./stats.js";

export enum FactionId {
  Dawn = "dawn",
  Ash = "ash",
  Rot = "rot",
  Grove = "grove",
}

export enum UnitRole {
  Melee = "melee",
  Ranged = "ranged",
  Flyer = "flyer",
  Caster = "caster",
  Siege = "siege",
}

/**
 * Unit tags: what kind of creature it is. Hero army bonuses name the tags they boost
 * ("+15% урона шаманов" → Shaman), and the army screen shows them on every unit card.
 */
export enum UnitTag {
  Infantry = "infantry",
  Shooter = "shooter",
  Caster = "caster",
  Flyer = "flyer",
  Siege = "siege",
  Rider = "rider",
  Beast = "beast",
  Shaman = "shaman",
  Undead = "undead",
  Treant = "treant",
}

/** Player-facing tag names: `name` for the chip, `many` for bonus texts, `hint` for the tooltip. */
export const UNIT_TAGS: Record<UnitTag, { name: string; many: string; hint: string }> = {
  [UnitTag.Infantry]: { name: "Пехота", many: "пехота", hint: "Пеший боец ближнего боя: идёт к врагу и бьёт вплотную." },
  [UnitTag.Shooter]: { name: "Стрелок", many: "стрелки", hint: "Бьёт издалека и не получает ответного удара." },
  [UnitTag.Caster]: { name: "Заклинатель", many: "заклинатели", hint: "Магический отряд, урон растёт от Интеллекта героя." },
  [UnitTag.Flyer]: { name: "Летает", many: "летающие", hint: "Перелетает через препятствия и других существ." },
  [UnitTag.Siege]: { name: "Осадное", many: "осадные орудия", hint: "Медленное орудие, бьёт издалека." },
  [UnitTag.Rider]: { name: "Всадник", many: "всадники", hint: "Боец верхом: на коне, волке, вепре или гиппогрифе." },
  [UnitTag.Beast]: { name: "Зверь", many: "звери", hint: "Животное или чудище: волки, пантеры, грифоны, драконы, а также их наездники." },
  [UnitTag.Shaman]: { name: "Шаман", many: "шаманы", hint: "Колдуны кланов: знахари, тотемщики и огры-чародеи." },
  [UnitTag.Undead]: { name: "Нежить", many: "нежить", hint: "Мёртвые, поднятые магией. Все войска Ковена Тлена." },
  [UnitTag.Treant]: { name: "Древень", many: "древни", hint: "Живые деревья Лесного Круга." },
};

export enum ModelBody {
  Soldier = "soldier",
  Knight = "knight",
  Robed = "robed",
  Beast = "beast",
  Rider = "rider",
  Flyer = "flyer",
  Siege = "siege",
  Giant = "giant",
  Spirit = "spirit",
  Dragon = "dragon",
  Tree = "tree",
}

export enum ModelWeapon {
  None = "none",
  Sword = "sword",
  Spear = "spear",
  Bow = "bow",
  Crossbow = "crossbow",
  Staff = "staff",
  Axe = "axe",
  Hammer = "hammer",
  Scythe = "scythe",
  Claws = "claws",
  /** Sling with a stone swung overhead. */
  Sling = "sling",
  /** Carved totem pole. */
  Totem = "totem",
  /** An axe in each hand (thrower). */
  TwinAxes = "twin_axes",
}

export enum ModelHead {
  Bare = "bare",
  Helm = "helm",
  Hood = "hood",
  Horns = "horns",
  Crown = "crown",
  Skull = "skull",
  Antlers = "antlers",
  Halo = "halo",
  Feather = "feather",
}

export type ModelSpec = {
  body: ModelBody;
  weapon: ModelWeapon;
  head: ModelHead;
  shield?: boolean;
  cape?: boolean;
  wings?: boolean;
  /** Main color of the figure (armor, robe, fur); faction colors are used for trim. */
  tint: string;
  /** Own drawing of this creature in public/models.js (SHAPES); units get their id. Without it the figure is built from parts. */
  shape?: string;
};

export type UnitDef = {
  id: string;
  name: string;
  tier: number;
  role: UnitRole;
  /** What kind of creature it is (see UNIT_TAGS); hero bonuses work on these. */
  tags: UnitTag[];
  description: string;
  hp: number;
  attack: number;
  defense: number;
  damage: [number, number];
  initiative: number;
  speed: number;
  /** Leadership spent per creature. */
  cost: number;
  /** Main stat of the unit: its damage grows with the hero's value of this stat. */
  attribute: UnitAttribute;
  model: ModelSpec;
};

/** A class line of a faction hero: the game class and its specialization (see classes.ts). */
export type HeroClassLine = { id: string; spec: string };

export type FactionHero = {
  id: string;
  /** The hero's fixed class lines, main one first. The second one opens at level 6. */
  classes: HeroClassLine[];
  name: string;
  title: string;
  description: string;
  relic: { name: string; description: string };
  /** Bonus to the army as shown to the player. */
  armyBonus: string;
  /** Which units the bonus works on and what it changes in battle (see `bonusApplies`). */
  bonus: ArmyBonusRule;
  model: ModelSpec;
};

/** A stat change a hero bonus makes; `hp` and `damage` are fractions (0.15 = +15%). */
export type BonusEffect = { stat: "attack" | "defense" | "speed" | "hp" | "damage"; value: number };

/**
 * What a hero's army bonus works on: own units with any of `tags` (empty = the whole army),
 * or every enemy stack when `enemies` is set. Without `effect` the bonus does not work in battle yet.
 */
export type ArmyBonusRule = { tags: UnitTag[]; enemies?: boolean; effect?: BonusEffect };

export type FactionTier = { tier: number; unlockLevel: number; units: [UnitDef, UnitDef] };

export type Faction = {
  id: FactionId;
  name: string;
  motto: string;
  description: string;
  color: string;
  accent: string;
  heroes: FactionHero[];
  tiers: FactionTier[];
};

export type ArmyStack = { unitId: string; count: number };

export const MAX_ARMY_STACKS = 7;
/** Hero level at which each tier (1..7) becomes available. */
export const TIER_UNLOCK_LEVEL: readonly number[] = [1, 1, 3, 5, 7, 9, 12];
const TIER_COST: readonly number[] = [1, 2, 4, 7, 12, 20, 35];
const TIER_HP: readonly number[] = [6, 10, 18, 30, 55, 90, 180];
const TIER_ATTACK: readonly number[] = [3, 5, 7, 10, 13, 17, 22];
const TIER_DAMAGE: readonly [number, number][] = [[1, 2], [2, 3], [3, 5], [5, 8], [8, 12], [12, 20], [25, 35]];

/** Leadership: how much army the hero can lead. Grows with level. */
export const leadership = (level: number): number => 60 + 30 * level;

type UnitInput = {
  id: string;
  name: string;
  role: UnitRole;
  description: string;
  model: ModelSpec;
  /** Tags on top of the ones that follow from role and body (e.g. Shaman). */
  tags?: UnitTag[];
  /** Small per-unit tweaks to the tier baseline. */
  hp?: number;
  attack?: number;
  defense?: number;
  initiative?: number;
  speed?: number;
};

const ROLE_SPEED: Record<UnitRole, number> = {
  [UnitRole.Melee]: 4,
  [UnitRole.Ranged]: 3,
  [UnitRole.Flyer]: 7,
  [UnitRole.Caster]: 4,
  [UnitRole.Siege]: 2,
};

/** Main stat by role (placeholder until units get their own): melee and siege — Сила, shooters and flyers — Ловкость, casters — Интеллект. */
const ROLE_ATTRIBUTE: Record<UnitRole, UnitAttribute> = {
  [UnitRole.Melee]: "strength",
  [UnitRole.Siege]: "strength",
  [UnitRole.Ranged]: "dexterity",
  [UnitRole.Flyer]: "dexterity",
  [UnitRole.Caster]: "intellect",
};

/** Tags from role and body, plus the unit's own extra tags; Ковен Тлена is all undead. */
function unitTags(faction: FactionId, input: UnitInput): UnitTag[] {
  const { body, weapon } = input.model;
  const tags: UnitTag[] = [];
  const animal = body === ModelBody.Beast || body === ModelBody.Dragon || (body === ModelBody.Flyer && weapon !== ModelWeapon.Spear);
  switch (input.role) {
    case UnitRole.Melee:
      if (body === ModelBody.Rider) tags.push(UnitTag.Rider);
      else if (body === ModelBody.Tree) tags.push(UnitTag.Treant);
      else if (!animal) tags.push(UnitTag.Infantry);
      break;
    case UnitRole.Ranged: tags.push(UnitTag.Shooter); break;
    case UnitRole.Caster: tags.push(UnitTag.Caster); break;
    case UnitRole.Siege: tags.push(UnitTag.Siege); if (body === ModelBody.Tree) tags.push(UnitTag.Treant); break;
    case UnitRole.Flyer:
      tags.push(UnitTag.Flyer);
      if (body === ModelBody.Flyer && weapon === ModelWeapon.Spear) tags.push(UnitTag.Rider, UnitTag.Beast);
      break;
  }
  if (animal) tags.push(UnitTag.Beast);
  if (faction === FactionId.Rot) tags.push(UnitTag.Undead);
  for (const t of input.tags ?? []) if (!tags.includes(t)) tags.push(t);
  return tags;
}

function unit(faction: FactionId, tier: number, input: UnitInput): UnitDef {
  const i = tier - 1;
  const hp = Math.round(TIER_HP[i] * (input.hp ?? 1));
  return {
    id: input.id,
    name: input.name,
    tier,
    role: input.role,
    tags: unitTags(faction, input),
    description: input.description,
    hp,
    attack: TIER_ATTACK[i] + (input.attack ?? 0),
    defense: TIER_ATTACK[i] - 1 + (input.defense ?? 0),
    damage: TIER_DAMAGE[i],
    initiative: 10 + (input.initiative ?? 0),
    speed: ROLE_SPEED[input.role] + (input.speed ?? 0),
    cost: TIER_COST[i],
    attribute: ROLE_ATTRIBUTE[input.role],
    model: { ...input.model, shape: input.id },
  };
}

function tiers(faction: FactionId, pairs: [UnitInput, UnitInput][]): FactionTier[] {
  return pairs.map(([a, b], i) => ({ tier: i + 1, unlockLevel: TIER_UNLOCK_LEVEL[i], units: [unit(faction, i + 1, a), unit(faction, i + 1, b)] }));
}

const M = ModelBody;
const W = ModelWeapon;
const H = ModelHead;
const R = UnitRole;
const T = UnitTag;

export const FACTIONS: readonly Faction[] = [
  {
    id: FactionId.Dawn,
    name: "Орден Рассвета",
    motto: "Сталь и свет",
    description: "Люди королевств: стойкая пехота, стрелки, рыцари и небесные стражи.",
    color: "#2f5fb3",
    accent: "#e8c66a",
    heroes: [
      { id: "dawn_paladin", classes: [{ id: "warrior", spec: "warrior_shield" }, { id: "monk", spec: "monk_light" }], name: "Паладин", title: "Щит ордена", description: "Ведёт рыцарей в первом ряду, лечит и защищает войска.",
        relic: { name: "Клинок Зари", description: "Удары героя накладывают Световую метку." }, armyBonus: "+2 к защите пехоты", bonus: { tags: [T.Infantry], effect: { stat: "defense", value: 2 } },
        model: { body: M.Knight, weapon: W.Sword, head: H.Helm, shield: true, cape: true, tint: "#c9ced8" } },
      { id: "dawn_archmage", classes: [{ id: "mage", spec: "mage_fire" }], name: "Архимаг", title: "Хранитель башни", description: "Сильнейший заклинатель ордена, усиливает магов.",
        relic: { name: "Посох Семи Звёзд", description: "Заклинания стоят меньше маны." }, armyBonus: "+20% урона заклинателей", bonus: { tags: [T.Caster], effect: { stat: "damage", value: 0.2 } },
        model: { body: M.Robed, weapon: W.Staff, head: H.Hood, cape: true, tint: "#3b62b8" } },
      { id: "dawn_marshal", classes: [{ id: "warrior", spec: "warrior_dual" }], name: "Маршал", title: "Командир стрелков", description: "Мастер строя и залпов, ведёт арбалетчиков.",
        relic: { name: "Знамя Первого Полка", description: "Стрелки получают +1 к инициативе." }, armyBonus: "+1 к атаке стрелков", bonus: { tags: [T.Shooter], effect: { stat: "attack", value: 1 } },
        model: { body: M.Soldier, weapon: W.Crossbow, head: H.Feather, cape: true, tint: "#8a6a3c" } },
      { id: "dawn_inquisitor", classes: [{ id: "monk", spec: "monk_light" }, { id: "warrior", spec: "warrior_twohand" }], name: "Инквизитор", title: "Карающая длань", description: "Охотник на нечисть, ослабляет вражескую магию.",
        relic: { name: "Печать Очищения", description: "Снимает с войск вражеские проклятия." }, armyBonus: "+10% к сопротивлению магии", bonus: { tags: [] },
        model: { body: M.Soldier, weapon: W.Hammer, head: H.Hood, cape: true, tint: "#7a2b25" } },
    ],
    tiers: tiers(FactionId.Dawn, [
      [{ id: "dawn_militia", name: "Ополченец", role: R.Melee, description: "Дешёвая пехота с копьём.", model: { body: M.Soldier, weapon: W.Spear, head: H.Helm, tint: "#9aa1ad" } },
       { id: "dawn_halberdier", name: "Алебардщик", role: R.Melee, description: "Медленнее, но крепче, держит строй.", defense: 2, speed: -1, model: { body: M.Soldier, weapon: W.Axe, head: H.Helm, shield: true, tint: "#b8bec9" } }],
      [{ id: "dawn_crossbow", name: "Арбалетчик", role: R.Ranged, description: "Стреляет издалека, бьёт сквозь броню.", model: { body: M.Soldier, weapon: W.Crossbow, head: H.Helm, tint: "#8a6a3c" } },
       { id: "dawn_archer", name: "Лучник", role: R.Ranged, description: "Быстрые выстрелы, слабее в ближнем бою.", initiative: 2, model: { body: M.Soldier, weapon: W.Bow, head: H.Feather, tint: "#5f7a3a" } }],
      [{ id: "dawn_sister", name: "Сестра милосердия", role: R.Caster, description: "Лечит отряды рядом с собой.", model: { body: M.Robed, weapon: W.Staff, head: H.Halo, tint: "#e8e2d0" } },
       { id: "dawn_battlemage", name: "Боевой маг", role: R.Caster, description: "Бросает огненные шары.", attack: 2, defense: -2, model: { body: M.Robed, weapon: W.Staff, head: H.Hood, tint: "#3b62b8" } }],
      [{ id: "dawn_griffin", name: "Грифон", role: R.Flyer, description: "Летает и отвечает на каждую атаку.", model: { body: M.Flyer, weapon: W.Claws, head: H.Bare, wings: true, tint: "#b88a4a" } },
       { id: "dawn_pegasus", name: "Пегас", role: R.Flyer, description: "Самый быстрый отряд ордена.", speed: 2, hp: 0.85, model: { body: M.Flyer, weapon: W.None, head: H.Bare, wings: true, tint: "#e9ecf2" } }],
      [{ id: "dawn_knight", name: "Рыцарь", role: R.Melee, description: "Тяжёлая конница, удар с разбега.", model: { body: M.Rider, weapon: W.Spear, head: H.Helm, shield: true, tint: "#c9ced8" } },
       { id: "dawn_cuirassier", name: "Кирасир", role: R.Melee, description: "Медленнее рыцаря, но в два слоя брони.", defense: 3, speed: -1, model: { body: M.Rider, weapon: W.Sword, head: H.Helm, cape: true, tint: "#8f96a3" } }],
      [{ id: "dawn_trebuchet", name: "Требушет", role: R.Siege, description: "Бьёт по площади через всё поле.", model: { body: M.Siege, weapon: W.None, head: H.Bare, tint: "#8a6a3c" } },
       { id: "dawn_ballista", name: "Баллиста", role: R.Siege, description: "Точный выстрел по одной цели.", attack: 3, model: { body: M.Siege, weapon: W.Crossbow, head: H.Bare, tint: "#6e5232" } }],
      [{ id: "dawn_guardian", name: "Небесный страж", role: R.Flyer, description: "Крылатый воин, воскрешает павших.", model: { body: M.Knight, weapon: W.Sword, head: H.Halo, wings: true, tint: "#f2e7c4" } },
       { id: "dawn_seraph", name: "Серафим", role: R.Caster, description: "Выжигает нечисть светом.", attack: 3, hp: 0.9, model: { body: M.Robed, weapon: W.Staff, head: H.Halo, wings: true, tint: "#f6efe0" } }],
    ]),
  },
  {
    id: FactionId.Ash,
    name: "Кланы Пепла",
    motto: "Сила и ярость",
    description: "Степные кланы: живучие бойцы, звери, шаманы и огромные чудища.",
    color: "#9b2a1e",
    accent: "#e09a4a",
    heroes: [
      { id: "ash_warlord", classes: [{ id: "warrior", spec: "warrior_twohand" }, { id: "monk", spec: "monk_arts" }], name: "Вождь", title: "Голос кланов", description: "Ведёт орду в атаку, усиливает ближний бой.",
        relic: { name: "Топор Первого Костра", description: "Каждый третий удар героя бьёт дважды." }, armyBonus: "+2 к атаке пехоты", bonus: { tags: [T.Infantry], effect: { stat: "attack", value: 2 } },
        model: { body: M.Giant, weapon: W.Axe, head: H.Horns, cape: true, tint: "#6f8a3a" } },
      { id: "ash_shaman", classes: [{ id: "mage", spec: "mage_lightning" }, { id: "monk", spec: "monk_healing" }], name: "Шаман бури", title: "Говорящий с громом", description: "Призывает молнии и лечит воинов.",
        relic: { name: "Тотем Грома", description: "Молния прыгает на соседнюю цель." }, armyBonus: "+15% урона шаманов", bonus: { tags: [T.Shaman], effect: { stat: "damage", value: 0.15 } },
        model: { body: M.Robed, weapon: W.Staff, head: H.Antlers, tint: "#7a5a3a" } },
      { id: "ash_beastmaster", classes: [{ id: "warrior", spec: "warrior_dual" }], name: "Укротитель", title: "Брат зверей", description: "Ездит на волке, ведёт зверей и всадников.",
        relic: { name: "Клык Старого Волка", description: "Звери получают +1 к скорости." }, armyBonus: "+1 к скорости зверей", bonus: { tags: [T.Beast], effect: { stat: "speed", value: 1 } },
        model: { body: M.Rider, weapon: W.Spear, head: H.Feather, tint: "#6b6f74" } },
      { id: "ash_berserker", classes: [{ id: "warrior", spec: "warrior_twohand" }], name: "Берсерк", title: "Красная ярость", description: "Чем меньше здоровья, тем сильнее бьёт.",
        relic: { name: "Цепной молот", description: "Убийство отряда даёт дополнительный ход." }, armyBonus: "+10% урона при здоровье ниже половины", bonus: { tags: [] },
        model: { body: M.Giant, weapon: W.Hammer, head: H.Bare, tint: "#a3593a" } },
    ],
    tiers: tiers(FactionId.Ash, [
      [{ id: "ash_raider", name: "Налётчик", role: R.Melee, description: "Быстрый и злой, но слабо защищён.", initiative: 2, model: { body: M.Soldier, weapon: W.Axe, head: H.Bare, tint: "#6f8a3a" } },
       { id: "ash_brute", name: "Рубака", role: R.Melee, description: "Крепче налётчика, со щитом.", hp: 1.2, speed: -1, model: { body: M.Soldier, weapon: W.Sword, head: H.Horns, shield: true, tint: "#5e7a30" } }],
      [{ id: "ash_axethrower", name: "Метатель топоров", role: R.Ranged, description: "Метает топоры, хорош и вблизи.", model: { body: M.Soldier, weapon: W.TwinAxes, head: H.Feather, tint: "#7d8f4a" } },
       { id: "ash_slinger", name: "Пращник", role: R.Ranged, description: "Бьёт дальше, но слабее.", attack: -1, model: { body: M.Soldier, weapon: W.Sling, head: H.Hood, tint: "#8a6a4a" } }],
      [{ id: "ash_witchdoctor", name: "Знахарь", role: R.Caster, tags: [T.Shaman], description: "Лечит и проклинает врагов.", model: { body: M.Robed, weapon: W.Staff, head: H.Skull, tint: "#6a4a7a" } },
       { id: "ash_totemist", name: "Тотемщик", role: R.Caster, tags: [T.Shaman], description: "Ставит тотемы, усиливающие своих.", model: { body: M.Robed, weapon: W.Totem, head: H.Antlers, tint: "#7a5a3a" } }],
      [{ id: "ash_wolfrider", name: "Волчий всадник", role: R.Melee, tags: [T.Beast], description: "Быстрый всадник, бьёт и отходит.", speed: 3, model: { body: M.Rider, weapon: W.Axe, head: H.Bare, tint: "#6b6f74" } },
       { id: "ash_boarrider", name: "Наездник на вепре", role: R.Melee, tags: [T.Beast], description: "Медленнее, но сносит строй.", hp: 1.2, speed: 1, model: { body: M.Rider, weapon: W.Spear, head: H.Horns, tint: "#5a3a2a" } }],
      [{ id: "ash_ogre", name: "Огр-громила", role: R.Melee, description: "Огромный, много здоровья.", hp: 1.3, model: { body: M.Giant, weapon: W.Hammer, head: H.Bare, tint: "#8a7a5a" } },
       { id: "ash_ogremage", name: "Огр-чародей", role: R.Caster, tags: [T.Shaman], description: "Огр, выучивший пару заклинаний.", attack: 2, model: { body: M.Giant, weapon: W.Staff, head: H.Hood, tint: "#5a6a9a" } }],
      [{ id: "ash_catapult", name: "Камнемёт", role: R.Siege, description: "Бросает камни через поле.", model: { body: M.Siege, weapon: W.None, head: H.Bare, tint: "#6e4a2a" } },
       { id: "ash_ram", name: "Таран", role: R.Siege, description: "Медленно едет и крушит всё перед собой.", hp: 1.4, model: { body: M.Siege, weapon: W.Hammer, head: H.Horns, tint: "#5a3a22" } }],
      [{ id: "ash_wyvern", name: "Виверна", role: R.Flyer, description: "Летучий ящер с ядовитым хвостом.", model: { body: M.Dragon, weapon: W.Claws, head: H.Horns, wings: true, tint: "#7a3a2a" } },
       { id: "ash_mammoth", name: "Боевой мамонт", role: R.Melee, description: "Живая крепость с наездниками.", hp: 1.3, speed: 0, model: { body: M.Beast, weapon: W.None, head: H.Horns, tint: "#6a5040" } }],
    ]),
  },
  {
    id: FactionId.Rot,
    name: "Ковен Тлена",
    motto: "Смерть служит нам",
    description: "Повелители нежити: дешёвые толпы, призраки и костяные драконы.",
    color: "#5b2f86",
    accent: "#7ee07a",
    heroes: [
      { id: "rot_necromancer", classes: [{ id: "mage", spec: "mage_ice" }], name: "Некромант", title: "Собиратель душ", description: "Поднимает павших врагов в армию.",
        relic: { name: "Череп Шёпотов", description: "После боя часть павших встаёт скелетами." }, armyBonus: "+10% к поднятию нежити", bonus: { tags: [] },
        model: { body: M.Robed, weapon: W.Staff, head: H.Hood, tint: "#2e2a3a" } },
      { id: "rot_deathknight", classes: [{ id: "warrior", spec: "warrior_twohand" }, { id: "mage", spec: "mage_ice" }], name: "Рыцарь тлена", title: "Чёрный клинок", description: "Мёртвый рыцарь, ведёт конницу мертвецов.",
        relic: { name: "Хладный меч", description: "Удар замедляет цель." }, armyBonus: "+2 к атаке всадников", bonus: { tags: [T.Rider], effect: { stat: "attack", value: 2 } },
        model: { body: M.Knight, weapon: W.Sword, head: H.Horns, cape: true, tint: "#3c4250" } },
      { id: "rot_lich", classes: [{ id: "mage", spec: "mage_earth" }], name: "Костяной лорд", title: "Неумирающий", description: "Древний маг, его проклятия ослабляют врага.",
        relic: { name: "Филактерия", description: "Один раз за бой герой встаёт после смерти." }, armyBonus: "-1 к защите врагов", bonus: { tags: [], enemies: true, effect: { stat: "defense", value: -1 } },
        model: { body: M.Spirit, weapon: W.Staff, head: H.Crown, tint: "#bfc8c0" } },
      { id: "rot_vampire", classes: [{ id: "monk", spec: "monk_arts" }, { id: "mage", spec: "mage_fire" }], name: "Вампирша", title: "Госпожа крови", description: "Пьёт жизнь врагов и лечит свои отряды.",
        relic: { name: "Кубок Алой Ночи", description: "Удары героя восстанавливают здоровье." }, armyBonus: "+5% вампиризма", bonus: { tags: [] },
        model: { body: M.Robed, weapon: W.Sword, head: H.Crown, cape: true, tint: "#6a1a2a" } },
    ],
    tiers: tiers(FactionId.Rot, [
      [{ id: "rot_skeleton", name: "Скелет", role: R.Melee, description: "Дешёвый, не чувствует страха.", model: { body: M.Soldier, weapon: W.Sword, head: H.Skull, shield: true, tint: "#d8d2c0" } },
       { id: "rot_ghoul", name: "Гуль", role: R.Melee, description: "Быстрый, раны заживают поеданием павших.", initiative: 2, model: { body: M.Soldier, weapon: W.Claws, head: H.Bare, tint: "#7a8a6a" } }],
      [{ id: "rot_skelarcher", name: "Скелет-лучник", role: R.Ranged, description: "Стреляет костяными стрелами.", model: { body: M.Soldier, weapon: W.Bow, head: H.Skull, tint: "#d8d2c0" } },
       { id: "rot_spitter", name: "Чумной плевун", role: R.Ranged, description: "Плюётся ядом, ослабляя броню.", attack: -1, model: { body: M.Beast, weapon: W.None, head: H.Bare, tint: "#6a8a3a" } }],
      [{ id: "rot_wraith", name: "Призрак", role: R.Flyer, description: "Проходит сквозь врагов, трудно попасть.", hp: 0.9, model: { body: M.Spirit, weapon: W.Scythe, head: H.Hood, tint: "#8aa0b8" } },
       { id: "rot_banshee", name: "Банши", role: R.Caster, description: "Крик снижает боевой дух врагов.", model: { body: M.Spirit, weapon: W.None, head: H.Bare, tint: "#b8c8d8" } }],
      [{ id: "rot_gargoyle", name: "Горгулья", role: R.Flyer, description: "Каменная, почти не боится магии.", defense: 2, model: { body: M.Flyer, weapon: W.Claws, head: H.Horns, wings: true, tint: "#6a6a72" } },
       { id: "rot_bat", name: "Нетопырь", role: R.Flyer, description: "Пьёт кровь и возвращается.", speed: 2, hp: 0.8, model: { body: M.Flyer, weapon: W.Claws, head: H.Bare, wings: true, tint: "#3a2a3a" } }],
      [{ id: "rot_abomination", name: "Мясной голем", role: R.Melee, description: "Сшит из павших, огромный запас здоровья.", hp: 1.4, speed: -1, model: { body: M.Giant, weapon: W.Axe, head: H.Bare, tint: "#9a8a7a" } },
       { id: "rot_deadrider", name: "Всадник-мертвец", role: R.Melee, description: "Конница мёртвых, вселяет ужас.", speed: 1, model: { body: M.Rider, weapon: W.Spear, head: H.Skull, cape: true, tint: "#3c4250" } }],
      [{ id: "rot_bonecatapult", name: "Костемёт", role: R.Siege, description: "Метает черепа, заражая врагов.", model: { body: M.Siege, weapon: W.None, head: H.Skull, tint: "#5a4a5a" } },
       { id: "rot_plaguecart", name: "Чумная телега", role: R.Siege, description: "Оставляет ядовитое облако.", model: { body: M.Siege, weapon: W.Scythe, head: H.Bare, tint: "#4a5a3a" } }],
      [{ id: "rot_bonedragon", name: "Костяной дракон", role: R.Flyer, description: "Скелет древнего дракона.", model: { body: M.Dragon, weapon: W.Claws, head: H.Skull, wings: true, tint: "#d8d2c0" } },
       { id: "rot_reaper", name: "Тёмный жнец", role: R.Melee, description: "Каждый удар может убить сразу несколько существ.", attack: 3, hp: 0.85, model: { body: M.Spirit, weapon: W.Scythe, head: H.Hood, tint: "#1e1a26" } }],
    ]),
  },
  {
    id: FactionId.Grove,
    name: "Лесной Круг",
    motto: "Корни помнят",
    description: "Хранители лесов: меткие стрелки, звери, феи и живые деревья.",
    color: "#2f7a4a",
    accent: "#b8a0f0",
    heroes: [
      { id: "grove_druid", classes: [{ id: "monk", spec: "monk_healing" }, { id: "mage", spec: "mage_earth" }], name: "Верховный друид", title: "Голос леса", description: "Превращается в зверя и лечит армию.",
        relic: { name: "Посох Первого Дуба", description: "Отряды в начале хода лечатся." }, armyBonus: "+10% здоровья зверей", bonus: { tags: [T.Beast], effect: { stat: "hp", value: 0.1 } },
        model: { body: M.Robed, weapon: W.Staff, head: H.Antlers, tint: "#5a7a3a" } },
      { id: "grove_huntress", classes: [{ id: "warrior", spec: "warrior_dual" }], name: "Охотница", title: "Тень опушки", description: "Лучшая лучница леса, ведёт стрелков.",
        relic: { name: "Лук Лунного Серпа", description: "Выстрелы героя проходят сквозь цель." }, armyBonus: "+1 к атаке стрелков", bonus: { tags: [T.Shooter], effect: { stat: "attack", value: 1 } },
        model: { body: M.Soldier, weapon: W.Bow, head: H.Hood, cape: true, tint: "#3a6a4a" } },
      { id: "grove_warden", classes: [{ id: "warrior", spec: "warrior_shield" }, { id: "monk", spec: "monk_healing" }], name: "Страж рощи", title: "Шипы и кора", description: "Танк леса, отражает урон обратно.",
        relic: { name: "Кора Древня", description: "Атакующие героя получают урон шипами." }, armyBonus: "+2 к защите древней", bonus: { tags: [T.Treant], effect: { stat: "defense", value: 2 } },
        model: { body: M.Knight, weapon: W.Spear, head: H.Antlers, shield: true, tint: "#6a5a3a" } },
      { id: "grove_moonpriestess", classes: [{ id: "monk", spec: "monk_light" }, { id: "mage", spec: "mage_air" }], name: "Жрица луны", title: "Серебряный свет", description: "Магия луны и звёзд, усиливает фей.",
        relic: { name: "Лунный венец", description: "Ночью заклинания сильнее." }, armyBonus: "+15% урона заклинателей", bonus: { tags: [T.Caster], effect: { stat: "damage", value: 0.15 } },
        model: { body: M.Robed, weapon: W.Staff, head: H.Crown, cape: true, tint: "#7a6ab8" } },
    ],
    tiers: tiers(FactionId.Grove, [
      [{ id: "grove_tracker", name: "Следопыт", role: R.Melee, description: "Лёгкий боец с клинками, бьёт первым.", initiative: 3, model: { body: M.Soldier, weapon: W.Sword, head: H.Hood, tint: "#4a6a3a" } },
       { id: "grove_sprite", name: "Лесной дух", role: R.Flyer, description: "Маленький, быстрый и хрупкий.", hp: 0.7, model: { body: M.Spirit, weapon: W.None, head: H.Bare, wings: true, tint: "#9ad08a" } }],
      [{ id: "grove_archer", name: "Лучница", role: R.Ranged, description: "Два выстрела за ход.", model: { body: M.Soldier, weapon: W.Bow, head: H.Feather, tint: "#3a6a4a" } },
       { id: "grove_panther", name: "Боевая пантера", role: R.Melee, description: "Прыгает к стрелкам врага.", speed: 2, model: { body: M.Beast, weapon: W.Claws, head: H.Bare, tint: "#2a2a3a" } }],
      [{ id: "grove_dryad", name: "Дриада", role: R.Caster, description: "Опутывает врага корнями.", model: { body: M.Robed, weapon: W.None, head: H.Antlers, tint: "#6a9a4a" } },
       { id: "grove_fairy", name: "Фея", role: R.Caster, description: "Лечит и усыпляет.", hp: 0.8, model: { body: M.Spirit, weapon: W.Staff, head: H.Crown, wings: true, tint: "#d0a0e0" } }],
      [{ id: "grove_hippogryph", name: "Наездница гиппогрифа", role: R.Flyer, description: "Летает над полем и бьёт сверху.", model: { body: M.Flyer, weapon: W.Spear, head: H.Feather, wings: true, tint: "#c8b090" } },
       { id: "grove_bear", name: "Медведь-оборотень", role: R.Melee, description: "Друид в облике медведя.", hp: 1.3, model: { body: M.Beast, weapon: W.Claws, head: H.Bare, tint: "#6a4a2a" } }],
      [{ id: "grove_unicorn", name: "Единорог", role: R.Melee, description: "Слепит врага сиянием рога.", model: { body: M.Beast, weapon: W.Spear, head: H.Bare, tint: "#eeeaf4" } },
       { id: "grove_stag", name: "Звёздный олень", role: R.Caster, description: "Рога светятся и лечат отряды рядом.", model: { body: M.Beast, weapon: W.None, head: H.Antlers, tint: "#8a6a4a" } }],
      [{ id: "grove_treant", name: "Древень", role: R.Melee, description: "Живое дерево, держит удар.", hp: 1.4, speed: -1, model: { body: M.Tree, weapon: W.None, head: H.Bare, tint: "#6a4a2a" } },
       { id: "grove_rootthrower", name: "Корнеплёт", role: R.Siege, description: "Метает валуны, опутанные корнями.", model: { body: M.Tree, weapon: W.Hammer, head: H.Antlers, tint: "#5a4a2a" } }],
      [{ id: "grove_giant", name: "Лесной великан", role: R.Melee, description: "Каменная кожа и дубина-бревно.", hp: 1.1, model: { body: M.Giant, weapon: W.Hammer, head: H.Antlers, tint: "#7a8a8a" } },
       { id: "grove_dragon", name: "Изумрудный дракон", role: R.Flyer, description: "Дыхание погружает врагов в сон.", model: { body: M.Dragon, weapon: W.Claws, head: H.Horns, wings: true, tint: "#3a8a5a" } }],
    ]),
  },
];

const factionById = new Map<string, Faction>(FACTIONS.map((f) => [f.id, f]));
const unitById = new Map<string, UnitDef>(FACTIONS.flatMap((f) => f.tiers.flatMap((t) => t.units.map((u): [string, UnitDef] => [u.id, u]))));
const unitFaction = new Map<string, FactionId>(FACTIONS.flatMap((f) => f.tiers.flatMap((t) => t.units.map((u): [string, FactionId] => [u.id, f.id]))));

/** Whether a hero bonus boosts this unit (own army; enemy bonuses work on every enemy stack). */
export const bonusApplies = (rule: ArmyBonusRule, unit: Pick<UnitDef, "tags">): boolean =>
  !rule.enemies && (rule.tags.length === 0 || rule.tags.some((t) => unit.tags.includes(t)));

export const getFaction = (id: string): Faction | undefined => factionById.get(id);
export const getUnit = (id: string): UnitDef | undefined => unitById.get(id);
export const getFactionHero = (faction: Faction, heroId: string): FactionHero | undefined => faction.heroes.find((h) => h.id === heroId);

export function isFactionId(value: string): value is FactionId {
  return factionById.has(value);
}

/** Normalizes untrusted input into army stacks (does not check game rules). */
export function parseArmy(raw: unknown): ArmyStack[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((s: unknown) => {
    const isObject = typeof s === "object" && s !== null;
    const unitId = isObject && "unitId" in s ? String(s.unitId) : "";
    const count = isObject && "count" in s ? Math.floor(Number(s.count)) : 0;
    return { unitId, count: Number.isFinite(count) ? count : 0 };
  });
}

export const armyCost = (army: ArmyStack[]): number =>
  army.reduce((sum, s) => sum + (getUnit(s.unitId)?.cost ?? 0) * s.count, 0);

/** Returns an error message, or null if the army is legal for this faction and level. */
export function validateArmy({ army, faction, level }: { army: ArmyStack[]; faction: FactionId; level: number }): string | null {
  if (army.length > MAX_ARMY_STACKS) return `Не больше ${MAX_ARMY_STACKS} отрядов`;
  const ids = army.map((s) => s.unitId);
  if (new Set(ids).size !== ids.length) return "Каждый вид войск можно взять только одним отрядом";
  const bad = army.find((s) => !getUnit(s.unitId) || unitFaction.get(s.unitId) !== faction);
  if (bad) return "В армии могут быть только войска своей фракции";
  if (army.some((s) => s.count < 1)) return "В отряде должно быть хотя бы одно существо";
  const locked = army.find((s) => level < TIER_UNLOCK_LEVEL[(getUnit(s.unitId)?.tier ?? 1) - 1]);
  if (locked) return `«${getUnit(locked.unitId)?.name}» откроется на ${TIER_UNLOCK_LEVEL[(getUnit(locked.unitId)?.tier ?? 1) - 1]} уровне`;
  const cost = armyCost(army);
  if (cost > leadership(level)) return `Не хватает лидерства: нужно ${cost}, есть ${leadership(level)}`;
  return null;
}

/**
 * The starting army: the first variant of every unlocked tier, leadership split evenly
 * between them (rounded down, so the army always fits).
 */
export function defaultArmy({ faction, level }: { faction: FactionId; level: number }): ArmyStack[] {
  const f = getFaction(faction);
  if (!f) return [];
  const open = f.tiers.filter((t) => t.unlockLevel <= level).map((t) => t.units[0]);
  const share = Math.floor(leadership(level) / open.length);
  return open.map((u) => ({ unitId: u.id, count: Math.floor(share / u.cost) })).filter((s) => s.count > 0);
}

/** Level at which a faction hero's second class line opens. */
export const SECOND_LINE_LEVEL = 6;
const MAX_LINE_RANK = 5;

/**
 * Class ranks of a faction hero at a level. The hero gets 1 rank at level 1 and +1 every 3rd level.
 * With two lines, the second one opens at level 6 and gets a third of the ranks (at least 1).
 */
export function heroClasses({ hero, level }: { hero: FactionHero; level: number }): (HeroClassLine & { rank: number })[] {
  const points = 1 + Math.floor(level / 3);
  const [main, second] = hero.classes;
  const secondRank = second && level >= SECOND_LINE_LEVEL ? Math.min(MAX_LINE_RANK, Math.max(1, Math.floor(points / 3))) : 0;
  const mainRank = Math.min(MAX_LINE_RANK, points - secondRank);
  const lines = [{ ...main, rank: mainRank }];
  return secondRank && second ? [...lines, { ...second, rank: secondRank }] : lines;
}

/** The faction hero chosen by this hero row, if any. */
export function factionHeroOf({ faction, heroId }: { faction: string | null; heroId: string | null }): FactionHero | undefined {
  const f = faction ? getFaction(faction) : undefined;
  return f && heroId ? getFactionHero(f, heroId) : undefined;
}
