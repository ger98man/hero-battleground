/**
 * Turn-based battle on a grid. Pure logic, no DB: the whole battle state is a
 * JSON-serializable object that the API stores in `battles.state`.
 * The server is authoritative: the client only sends intents (move / skill / end turn).
 */
import { findSkill, getArtifact, type Artifact, type Skill } from "./artifacts.js";
import { MANA_REGEN_PER_TURN, type CombatStats } from "./stats.js";

export type Side = "player" | "bot";
export type Rng = () => number;
export type Cell = [number, number];

export interface DotEffect {
  name: string;
  /** Damage per tick, already multiplied by the caster's attack. */
  perTick: number;
  turns: number;
}

export interface Unit {
  side: Side;
  name: string;
  level: number;
  artifactId: string;
  maxHp: number;
  hp: number;
  maxMana: number;
  mana: number;
  attack: number;
  defense: number;
  moveRange: number;
  x: number;
  y: number;
  movesLeft: number;
  actionUsed: boolean;
  bonusUsed: boolean;
  /** Remaining own turns until the skill can be used again. */
  cooldowns: Record<string, number>;
  dots: DotEffect[];
  shield: { amount: number; turns: number } | null;
  stunned: number;
}

export type BattleStatus = "active" | "won" | "lost";

export interface BattleState {
  width: number;
  height: number;
  obstacles: Cell[];
  units: Record<Side, Unit>;
  turn: Side;
  round: number;
  status: BattleStatus;
  log: string[];
}

export type BattleEvent =
  | { type: "move"; side: Side; path: Cell[] }
  | { type: "skill"; side: Side; skillId: string; target: Cell }
  | { type: "damage"; side: Side; amount: number; absorbed: number; source: string }
  | { type: "heal"; side: Side; amount: number }
  | { type: "shield"; side: Side; amount: number }
  | { type: "stun"; side: Side }
  | { type: "turn"; side: Side; round: number }
  | { type: "end"; status: BattleStatus };

export type BattleAction =
  | { type: "move"; x: number; y: number }
  | { type: "skill"; skillId: string; x: number; y: number }
  | { type: "end_turn" }
  | { type: "surrender" };

export class BattleError extends Error {}

const LOG_LIMIT = 60;
/** Global multiplier for skill power (damage, heal, DoT). Main knob for battle length. */
export const POWER_SCALE = 0.6;
export const GRID_WIDTH = 10;
export const GRID_HEIGHT = 7;
const OBSTACLES: Cell[] = [
  [4, 1],
  [5, 5],
  [4, 4],
];

export interface Fighter {
  name: string;
  level: number;
  artifactId: string;
  stats: CombatStats;
}

function makeUnit(side: Side, f: Fighter, x: number, y: number): Unit {
  return {
    side,
    name: f.name,
    level: f.level,
    artifactId: f.artifactId,
    maxHp: f.stats.maxHp,
    hp: f.stats.maxHp,
    maxMana: f.stats.maxMana,
    mana: f.stats.maxMana,
    attack: f.stats.attack,
    defense: f.stats.defense,
    moveRange: f.stats.moveRange,
    x,
    y,
    movesLeft: f.stats.moveRange,
    actionUsed: false,
    bonusUsed: false,
    cooldowns: {},
    dots: [],
    shield: null,
    stunned: 0,
  };
}

export function createBattle(player: Fighter, bot: Fighter): BattleState {
  const mid = Math.floor(GRID_HEIGHT / 2);
  return {
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    obstacles: OBSTACLES.map((c) => [...c] as Cell),
    units: {
      player: makeUnit("player", player, 1, mid),
      bot: makeUnit("bot", bot, GRID_WIDTH - 2, mid),
    },
    turn: "player",
    round: 1,
    status: "active",
    log: [`Бой начался: ${player.name} против ${bot.name}.`, "Раунд 1. Ваш ход."],
  };
}

export const other = (side: Side): Side => (side === "player" ? "bot" : "player");

/** Chebyshev distance: diagonal steps count as 1. */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function unitArtifact(unit: Unit): Artifact {
  const a = getArtifact(unit.artifactId);
  if (!a) throw new Error(`unknown artifact ${unit.artifactId}`);
  return a;
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

/** Why the skill cannot be used right now (ignoring target position), or null if it can. */
export function skillBlocker(unit: Unit, skill: Skill): string | null {
  if (unit.stunned > 0) return "Вы оглушены";
  if (skill.cost === "action" && unit.actionUsed) return "Действие уже использовано";
  if (skill.cost === "bonus" && unit.bonusUsed) return "Бонусное действие уже использовано";
  if ((unit.cooldowns[skill.id] ?? 0) > 0) return "Умение перезаряжается";
  if (unit.mana < skill.mana) return "Не хватает маны";
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

function dealDamage(state: BattleState, target: Unit, raw: number, source: string, events: BattleEvent[]) {
  let amount = Math.max(1, Math.round(raw));
  let absorbed = 0;
  if (target.shield) {
    absorbed = Math.min(target.shield.amount, amount);
    target.shield.amount -= absorbed;
    amount -= absorbed;
    if (target.shield.amount <= 0) target.shield = null;
  }
  target.hp = Math.max(0, target.hp - amount);
  events.push({ type: "damage", side: target.side, amount, absorbed, source });
  const shieldText = absorbed ? ` (щит поглотил ${absorbed})` : "";
  log(state, `${target.name} получает ${amount} урона: ${source}${shieldText}.`);
}

function applySkill(state: BattleState, caster: Unit, skill: Skill, rng: Rng, events: BattleEvent[]) {
  const enemy = state.units[other(caster.side)];
  const target = skill.target === "self" ? caster : enemy;
  events.push({ type: "skill", side: caster.side, skillId: skill.id, target: [target.x, target.y] });
  log(state, `${caster.name} применяет «${skill.name}».`);
  caster.mana -= skill.mana;
  if (skill.cooldown > 0) caster.cooldowns[skill.id] = skill.cooldown;
  if (skill.cost === "action") caster.actionUsed = true;
  else caster.bonusUsed = true;

  for (const effect of skill.effects) {
    switch (effect.type) {
      case "damage": {
        const variance = 0.9 + rng() * 0.2;
        const raw = effect.power * POWER_SCALE * caster.attack * (50 / (50 + target.defense)) * variance;
        dealDamage(state, target, raw, skill.name, events);
        break;
      }
      case "heal": {
        const amount = Math.min(target.maxHp - target.hp, Math.round(effect.power * POWER_SCALE * caster.attack));
        target.hp += amount;
        events.push({ type: "heal", side: target.side, amount });
        log(state, `${target.name} восстанавливает ${amount} здоровья.`);
        break;
      }
      case "shield": {
        const amount = Math.round((target.maxHp * effect.percent) / 100);
        target.shield = { amount, turns: effect.turns };
        events.push({ type: "shield", side: target.side, amount });
        log(state, `${target.name} получает щит на ${amount}.`);
        break;
      }
      case "dot": {
        const perTick = Math.max(1, Math.round(effect.power * POWER_SCALE * caster.attack));
        target.dots = target.dots.filter((d) => d.name !== effect.name);
        target.dots.push({ name: effect.name, perTick, turns: effect.turns });
        log(state, `${target.name}: эффект «${effect.name}» на ${effect.turns} хода.`);
        break;
      }
      case "stun": {
        target.stunned = Math.max(target.stunned, effect.turns);
        events.push({ type: "stun", side: target.side });
        log(state, `${target.name} оглушён.`);
        break;
      }
    }
    if (finish(state, events)) return;
  }
}

function doMove(state: BattleState, side: Side, x: number, y: number, events: BattleEvent[]) {
  const u = state.units[side];
  if (u.stunned > 0) throw new BattleError("Вы оглушены");
  const path = reachableCells(state, side).get(`${x},${y}`);
  if (!path) throw new BattleError("Туда нельзя пройти");
  u.x = x;
  u.y = y;
  u.movesLeft -= path.length;
  events.push({ type: "move", side, path });
}

function doSkill(state: BattleState, side: Side, skillId: string, x: number, y: number, rng: Rng, events: BattleEvent[]) {
  const u = state.units[side];
  const skill = findSkill(unitArtifact(u), skillId);
  if (!skill) throw new BattleError("Нет такого умения");
  const blocker = skillBlocker(u, skill);
  if (blocker) throw new BattleError(blocker);
  if (skill.target === "enemy") {
    const enemy = state.units[other(side)];
    if (enemy.x !== x || enemy.y !== y) throw new BattleError("Выберите противника как цель");
    if (distance(u.x, u.y, enemy.x, enemy.y) > skill.range) throw new BattleError("Цель слишком далеко");
  }
  applySkill(state, u, skill, rng, events);
}

/** Start-of-turn upkeep: regen, cooldowns, damage over time, shields, stun. Returns false if the unit skips the turn. */
function startTurn(state: BattleState, side: Side, events: BattleEvent[]): boolean {
  const u = state.units[side];
  state.turn = side;
  if (side === "player") state.round += 1;
  events.push({ type: "turn", side, round: state.round });
  log(state, side === "player" ? `Раунд ${state.round}. Ваш ход.` : `Ход: ${u.name}.`);

  u.movesLeft = u.moveRange;
  u.actionUsed = false;
  u.bonusUsed = false;
  u.mana = Math.min(u.maxMana, u.mana + MANA_REGEN_PER_TURN);
  for (const id of Object.keys(u.cooldowns)) {
    u.cooldowns[id] -= 1;
    if (u.cooldowns[id] <= 0) delete u.cooldowns[id];
  }
  for (const dot of u.dots) {
    dealDamage(state, u, dot.perTick, dot.name, events);
    dot.turns -= 1;
    if (finish(state, events)) return false;
  }
  u.dots = u.dots.filter((d) => d.turns > 0);
  if (u.shield) {
    u.shield.turns -= 1;
    if (u.shield.turns <= 0) u.shield = null;
  }
  if (u.stunned > 0) {
    u.stunned -= 1;
    u.movesLeft = 0;
    u.actionUsed = true;
    u.bonusUsed = true;
    log(state, `${u.name} оглушён и пропускает ход.`);
    return false;
  }
  return true;
}

export type BotTurn = (state: BattleState, act: (action: BattleAction) => void, rng: Rng) => void;

/**
 * Applies the player's action. On end_turn runs the bot's turn (via `botTurn`)
 * and starts the next player turn. Mutates `state`, returns what happened.
 */
export function applyPlayerAction(state: BattleState, action: BattleAction, botTurn: BotTurn, rng: Rng = Math.random): BattleEvent[] {
  if (state.status !== "active") throw new BattleError("Бой уже закончен");
  if (state.turn !== "player") throw new BattleError("Сейчас не ваш ход");
  const events: BattleEvent[] = [];

  switch (action.type) {
    case "move":
      doMove(state, "player", action.x, action.y, events);
      return events;
    case "skill":
      doSkill(state, "player", action.skillId, action.x, action.y, rng, events);
      return events;
    case "surrender":
      state.units.player.hp = 0;
      log(state, `${state.units.player.name} сдаётся.`);
      finish(state, events);
      return events;
    case "end_turn":
      break;
    default:
      throw new BattleError("Неизвестное действие");
  }

  // Bot turn, then next player turn. Loops while the player is stunned.
  for (let guard = 0; guard < 10 && state.status === "active"; guard++) {
    if (startTurn(state, "bot", events)) {
      const act = (a: BattleAction) => {
        if (state.status !== "active") return;
        if (a.type === "move") doMove(state, "bot", a.x, a.y, events);
        else if (a.type === "skill") doSkill(state, "bot", a.skillId, a.x, a.y, rng, events);
      };
      botTurn(state, act, rng);
    }
    if (state.status !== "active") break;
    if (startTurn(state, "player", events)) break;
  }
  return events;
}
