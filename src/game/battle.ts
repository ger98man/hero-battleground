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
 */
import type { CombatProfile } from "./build.js";
import { skillById } from "./build.js";
import type { ArmorType, DamageType, PassiveMods, ScaleStat, Skill } from "./classes.js";

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

export type BattleStatus = "active" | "won" | "lost";

export interface BattleState {
  version: 2;
  width: number;
  height: number;
  obstacles: Cell[];
  units: Record<Side, Unit>;
  turn: Side;
  /** Initiative timeline: when each side acts next. */
  nextTime: Record<Side, number>;
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
  | { type: "turn"; side: Side; round: number }
  | { type: "end"; status: BattleStatus };

export type BattleAction =
  | { type: "move"; x: number; y: number }
  | { type: "skill"; skillId: string; x: number; y: number }
  | { type: "end_turn" }
  | { type: "surrender" };

export class BattleError extends Error {}

const LOG_LIMIT = 80;
export const GRID_WIDTH = 10;
export const GRID_HEIGHT = 7;
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
export function createBattle(player: Fighter, bot: Fighter, rng: Rng = Math.random): BattleState {
  const mid = Math.floor(GRID_HEIGHT / 2);
  const pi = player.profile.stats.initiative;
  const bi = bot.profile.stats.initiative;
  const first: Side = pi > bi ? "player" : bi > pi ? "bot" : rng() < 0.5 ? "player" : "bot";
  const firstName = first === "player" ? player.name : bot.name;
  return {
    version: 2,
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    obstacles: OBSTACLES.map((c) => [...c] as Cell),
    units: {
      player: makeUnit("player", player, 1, mid),
      bot: makeUnit("bot", bot, GRID_WIDTH - 2, mid),
    },
    turn: first,
    nextTime: { player: 0, bot: 0 },
    tieFirst: first,
    time: 0,
    round: 1,
    status: "active",
    log: [
      `Бой начался: ${player.name} (${player.profile.className}) против ${bot.name} (${bot.profile.className}).`,
      `Инициатива ${pi} против ${bi}. Первым ходит ${firstName}.`,
      first === "player" ? "Раунд 1. Ваш ход." : `Раунд 1. Ход: ${bot.name}.`,
    ],
  };
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

/** The next `count` turns on the initiative timeline, starting with the current one. */
export function turnQueue(state: BattleState, count = 6): Side[] {
  const next = { ...state.nextTime };
  const queue: Side[] = [state.turn];
  next[state.turn] += turnLength(state.units[state.turn]);
  while (queue.length < count) {
    const s = pickNext(next, state.tieFirst);
    queue.push(s);
    next[s] += turnLength(state.units[s]);
  }
  return queue;
}

function pickNext(next: Record<Side, number>, tieFirst: Side): Side {
  const eps = 1e-9;
  if (Math.abs(next.player - next.bot) < eps) return tieFirst;
  return next.player < next.bot ? "player" : "bot";
}

function log(state: BattleState, line: string) {
  state.log.push(line);
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

function isBlocked(state: BattleState, x: number, y: number, mover: Side): boolean {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return true;
  if (state.obstacles.some(([ox, oy]) => ox === x && oy === y)) return true;
  const o = state.units[other(mover)];
  return o.x === x && o.y === y;
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
  log(state, state.status === "won" ? `${bot.name} повержен. Победа!` : `${player.name} пал. Поражение.`);
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

function applySkill(state: BattleState, caster: Unit, skill: Skill, rng: Rng, events: BattleEvent[]) {
  const enemy = state.units[other(caster.side)];
  const target = skill.target === "self" ? caster : enemy;
  events.push({ type: "skill", side: caster.side, skillId: skill.id, target: [target.x, target.y] });
  log(state, `${caster.name} применяет «${skill.name}».`);
  payMana(state, caster, skill.mana);
  if (skill.cooldown > 0) caster.cooldowns[skill.id] = skill.cooldown;
  if (skill.cost === "action") caster.actionUsed = true;
  else caster.bonusUsed = true;
  resolveEffects(state, caster, target, skill, rng, events);
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
    const enemy = state.units[other(side)];
    if (enemy.x !== x || enemy.y !== y) throw new BattleError("Выберите противника как цель");
    if (distance(u.x, u.y, enemy.x, enemy.y) > skill.range) throw new BattleError("Цель слишком далеко");
    if (!hasLineOfSight(state, u.x, u.y, enemy.x, enemy.y)) throw new BattleError("Цель закрыта препятствием");
  }
  applySkill(state, u, skill, rng, events);
}

/** Start-of-turn upkeep: regen, cooldowns, damage over time, stun. Returns false if the unit skips the turn. */
function startTurn(state: BattleState, side: Side, events: BattleEvent[]): boolean {
  const u = state.units[side];
  state.turn = side;
  state.time = state.nextTime[side];
  const round = Math.floor(state.time / TURN_TIME + 1e-9) + 1;
  const newRound = round !== state.round;
  state.round = round;
  events.push({ type: "turn", side, round });
  const roundText = newRound ? `Раунд ${round}. ` : "";
  log(state, side === "player" ? `${roundText}Ваш ход.` : `${roundText}Ход: ${u.name}.`);

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

function endTurn(state: BattleState, side: Side) {
  state.nextTime[side] += turnLength(state.units[side]);
}

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
    playBot(state, botTurn, rng, events);
    endTurn(state, "bot");
    advance(state, botTurn, rng, events);
  }
  return events;
}

function playBot(state: BattleState, botTurn: BotTurn, rng: Rng, events: BattleEvent[]) {
  const act = (a: BattleAction) => {
    if (state.status !== "active") return;
    if (a.type === "move") doMove(state, "bot", a.x, a.y, rng, events);
    else if (a.type === "skill") doSkill(state, "bot", a.skillId, a.x, a.y, rng, events);
  };
  botTurn(state, act, rng);
}

/** Runs the timeline (bot turns, skipped stunned turns) until the player can act. */
function advance(state: BattleState, botTurn: BotTurn, rng: Rng, events: BattleEvent[]) {
  for (let guard = 0; guard < 30 && state.status === "active"; guard++) {
    const next = pickNext(state.nextTime, state.tieFirst);
    const canAct = startTurn(state, next, events);
    if (state.status !== "active") return;
    if (canAct && next === "player") return;
    if (canAct) playBot(state, botTurn, rng, events);
    if (state.status !== "active") return;
    endTurn(state, next);
  }
}
