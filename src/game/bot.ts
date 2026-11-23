import type { Skill } from "./classes.js";
import { CLASSES, TALENTS } from "./classes.js";
import { classPoints, classSlots, talentSlots, validateBuild, type HeroBuild } from "./build.js";
import {
  distance,
  hasLineOfSight,
  reachableCells,
  skillBlocker,
  unitSkill,
  type BattleAction,
  type BattleState,
  type BotTurn,
  type Rng,
  type Side,
  type Unit,
} from "./battle.js";

/** Random legal build for a bot of the given level (same rules as players). */
export function randomBuild(level: number, rng: Rng = Math.random): HeroBuild {
  const pick = <T>(list: readonly T[]) => list[Math.floor(rng() * list.length)];
  const playable = CLASSES.filter((c) => c.playable);
  for (let attempt = 0; attempt < 20; attempt++) {
    const first = pick(playable);
    const build: HeroBuild = { classes: [{ id: first.id, rank: 1, spec: pick(first.specs).id }], talents: [], loadout: [] };
    for (let p = 1; p < classPoints(level); p++) {
      const free = playable.filter((c) => !build.classes.some((b) => b.id === c.id));
      if (build.classes.length < classSlots(level) && free.length && rng() < 0.5) {
        const c = pick(free);
        build.classes.push({ id: c.id, rank: 1, spec: pick(c.specs).id });
      } else {
        const growable = build.classes.filter((c) => c.rank < 5);
        if (growable.length) pick(growable).rank += 1;
      }
    }
    const talents = [...TALENTS].sort(() => rng() - 0.5);
    for (const t of talents) {
      if (build.talents.length >= talentSlots(level)) break;
      if (t.group && build.talents.some((id) => TALENTS.find((x) => x.id === id)?.group === t.group)) continue;
      build.talents.push(t.id);
    }
    if (!validateBuild(build, level)) return build;
  }
  return { classes: [{ id: "warrior", rank: 1, spec: "warrior_shield" }], talents: [], loadout: [] };
}

/** Rough value of an offensive skill against the current target. */
function offensiveValue(skill: Skill, foe: Unit): number {
  let v = 0;
  for (const e of skill.effects) {
    if (e.type === "damage") v += e.power * (e.hits ?? 1) + (e.executeBelow && foe.hp / foe.maxHp < e.executeBelow ? e.power : 0);
    if (e.type === "dot") v += e.power * e.turns * 0.8;
    if (e.type === "stun" && foe.armor[e.gate].current === 0 && foe.stunImmune === 0) v += 2;
  }
  return v;
}

/** Whether a self skill is worth using now. */
function defensiveNeed(skill: Skill, me: Unit): boolean {
  return skill.effects.some((e) => {
    if (e.type === "heal") return me.hp / me.maxHp < 0.5;
    if (e.type === "armor") {
      const types = e.armor === "both" ? (["physical", "magic"] as const) : [e.armor];
      return types.some((t) => me.armor[t].max > 0 && me.armor[t].current / me.armor[t].max < 0.4);
    }
    return false;
  });
}

/**
 * Simple bot: restore armor / heal when low, otherwise use the strongest skill in range,
 * walking towards the player first if nothing reaches.
 */
/** Plays the hero of the side whose turn it is: the bot, or the player's hero in auto battle. */
export const simpleBot: BotTurn = (state: BattleState, act: (a: BattleAction) => void) => heroAi(state, state.turn, act);

/** The same simple tactics for any side (the bot, or the player's hero in auto battle). */
export function heroAi(state: BattleState, side: Side, act: (a: BattleAction) => void): void {
  const me = state.units[side];
  const foe = state.units[side === "bot" ? "player" : "bot"];
  const skills = me.skills.map(unitSkill);

  const usable = (s: Skill) => skillBlocker(me, s) === null;
  const inRange = (s: Skill) =>
    s.target === "self" || (distance(me.x, me.y, foe.x, foe.y) <= s.range && hasLineOfSight(state, me.x, me.y, foe.x, foe.y));

  const useBest = () => {
    for (let i = 0; i < 4 && state.status === "active"; i++) {
      const candidates = skills
        .filter((s) => usable(s) && inRange(s))
        .filter((s) => s.target === "enemy" || defensiveNeed(s, me))
        .sort((a, b) => {
          if ((a.target === "self") !== (b.target === "self")) return a.target === "self" ? -1 : 1;
          return offensiveValue(b, foe) - offensiveValue(a, foe);
        });
      const pick = candidates[0];
      if (!pick) return;
      act({ type: "skill", skillId: pick.id, x: pick.target === "self" ? me.x : foe.x, y: pick.target === "self" ? me.y : foe.y });
    }
  };

  useBest();
  if (state.status !== "active" || me.movesLeft <= 0 || me.stunned > 0) return;

  const offensive = skills.filter((s) => s.target === "enemy" && usable(s));
  if (!offensive.length) return;
  const wantRange = Math.max(...offensive.map((s) => s.range));
  const reaches = (x: number, y: number) => distance(x, y, foe.x, foe.y) <= wantRange && hasLineOfSight(state, x, y, foe.x, foe.y);
  const current = distance(me.x, me.y, foe.x, foe.y);
  let best: { x: number; y: number; score: number } | null = null;
  for (const [key, path] of reachableCells(state, side)) {
    const [x, y] = key.split(",").map(Number);
    const d = distance(x, y, foe.x, foe.y);
    const score = (reaches(x, y) ? 0 : 100 + d) + path.length * 0.1;
    if (!best || score < best.score) best = { x, y, score };
  }
  const stayScore = reaches(me.x, me.y) ? 0 : 100 + current;
  if (best && best.score < stayScore) act({ type: "move", x: best.x, y: best.y });
  useBest();
}

