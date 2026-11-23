/**
 * Turn-based battle on a grid (game version 0.1). Pure logic, no DB: the whole battle
 * state is a JSON-serializable object stored in `battles.state`.
 * The server is authoritative: the client only sends intents (move / skill / end turn).
 *
 * - Turn order comes from an initiative timeline: every turn costs 100 / (1 + speedBonus)
 *   time units, so a faster hero sometimes gets an extra turn (speed bonus is capped at 15%).
 * - Each turn: movement, one action, one bonus action; one reaction per own turn cycle.
 * - Two armor types (physical, magic) absorb damage of their type before HP;
 *   control effects only land when the matching armor is broken.
 * - Armies: each hero brings up to 7 stacks of creatures. Stacks take their own turns on the same
 *   initiative timeline (move + one attack), melee attacks on a stack get one counter-attack per turn cycle.
 *   The battle is decided by the heroes: it ends when a hero falls.
 */
import type { CombatProfile } from "./build.js";
import { skillById } from "./build.js";
import type { ArmorType, DamageType, PassiveMods, ScaleStat, Skill } from "./classes.js";
import { getUnit, UnitRole, type ArmyStack } from "./factions.js";

export type Side = "player" | "bot";
export type Rng = () => number;
export type Cell = [number, number];

export interface DotEffect {
  name: string;
  perTick: number;
  damageType: DamageType;
  turns: number;
}

export interface Armor {
  current: number;
  max: number;
}

export interface Unit {
  side: Side;
  name: string;
  level: number;
  className: string;
  maxHp: number;
  hp: number;
  maxMana: number;
  mana: number;
  armor: Record<ArmorType, Armor>;
  stats: Record<ScaleStat, number> & { initiative: number };
  moveRange: number;
  speedBonus: number;
  dodge: number;
  parry: number;
  x: number;
  y: number;
  movesLeft: number;
  actionUsed: boolean;
  bonusUsed: boolean;
  reactionUsed: boolean;
  /** Basic attack first, then loadout skills. */
  skills: string[];
  cooldowns: Record<string, number>;
  dots: DotEffect[];
  stunned: number;
  /** Own turns left during which new stuns do not land. */
  stunImmune: number;
  talents: string[];
  mods: PassiveMods;
  lastStandUsed: boolean;
}

/** A stack of identical creatures from the hero's army. `id` is stable for the whole battle. */
export interface Stack {
  id: string;
  side: Side;
  unitId: string;
  name: string;
  tier: number;
  ranged: boolean;
  flyer: boolean;
  count: number;
  startCount: number;
  hpPer: number;
  /** HP of the top creature of the stack (the others are at full HP). */
  hpTop: number;
  attack: number;
  defense: number;
  damage: [number, number];
  initiative: number;
  speed: number;
  x: number;
  y: number;
  /** Movement already used this turn. */
  moved: boolean;
  /** Attack already made this turn. */
  attacked: boolean;
  /** Counter-attack already used since the stack's last own turn. */
  retaliated: boolean;
}

export type BattleStatus = "active" | "won" | "lost";
/** "bot": the "bot" side is played by the AI. "pvp": both sides are players, "player" is the challenge creator. */
export type BattleMode = "bot" | "pvp";

export interface BattleState {
  version: 2;
  /** Missing in bot battles saved before PvP existed: treated as "bot". */
  mode?: BattleMode;
  width: number;
  height: number;
  obstacles: Cell[];
  units: Record<Side, Unit>;
  /** Army stacks of both sides (missing in battles created before armies). Dead stacks stay with count 0. */
  stacks?: Stack[];
  /** Side whose actor (hero or stack) acts now. */
  turn: Side;
  /** Actor acting now: a hero ("player" / "bot") or a stack id. Missing = the hero of `turn`. */
  active?: string;
  /** Initiative timeline: when each actor (hero side or stack id) acts next. */
  nextTime: Record<string, number>;
  /** Who acts first when both are due at the same time. */
  tieFirst: Side;
  time: number;
  round: number;
  status: BattleStatus;
  log: string[];
}

export type BattleEvent =
  | { type: "move"; side: Side; path: Cell[] }
  | { type: "skill"; side: Side; skillId: string; target: Cell }
  | { type: "damage"; side: Side; amount: number; armor: number; damageType: DamageType; source: string }
  | { type: "heal"; side: Side; amount: number }
  | { type: "armor"; side: Side; armor: ArmorType; amount: number }
  | { type: "miss"; side: Side; reason: "dodge" | "parry" }
  | { type: "stun"; side: Side }
  | { type: "reaction"; side: Side; name: string }
  | { type: "turn"; side: Side; round: number; actor?: string }
  | { type: "stack-move"; side: Side; id: string; path: Cell[] }
  | { type: "stack-attack"; side: Side; id: string; target: Cell; ranged: boolean }
  | { type: "stack-damage"; side: Side; id: string; amount: number; killed: number }
  | { type: "end"; status: BattleStatus };

export type BattleAction =
  | { type: "move"; x: number; y: number }
  | { type: "skill"; skillId: string; x: number; y: number }
  | { type: "attack"; x: number; y: number }
  /** Auto battle: the AI plays the current actor of this side (hero or stack) and ends its turn. */
  | { type: "auto" }
  | { type: "end_turn" }
  | { type: "surrender" };

export class BattleError extends Error {}

const LOG_LIMIT = 80;
export const GRID_WIDTH = 10;
export const GRID_HEIGHT = 7;
/** Bigger field when armies take part. */
export const ARMY_GRID_WIDTH = 12;
export const ARMY_GRID_HEIGHT = 8;
const ARMY_OBSTACLES: Cell[] = [
  [5, 1],
  [6, 6],
  [5, 4],
  [6, 3],
];
/** Stack damage to heroes is scaled down so a hero is not one-shot by a full army. */
export const STACK_VS_HERO = 0.35;
/** Rows for stacks next to the hero, strongest first in the middle. */
const STACK_ROWS = [3, 4, 2, 5, 1, 6, 0, 7];
export const MANA_REGEN_PER_TURN = 10;
/** Global damage multiplier (damage and damage over time). Main knob for battle length. */
export const DAMAGE_SCALE = 1.5;
/** Time units of one turn at base speed; one round = this many units. */
export const TURN_TIME = 100;
const OBSTACLES: Cell[] = [
  [4, 1],
  [5, 5],
  [4, 4],
];

export interface Fighter {
  name: string;
  level: number;
  profile: CombatProfile;
  /** Army stacks the hero brings (optional). */
  army?: ArmyStack[];
}

function makeStacks(side: Side, army: ArmyStack[], column: number, prefix: string): Stack[] {
  const units = army.flatMap((a) => {
    const u = getUnit(a.unitId);
    return u && a.count > 0 ? [{ u, count: a.count }] : [];
  });
  const ordered = [...units].sort((a, b) => b.u.tier - a.u.tier);
  return ordered.slice(0, STACK_ROWS.length).map(({ u, count }, i) => ({
    id: `${prefix}${i}`,
    side,
    unitId: u.id,
    name: u.name,
    tier: u.tier,
    ranged: u.role === UnitRole.Ranged || u.role === UnitRole.Siege,
    flyer: u.role === UnitRole.Flyer,
    count,
    startCount: count,
    hpPer: u.hp,
    hpTop: u.hp,
    attack: u.attack,
    defense: u.defense,
    damage: [u.damage[0], u.damage[1]],
    initiative: u.initiative,
    speed: u.speed,
    x: column,
    y: STACK_ROWS[i],
    moved: false,
    attacked: false,
    retaliated: false,
  }));
}

function makeUnit(side: Side, f: Fighter, x: number, y: number): Unit {
  const p = f.profile;
  return {
    side,
    name: f.name,
    level: f.level,
    className: p.className,
    maxHp: p.maxHp,
    hp: p.maxHp,
    maxMana: p.maxMana,
    mana: p.maxMana,
    armor: {
      physical: { current: p.physicalArmor, max: p.physicalArmor },
      magic: { current: p.magicArmor, max: p.magicArmor },
    },
    stats: { strength: p.stats.strength, dexterity: p.stats.dexterity, intellect: p.stats.intellect, initiative: p.stats.initiative },
    moveRange: p.moveRange,
    speedBonus: p.speedBonus,
    dodge: p.dodge,
    parry: p.parry,
    x,
    y,
    movesLeft: p.moveRange,
    actionUsed: false,
    bonusUsed: false,
    reactionUsed: false,
    skills: [p.basicSkill, ...p.skills],
    cooldowns: {},
    dots: [],
    stunned: 0,
    stunImmune: 0,
    talents: [...p.talents],
    mods: { ...p.mods },
    lastStandUsed: false,
  };
}

const turnLength = (u: Unit) => TURN_TIME / (1 + u.speedBonus);

/**
 * Creates the battle. Higher Инициатива acts first (a tie is random).
 * If the bot goes first, call `startBattle` to play its opening turn.
 */
export function createBattle(player: Fighter, bot: Fighter, rng: Rng = Math.random, mode: BattleMode = "bot"): BattleState {
  const hasArmies = Boolean(player.army?.length || bot.army?.length);
  const width = hasArmies ? ARMY_GRID_WIDTH : GRID_WIDTH;
  const height = hasArmies ? ARMY_GRID_HEIGHT : GRID_HEIGHT;
  const mid = Math.floor(height / 2) - (hasArmies ? 1 : 0);
  const pi = player.profile.stats.initiative;
  const bi = bot.profile.stats.initiative;
  const first: Side = pi > bi ? "player" : bi > pi ? "bot" : rng() < 0.5 ? "player" : "bot";
  const stacks = hasArmies
    ? [...makeStacks("player", player.army ?? [], 1, "a"), ...makeStacks("bot", bot.army ?? [], width - 2, "b")]
    : [];
  const state: BattleState = {
    version: 2,
    mode,
    width,
    height,
    obstacles: (hasArmies ? ARMY_OBSTACLES : OBSTACLES).map((c): Cell => [c[0], c[1]]),
    units: {
      player: makeUnit("player", player, 0 + (hasArmies ? 0 : 1), mid),
      bot: makeUnit("bot", bot, width - (hasArmies ? 1 : 2), mid),
    },
    stacks,
    turn: first,
    active: first,
    nextTime: Object.fromEntries([["player", 0], ["bot", 0], ...stacks.map((st): [string, number] => [st.id, 0])]),
    tieFirst: first,
    time: 0,
    round: 1,
    status: "active",
    log: [
      `Бой начался: ${player.name} (${player.profile.className}) против ${bot.name} (${bot.profile.className}).`,
    ],
  };
  const firstActor = pickNextActor(state);
  state.active = firstActor;
  state.turn = actorSide(state, firstActor);
  const firstName = actorName(state, firstActor);
  log(state, hasArmies ? `Первым ходит ${firstName} (самая высокая инициатива).` : `Инициатива ${pi} против ${bi}. Первым ходит ${firstName}.`);
  log(state, state.turn === "player" && mode !== "pvp" && firstActor === "player" ? "Раунд 1. Ваш ход." : `Раунд 1. Ход: ${firstName}.`);
  return state;
}

// ---------- Actors: heroes and stacks on one timeline ----------

const isHeroId = (id: string): id is Side => id === "player" || id === "bot";
export const livingStacks = (state: BattleState): Stack[] => (state.stacks ?? []).filter((st) => st.count > 0);
export const stackById = (state: BattleState, id: string): Stack | undefined => (state.stacks ?? []).find((st) => st.id === id);
export const activeActor = (state: BattleState): string => state.active ?? state.turn;
export const activeStack = (state: BattleState): Stack | undefined => {
  const id = activeActor(state);
  return isHeroId(id) ? undefined : stackById(state, id);
};

function actorSide(state: BattleState, id: string): Side {
  return isHeroId(id) ? id : stackById(state, id)?.side ?? "player";
}

function actorName(state: BattleState, id: string): string {
  if (isHeroId(id)) return state.units[id].name;
  const st = stackById(state, id);
  return st ? `${st.name} (${st.count})` : id;
}

function actorInitiative(state: BattleState, id: string): number {
  return isHeroId(id) ? state.units[id].stats.initiative : stackById(state, id)?.initiative ?? 0;
}

function actorTurnLength(state: BattleState, id: string): number {
  if (isHeroId(id)) return turnLength(state.units[id]);
  const st = stackById(state, id);
  return (TURN_TIME * 10) / Math.max(1, st?.initiative ?? 10);
}

/** Living actors in a stable order: heroes first, then stacks by id. */
function actorIds(state: BattleState): string[] {
  return ["player", "bot", ...livingStacks(state).map((st) => st.id)];
}

/** Who acts next: earliest on the timeline; ties go to higher initiative, then `tieFirst`, then heroes. */
function pickNextActor(state: BattleState, next: Record<string, number> = state.nextTime): string {
  const eps = 1e-9;
  const ids = actorIds(state);
  const rank = (id: string) => [next[id] ?? 0, -actorInitiative(state, id), actorSide(state, id) === state.tieFirst ? 0 : 1, ids.indexOf(id)];
  return [...ids].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (Math.abs(ra[0] - rb[0]) > eps) return ra[0] - rb[0];
    return ra[1] - rb[1] || ra[2] - rb[2] || ra[3] - rb[3];
  })[0];
}

/** The next `count` actors on the initiative timeline, starting with the current one. */
export function actorQueue(state: BattleState, count = 8): { id: string; side: Side }[] {
  const next: Record<string, number> = { ...state.nextTime };
  const current = activeActor(state);
  const queue = [current];
  next[current] = (next[current] ?? 0) + actorTurnLength(state, current);
  while (queue.length < count) {
    const id = pickNextActor(state, next);
    queue.push(id);
    next[id] = (next[id] ?? 0) + actorTurnLength(state, id);
  }
  return queue.map((id) => ({ id, side: actorSide(state, id) }));
}

export const other = (side: Side): Side => (side === "player" ? "bot" : "player");

/** Chebyshev distance: diagonal steps count as 1. */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/**
 * Line of sight between two cell centers: blocked if the segment passes through an obstacle.
 * Touching an obstacle's corner does not block. Adjacent cells always see each other.
 */
export function hasLineOfSight(state: BattleState, ax: number, ay: number, bx: number, by: number): boolean {
  if (distance(ax, ay, bx, by) <= 1) return true;
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 16;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t;
    for (const [ox, oy] of state.obstacles) {
      if (Math.abs(px - ox) < 0.45 && Math.abs(py - oy) < 0.45) return false;
    }
  }
  return true;
}

/** Cells visible from the unit's position (for highlighting skill targets). */
export function visibleCells(state: BattleState, side: Side): Cell[] {
  const u = state.units[side];
  const cells: Cell[] = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (hasLineOfSight(state, u.x, u.y, x, y)) cells.push([x, y]);
    }
  }
  return cells;
}

export function unitSkill(id: string): Skill {
  const s = skillById(id);
  if (!s) throw new Error(`unknown skill ${id}`);
  return s;
}

/** The next `count` turns on the initiative timeline (sides only), starting with the current one. */
export function turnQueue(state: BattleState, count = 6): Side[] {
  return actorQueue(state, count).map((a) => a.side);
}

function log(state: BattleState, line: string) {
  state.log.push(line);
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

/** Who stands on the cell: a hero side, a living stack, or nothing. */
export function bodyAt(state: BattleState, x: number, y: number): { hero: Side } | { stack: Stack } | null {
  for (const side of ["player", "bot"] as const) {
    const u = state.units[side];
    if (u.x === x && u.y === y) return { hero: side };
  }
  const st = livingStacks(state).find((s) => s.x === x && s.y === y);
  return st ? { stack: st } : null;
}

const isObstacle = (state: BattleState, x: number, y: number) => state.obstacles.some(([ox, oy]) => ox === x && oy === y);
const outside = (state: BattleState, x: number, y: number) => x < 0 || y < 0 || x >= state.width || y >= state.height;

function isBlocked(state: BattleState, x: number, y: number, mover: string): boolean {
  if (outside(state, x, y) || isObstacle(state, x, y)) return true;
  const body = bodyAt(state, x, y);
  if (!body) return false;
  return "hero" in body ? body.hero !== mover : body.stack.id !== mover;
}

/** All cells the unit can reach with its remaining movement, with the shortest path to each (8 directions). */
export function reachableCells(state: BattleState, side: Side): Map<string, Cell[]> {
  const u = state.units[side];
  const result = new Map<string, Cell[]>();
  const queue: { cell: Cell; path: Cell[] }[] = [{ cell: [u.x, u.y], path: [] }];
  const seen = new Set([`${u.x},${u.y}`]);
  while (queue.length) {
    const { cell, path } = queue.shift()!;
    if (path.length >= u.movesLeft) continue;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = cell[0] + dx;
        const ny = cell[1] + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key) || isBlocked(state, nx, ny, side)) continue;
        seen.add(key);
        const next: Cell[] = [...path, [nx, ny]];
        result.set(key, next);
        queue.push({ cell: [nx, ny], path: next });
      }
    }
  }
  return result;
}

/** Mana the unit can spend, counting HP for Магия крови (2 HP per missing mana, never lethal). */
function canPay(unit: Unit, mana: number): boolean {
  if (unit.mana >= mana) return true;
  return unit.talents.includes("blood_magic") && unit.hp > (mana - unit.mana) * 2;
}

/** Why the skill cannot be used right now (ignoring target position), or null if it can. */
export function skillBlocker(unit: Unit, skill: Skill): string | null {
  if (!unit.skills.includes(skill.id)) return "Этого умения нет в бою";
  if (unit.stunned > 0) return "Вы оглушены";
  if (skill.cost === "action" && unit.actionUsed) return "Действие уже использовано";
  if (skill.cost === "bonus" && unit.bonusUsed) return "Бонусное действие уже использовано";
  if ((unit.cooldowns[skill.id] ?? 0) > 0) return "Умение перезаряжается";
  if (!canPay(unit, skill.mana)) return "Не хватает маны";
  return null;
}

function finish(state: BattleState, events: BattleEvent[]): boolean {
  if (state.status !== "active") return true;
  const { player, bot } = state.units;
  if (player.hp > 0 && bot.hp > 0) return false;
  state.status = bot.hp <= 0 ? "won" : "lost";
  if (state.mode === "pvp") {
    const [winner, loser] = state.status === "won" ? [player, bot] : [bot, player];
    log(state, `${loser.name} повержен. Победил ${winner.name}!`);
  } else {
    log(state, state.status === "won" ? `${bot.name} повержен. Победа!` : `${player.name} пал. Поражение.`);
  }
  events.push({ type: "end", status: state.status });
  return true;
}

const ARMOR_NAMES: Record<ArmorType, string> = { physical: "физическая", magic: "магическая" };

/** Damage goes into armor of its type first, then HP. Returns total absorbed + HP damage. */
function dealDamage(state: BattleState, target: Unit, raw: number, damageType: DamageType, source: string, events: BattleEvent[]): number {
  const amount = Math.max(1, Math.round(raw));
  const armor = target.armor[damageType];
  const toArmor = Math.min(armor.current, amount);
  armor.current -= toArmor;
  let toHp = amount - toArmor;
  if (toHp >= target.hp && target.talents.includes("last_stand") && !target.lastStandUsed) {
    target.lastStandUsed = true;
    toHp = target.hp - 1;
    log(state, `${target.name}: «Последний рубеж» — остаётся 1 здоровья.`);
  }
  target.hp = Math.max(0, target.hp - toHp);
  events.push({ type: "damage", side: target.side, amount: toHp, armor: toArmor, damageType, source });
  const parts = [toArmor ? `${toArmor} по броне (${ARMOR_NAMES[damageType]})` : "", toHp ? `${toHp} по здоровью` : ""].filter(Boolean);
  log(state, `${target.name} получает урон: ${parts.join(", ") || "0"} — ${source}.`);
  if (toArmor && armor.current === 0) log(state, `${target.name}: ${ARMOR_NAMES[damageType]} броня пробита.`);
  return amount;
}

function restoreArmor(state: BattleState, unit: Unit, type: ArmorType, amount: number, events: BattleEvent[]) {
  const a = unit.armor[type];
  const add = Math.min(a.max - a.current, Math.round(amount));
  if (add <= 0) return;
  a.current += add;
  events.push({ type: "armor", side: unit.side, armor: type, amount: add });
  log(state, `${unit.name} восстанавливает ${add} брони (${ARMOR_NAMES[type]}).`);
}

function payMana(state: BattleState, unit: Unit, mana: number) {
  if (unit.mana >= mana) {
    unit.mana -= mana;
    return;
  }
  const hpCost = (mana - unit.mana) * 2;
  unit.mana = 0;
  unit.hp -= hpCost;
  log(state, `${unit.name}: «Магия крови» — ${hpCost} здоровья вместо маны.`);
}

/** Damage effects of a skill against `target` (used by skills and reactions). */
function resolveEffects(state: BattleState, caster: Unit, target: Unit, skill: Skill, rng: Rng, events: BattleEvent[]) {
  const enemy = state.units[other(caster.side)];
  // Dodge / parry: only physical attacks; parry only in melee.
  const firstDamage = skill.effects.find((e) => e.type === "damage");
  if (skill.target === "enemy" && firstDamage?.type === "damage" && firstDamage.damageType === "physical") {
    if (rng() < enemy.dodge) {
      events.push({ type: "miss", side: enemy.side, reason: "dodge" });
      log(state, `${enemy.name} уклоняется от «${skill.name}».`);
      return;
    }
    if (distance(caster.x, caster.y, enemy.x, enemy.y) <= 1 && rng() < enemy.parry) {
      events.push({ type: "miss", side: enemy.side, reason: "parry" });
      log(state, `${enemy.name} парирует «${skill.name}».`);
      return;
    }
  }

  for (const effect of skill.effects) {
    switch (effect.type) {
      case "damage": {
        let mult = 1 + (effect.damageType === "physical" ? caster.mods.physicalDamage : caster.mods.magicDamage);
        if (skill.element && caster.mods.element === skill.element) mult += 0.15;
        if (effect.executeBelow && target.hp / target.maxHp < effect.executeBelow) mult *= 2;
        for (let h = 0; h < (effect.hits ?? 1) && state.status === "active"; h++) {
          const variance = 0.9 + rng() * 0.2;
          const raw = effect.power * DAMAGE_SCALE * caster.stats[effect.stat] * mult * variance;
          const dealt = dealDamage(state, target, raw, effect.damageType, skill.name, events);
          if (effect.damageType === "physical" && target !== caster) {
            if (caster.mods.armorOnHit) restoreArmor(state, caster, "physical", dealt * caster.mods.armorOnHit, events);
            if (caster.mods.magicOnPhysicalHit) dealDamage(state, target, dealt * caster.mods.magicOnPhysicalHit, "magic", "Зачарование", events);
          }
          if (finish(state, events)) return;
        }
        break;
      }
      case "heal": {
        const amount = Math.min(target.maxHp - target.hp, Math.round(effect.power * caster.stats[effect.stat] * (1 + caster.mods.healing)));
        target.hp += amount;
        events.push({ type: "heal", side: target.side, amount });
        log(state, `${target.name} восстанавливает ${amount} здоровья.`);
        break;
      }
      case "armor": {
        const types: ArmorType[] = effect.armor === "both" ? ["physical", "magic"] : [effect.armor];
        for (const t of types) restoreArmor(state, target, t, (target.armor[t].max * effect.percent) / 100, events);
        break;
      }
      case "dot": {
        const perTick = Math.max(1, Math.round(effect.power * DAMAGE_SCALE * caster.stats[effect.stat]));
        target.dots = target.dots.filter((d) => d.name !== effect.name);
        target.dots.push({ name: effect.name, perTick, damageType: effect.damageType, turns: effect.turns });
        log(state, `${target.name}: «${effect.name}» на ${effect.turns} хода.`);
        break;
      }
      case "stun": {
        if (target.armor[effect.gate].current > 0) {
          log(state, `${target.name}: ${ARMOR_NAMES[effect.gate]} броня защищает от эффекта «${effect.name}».`);
        } else if (target.stunImmune > 0) {
          log(state, `${target.name} ещё устойчив к контролю.`);
        } else {
          target.stunned = Math.max(target.stunned, effect.turns);
          events.push({ type: "stun", side: target.side });
          log(state, `${target.name}: «${effect.name}» на ${effect.turns} ход.`);
        }
        break;
      }
    }
    if (finish(state, events)) return;
  }
}

function applySkill(state: BattleState, caster: Unit, skill: Skill, rng: Rng, events: BattleEvent[], stackTarget?: Stack) {
  const enemy = state.units[other(caster.side)];
  const target = skill.target === "self" ? caster : enemy;
  const cell: Cell = stackTarget ? [stackTarget.x, stackTarget.y] : [target.x, target.y];
  events.push({ type: "skill", side: caster.side, skillId: skill.id, target: cell });
  log(state, `${caster.name} применяет «${skill.name}»${stackTarget ? ` по отряду «${stackTarget.name}»` : ""}.`);
  payMana(state, caster, skill.mana);
  if (skill.cooldown > 0) caster.cooldowns[skill.id] = skill.cooldown;
  if (skill.cost === "action") caster.actionUsed = true;
  else caster.bonusUsed = true;
  if (stackTarget) return skillOnStack(state, caster, stackTarget, skill, rng, events);
  resolveEffects(state, caster, target, skill, rng, events);
}

/** A hero skill against a stack: only damage applies (no armor, damage over time or control on stacks yet). */
function skillOnStack(state: BattleState, caster: Unit, target: Stack, skill: Skill, rng: Rng, events: BattleEvent[]) {
  for (const effect of skill.effects) {
    if (effect.type !== "damage") continue;
    const base = 1 + (effect.damageType === "physical" ? caster.mods.physicalDamage : caster.mods.magicDamage);
    const mult = base + (skill.element && caster.mods.element === skill.element ? 0.15 : 0);
    for (let h = 0; h < (effect.hits ?? 1) && target.count > 0; h++) {
      const raw = effect.power * DAMAGE_SCALE * caster.stats[effect.stat] * mult * (0.9 + rng() * 0.2);
      damageStack(state, target, raw, skill.name, events);
    }
  }
  const melee = distance(caster.x, caster.y, target.x, target.y) <= 1;
  const physical = skill.effects.some((e) => e.type === "damage" && e.damageType === "physical");
  if (melee && physical) counterAttack(state, target, { hero: caster.side }, rng, events);
}

function damageStack(state: BattleState, st: Stack, raw: number, source: string, events: BattleEvent[]) {
  const amount = Math.max(1, Math.round(raw));
  const before = st.count;
  const total = (st.count - 1) * st.hpPer + st.hpTop - amount;
  st.count = total <= 0 ? 0 : Math.ceil(total / st.hpPer);
  st.hpTop = total <= 0 ? 0 : total - (st.count - 1) * st.hpPer;
  const killed = before - st.count;
  events.push({ type: "stack-damage", side: st.side, id: st.id, amount, killed });
  log(state, `«${st.name}» получает ${amount} урона (${source})${killed ? `, погибло: ${killed}` : ""}${st.count ? "" : ". Отряд уничтожен"}.`);
}

/** Damage of one stack strike: count × random damage, scaled by attack against defense. */
function stackStrike(attacker: Stack, defense: number, rng: Rng): number {
  const [lo, hi] = attacker.damage;
  const perCreature = lo + rng() * (hi - lo);
  const diff = attacker.attack - defense;
  const mult = diff >= 0 ? Math.min(3, 1 + 0.05 * diff) : 1 / (1 + 0.05 * -diff);
  return attacker.count * perCreature * mult;
}

type StrikeTarget = { hero: Side } | { stack: Stack };

function strike(state: BattleState, attacker: Stack, target: StrikeTarget, rng: Rng, events: BattleEvent[], label: string) {
  if ("stack" in target) {
    damageStack(state, target.stack, stackStrike(attacker, target.stack.defense, rng), label, events);
    return;
  }
  const hero = state.units[target.hero];
  dealDamage(state, hero, stackStrike(attacker, 0, rng) * STACK_VS_HERO, "physical", label, events);
  finish(state, events);
}

/** A stack hit in melee strikes back once per its own turn cycle. */
function counterAttack(state: BattleState, defender: Stack, attacker: StrikeTarget, rng: Rng, events: BattleEvent[]) {
  if (state.status !== "active" || defender.count <= 0 || defender.retaliated) return;
  defender.retaliated = true;
  events.push({ type: "reaction", side: defender.side, name: "Ответный удар" });
  log(state, `«${defender.name}» наносит ответный удар.`);
  strike(state, defender, attacker, rng, events, `ответный удар «${defender.name}»`);
}

/** Оппортунист: an enemy leaving an adjacent cell takes a basic attack (reaction). */
function opportunityAttack(state: BattleState, mover: Unit, path: Cell[], from: Cell, rng: Rng, events: BattleEvent[]) {
  const reactor = state.units[other(mover.side)];
  if (!reactor.talents.includes("opportunist") || reactor.reactionUsed || reactor.stunned > 0) return;
  let prev = from;
  for (const step of path) {
    const wasAdjacent = distance(prev[0], prev[1], reactor.x, reactor.y) <= 1;
    const isAdjacent = distance(step[0], step[1], reactor.x, reactor.y) <= 1;
    if (wasAdjacent && !isAdjacent) {
      reactor.reactionUsed = true;
      const basicSkill = unitSkill(reactor.skills[0]);
      events.push({ type: "reaction", side: reactor.side, name: "Оппортунист" });
      log(state, `${reactor.name}: реакция «Оппортунист» — атака по уходящему ${mover.name}.`);
      resolveEffects(state, reactor, mover, basicSkill, rng, events);
      return;
    }
    prev = step;
  }
}

function doMove(state: BattleState, side: Side, x: number, y: number, rng: Rng, events: BattleEvent[]) {
  const u = state.units[side];
  if (u.stunned > 0) throw new BattleError("Вы оглушены");
  const path = reachableCells(state, side).get(`${x},${y}`);
  if (!path) throw new BattleError("Туда нельзя пройти");
  const from: Cell = [u.x, u.y];
  u.x = x;
  u.y = y;
  u.movesLeft -= path.length;
  events.push({ type: "move", side, path });
  opportunityAttack(state, u, path, from, rng, events);
}

function doSkill(state: BattleState, side: Side, skillId: string, x: number, y: number, rng: Rng, events: BattleEvent[]) {
  const u = state.units[side];
  const skill = skillById(skillId);
  if (!skill) throw new BattleError("Нет такого умения");
  const blocker = skillBlocker(u, skill);
  if (blocker) throw new BattleError(blocker);
  if (skill.target === "enemy") {
    const body = bodyAt(state, x, y);
    const stackTarget = body && "stack" in body && body.stack.side !== side ? body.stack : undefined;
    const isEnemyHero = Boolean(body && "hero" in body && body.hero !== side);
    if (!stackTarget && !isEnemyHero) throw new BattleError("Выберите противника как цель");
    if (distance(u.x, u.y, x, y) > skill.range) throw new BattleError("Цель слишком далеко");
    if (!hasLineOfSight(state, u.x, u.y, x, y)) throw new BattleError("Цель закрыта препятствием");
    if (stackTarget) return applySkill(state, u, skill, rng, events, stackTarget);
  }
  applySkill(state, u, skill, rng, events);
}

/** Start-of-turn upkeep: regen, cooldowns, damage over time, stun. Returns false if the unit skips the turn. */
function startTurn(state: BattleState, side: Side, events: BattleEvent[]): boolean {
  const u = state.units[side];
  state.turn = side;
  state.active = side;
  state.time = state.nextTime[side];
  const round = Math.floor(state.time / TURN_TIME + 1e-9) + 1;
  const newRound = round !== state.round;
  state.round = round;
  events.push({ type: "turn", side, round });
  const roundText = newRound ? `Раунд ${round}. ` : "";
  log(state, side === "player" && state.mode !== "pvp" ? `${roundText}Ваш ход.` : `${roundText}Ход: ${u.name}.`);

  u.movesLeft = u.moveRange;
  u.actionUsed = false;
  u.bonusUsed = false;
  u.reactionUsed = false;
  u.mana = Math.min(u.maxMana, u.mana + MANA_REGEN_PER_TURN);
  for (const id of Object.keys(u.cooldowns)) {
    u.cooldowns[id] -= 1;
    if (u.cooldowns[id] <= 0) delete u.cooldowns[id];
  }
  if (u.stunImmune > 0) u.stunImmune -= 1;
  for (const dot of u.dots) {
    dealDamage(state, u, dot.perTick, dot.damageType, dot.name, events);
    dot.turns -= 1;
    if (finish(state, events)) return false;
  }
  u.dots = u.dots.filter((d) => d.turns > 0);
  if (u.stunned > 0) {
    u.stunned -= 1;
    if (u.stunned === 0) u.stunImmune = 2;
    u.movesLeft = 0;
    u.actionUsed = true;
    u.bonusUsed = true;
    log(state, `${u.name} пропускает ход.`);
    return false;
  }
  return true;
}

function startStackTurn(state: BattleState, st: Stack, events: BattleEvent[]): boolean {
  state.turn = st.side;
  state.active = st.id;
  state.time = state.nextTime[st.id] ?? state.time;
  const round = Math.floor(state.time / TURN_TIME + 1e-9) + 1;
  const newRound = round !== state.round;
  state.round = round;
  events.push({ type: "turn", side: st.side, round, actor: st.id });
  log(state, `${newRound ? `Раунд ${round}. ` : ""}Ход отряда «${st.name}» (${st.count}).`);
  st.moved = false;
  st.attacked = false;
  st.retaliated = false;
  return true;
}

/** Start-of-turn for any actor. Returns false if it skips the turn. */
function startActorTurn(state: BattleState, id: string, events: BattleEvent[]): boolean {
  if (isHeroId(id)) return startTurn(state, id, events);
  const st = stackById(state, id);
  return st ? startStackTurn(state, st, events) : false;
}

function endTurn(state: BattleState, id: string) {
  state.nextTime[id] = (state.nextTime[id] ?? 0) + actorTurnLength(state, id);
}

// ---------- Stack actions ----------

/** Cells a stack can move to this turn, with paths. Flyers ignore obstacles and bodies on the way. */
export function stackReachable(state: BattleState, st: Stack): Map<string, Cell[]> {
  const result = new Map<string, Cell[]>();
  if (st.moved || st.attacked) return result;
  if (st.flyer) {
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if ((x === st.x && y === st.y) || distance(st.x, st.y, x, y) > st.speed || isBlocked(state, x, y, st.id)) continue;
        result.set(`${x},${y}`, [[x, y]]);
      }
    }
    return result;
  }
  const queue: { cell: Cell; path: Cell[] }[] = [{ cell: [st.x, st.y], path: [] }];
  const seen = new Set([`${st.x},${st.y}`]);
  while (queue.length) {
    const item = queue.shift();
    if (!item || item.path.length >= st.speed) continue;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = item.cell[0] + dx;
        const ny = item.cell[1] + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key) || isBlocked(state, nx, ny, st.id)) continue;
        seen.add(key);
        const path: Cell[] = [...item.path, [nx, ny]];
        result.set(key, path);
        queue.push({ cell: [nx, ny], path });
      }
    }
  }
  return result;
}

const enemyAt = (state: BattleState, side: Side, x: number, y: number): StrikeTarget | null => {
  const body = bodyAt(state, x, y);
  if (!body) return null;
  if ("hero" in body) return body.hero !== side ? body : null;
  return body.stack.side !== side ? body : null;
};

/** Enemy cells the stack can attack right now: anyone for shooters (line of sight), adjacent for melee. */
export function stackTargets(state: BattleState, st: Stack): Cell[] {
  if (st.attacked) return [];
  const enemies: Cell[] = [
    [state.units[other(st.side)].x, state.units[other(st.side)].y],
    ...livingStacks(state).filter((o) => o.side !== st.side).map((o): Cell => [o.x, o.y]),
  ];
  return enemies.filter(([x, y]) => (st.ranged ? hasLineOfSight(state, st.x, st.y, x, y) : distance(st.x, st.y, x, y) <= 1));
}

function doStackMove(state: BattleState, st: Stack, x: number, y: number, events: BattleEvent[]) {
  const path = stackReachable(state, st).get(`${x},${y}`);
  if (!path) throw new BattleError("Отряд не может туда пройти");
  st.x = x;
  st.y = y;
  st.moved = true;
  events.push({ type: "stack-move", side: st.side, id: st.id, path });
}

function doStackAttack(state: BattleState, st: Stack, x: number, y: number, rng: Rng, events: BattleEvent[]) {
  if (st.attacked) throw new BattleError("Отряд уже атаковал в этот ход");
  const target = enemyAt(state, st.side, x, y);
  if (!target) throw new BattleError("Выберите вражеский отряд или героя");
  if (!stackTargets(state, st).some(([tx, ty]) => tx === x && ty === y)) {
    throw new BattleError(st.ranged ? "Цель закрыта препятствием" : "Цель должна стоять рядом");
  }
  st.attacked = true;
  const melee = distance(st.x, st.y, x, y) <= 1;
  events.push({ type: "stack-attack", side: st.side, id: st.id, target: [x, y], ranged: !melee });
  const label = `«${st.name}» (${st.count})`;
  log(state, `${label} ${melee ? "атакует" : "стреляет"}.`);
  // Shooters strike at half power in melee.
  strike(state, melee && st.ranged ? { ...st, count: st.count / 2 } : st, target, rng, events, label);
  if (melee && "stack" in target) counterAttack(state, target.stack, { stack: st }, rng, events);
}

/** Simple AI for a stack: shoot or hit the enemy hero when possible, otherwise walk towards the nearest enemy. */
export function stackAi(state: BattleState, st: Stack, rng: Rng, events: BattleEvent[]) {
  const foeHero = state.units[other(st.side)];
  const score = ([x, y]: Cell) => (x === foeHero.x && y === foeHero.y ? 0 : 1);
  const pickTarget = () => [...stackTargets(state, st)].sort((a, b) => score(a) - score(b))[0];
  const now = pickTarget();
  if (now) return doStackAttack(state, st, now[0], now[1], rng, events);
  const enemies: Cell[] = [[foeHero.x, foeHero.y], ...livingStacks(state).filter((o) => o.side !== st.side).map((o): Cell => [o.x, o.y])];
  const nearest = (x: number, y: number) => Math.min(...enemies.map(([ex, ey]) => distance(x, y, ex, ey) + (ex === foeHero.x && ey === foeHero.y ? -0.5 : 0)));
  const options = [...stackReachable(state, st).keys()].map((k) => k.split(",").map(Number));
  const best = options.sort((a, b) => nearest(a[0], a[1]) - nearest(b[0], b[1]))[0];
  if (best && nearest(best[0], best[1]) < nearest(st.x, st.y)) doStackMove(state, st, best[0], best[1], events);
  const after = pickTarget();
  if (after && state.status === "active") doStackAttack(state, st, after[0], after[1], rng, events);
}

function applyStackAction(state: BattleState, st: Stack, action: BattleAction, rng: Rng, events: BattleEvent[]): boolean {
  switch (action.type) {
    case "move":
      doStackMove(state, st, action.x, action.y, events);
      // Nothing to hit after the move: the stack's turn ends by itself.
      return stackTargets(state, st).length === 0;
    case "attack":
      doStackAttack(state, st, action.x, action.y, rng, events);
      // An attack ends the stack's turn.
      return true;
    case "end_turn":
      return true;
    default:
      throw new BattleError("Сейчас ходит отряд: двигайте его или атакуйте");
  }
}

/** Plays one hero turn for the side whose turn it is (`state.turn`). */
export type BotTurn = (state: BattleState, act: (action: BattleAction) => void, rng: Rng) => void;

/**
 * Applies the player's action. On end_turn plays turns along the initiative timeline
 * (bot turns via `botTurn`) until the player can act again. Mutates `state`.
 */
export function applyPlayerAction(state: BattleState, action: BattleAction, botTurn: BotTurn, rng: Rng = Math.random): BattleEvent[] {
  if (state.status !== "active") throw new BattleError("Бой уже закончен");
  const events: BattleEvent[] = [];
  if (action.type === "surrender") {
    state.units.player.hp = 0;
    log(state, `${state.units.player.name} сдаётся.`);
    finish(state, events);
    return events;
  }
  if (state.turn !== "player") throw new BattleError("Сейчас не ваш ход");

  if (action.type === "auto") {
    const id = activeActor(state);
    autoPlay(state, "player", botTurn, rng, events);
    if (state.status !== "active") return events;
    endTurn(state, id);
    advance(state, botTurn, rng, events);
    return events;
  }
  const st = activeStack(state);
  if (st) {
    if (!applyStackAction(state, st, action, rng, events)) return events;
    endTurn(state, st.id);
    advance(state, botTurn, rng, events);
    return events;
  }
  switch (action.type) {
    case "move":
      doMove(state, "player", action.x, action.y, rng, events);
      return events;
    case "skill":
      doSkill(state, "player", action.skillId, action.x, action.y, rng, events);
      return events;
    case "end_turn":
      break;
    default:
      throw new BattleError("Неизвестное действие");
  }
  endTurn(state, "player");
  advance(state, botTurn, rng, events);
  return events;
}

/** Plays the bot's opening turn if it won initiative. Call once right after `createBattle`. */
export function startBattle(state: BattleState, botTurn: BotTurn, rng: Rng = Math.random): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (state.status === "active" && state.turn === "bot") {
    const first = activeActor(state);
    playBot(state, botTurn, rng, events);
    endTurn(state, first);
    advance(state, botTurn, rng, events);
  }
  return events;
}

/** Plays the current actor of `side` with the AI: a stack via stackAi, the hero via `heroAi` (plays `state.turn`). */
function autoPlay(state: BattleState, side: Side, heroAi: BotTurn, rng: Rng, events: BattleEvent[]) {
  const st = activeStack(state);
  if (st) return stackAi(state, st, rng, events);
  const act = (a: BattleAction) => {
    if (state.status !== "active") return;
    if (a.type === "move") doMove(state, side, a.x, a.y, rng, events);
    else if (a.type === "skill") doSkill(state, side, a.skillId, a.x, a.y, rng, events);
  };
  heroAi(state, act, rng);
}

function playBot(state: BattleState, botTurn: BotTurn, rng: Rng, events: BattleEvent[]) {
  const st = activeStack(state);
  if (st) return stackAi(state, st, rng, events);
  const act = (a: BattleAction) => {
    if (state.status !== "active") return;
    if (a.type === "move") doMove(state, "bot", a.x, a.y, rng, events);
    else if (a.type === "skill") doSkill(state, "bot", a.skillId, a.x, a.y, rng, events);
  };
  botTurn(state, act, rng);
}

/** Runs the timeline (bot turns, skipped stunned turns) until the player can act. */
function advance(state: BattleState, botTurn: BotTurn, rng: Rng, events: BattleEvent[]) {
  for (let guard = 0; guard < 200 && state.status === "active"; guard++) {
    const next = pickNextActor(state);
    const canAct = startActorTurn(state, next, events);
    if (state.status !== "active") return;
    if (canAct && actorSide(state, next) === "player") return;
    if (canAct) playBot(state, botTurn, rng, events);
    if (state.status !== "active") return;
    endTurn(state, next);
  }
}

/**
 * PvP: applies an action of `side` (both sides are players). On end_turn the initiative
 * timeline moves on to the next side that can act. Mutates `state`, returns what happened.
 */
export function applySideAction(state: BattleState, side: Side, action: BattleAction, rng: Rng = Math.random, heroAi: BotTurn = () => {}): BattleEvent[] {
  if (state.status !== "active") throw new BattleError("Бой уже закончен");
  const events: BattleEvent[] = [];
  if (action.type === "surrender") {
    state.units[side].hp = 0;
    log(state, `${state.units[side].name} сдаётся.`);
    finish(state, events);
    return events;
  }
  if (state.turn !== side) throw new BattleError("Сейчас не ваш ход");
  if (action.type === "auto") {
    const id = activeActor(state);
    autoPlay(state, side, heroAi, rng, events);
    if (state.status !== "active") return events;
    endTurn(state, id);
    advancePvp(state, events);
    return events;
  }
  const st = activeStack(state);
  if (st) {
    if (!applyStackAction(state, st, action, rng, events)) return events;
    endTurn(state, st.id);
    advancePvp(state, events);
    return events;
  }
  switch (action.type) {
    case "move":
      doMove(state, side, action.x, action.y, rng, events);
      return events;
    case "skill":
      doSkill(state, side, action.skillId, action.x, action.y, rng, events);
      return events;
    case "end_turn":
      endTurn(state, side);
      advancePvp(state, events);
      return events;
    default:
      throw new BattleError("Неизвестное действие");
  }
}

/** PvP: the side to move ran out of time, its turn ends automatically. */
export function timeoutTurn(state: BattleState): BattleEvent[] {
  if (state.status !== "active") return [];
  const events: BattleEvent[] = [];
  const id = activeActor(state);
  log(state, `${actorName(state, id)}: время хода вышло.`);
  endTurn(state, id);
  advancePvp(state, events);
  return events;
}

/** PvP: runs the timeline (skipping stunned turns) until someone can act. */
function advancePvp(state: BattleState, events: BattleEvent[]) {
  for (let guard = 0; guard < 200 && state.status === "active"; guard++) {
    const next = pickNextActor(state);
    if (startActorTurn(state, next, events)) return;
    if (state.status !== "active") return;
    endTurn(state, next);
  }
}
