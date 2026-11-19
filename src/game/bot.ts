import type { Skill } from "./artifacts.js";
import {
  distance,
  hasLineOfSight,
  reachableCells,
  skillBlocker,
  unitArtifact,
  type BattleAction,
  type BattleState,
  type BotTurn,
} from "./battle.js";

/** Rough value of a skill against the current target, used to rank options. */
function offensiveValue(skill: Skill): number {
  let v = 0;
  for (const e of skill.effects) {
    if (e.type === "damage") v += e.power;
    if (e.type === "dot") v += e.power * e.turns * 0.8;
    if (e.type === "stun") v += 1.5;
  }
  return v;
}

/**
 * Simple bot: heal/shield when low, otherwise use the strongest skill in range,
 * walking towards the player first if nothing reaches.
 */
export const simpleBot: BotTurn = (state: BattleState, act: (a: BattleAction) => void) => {
  const me = state.units.bot;
  const foe = state.units.player;
  const skills = unitArtifact(me).skills;

  const usable = (s: Skill) => skillBlocker(me, s) === null;
  const inRange = (s: Skill) =>
    s.target === "self" || (distance(me.x, me.y, foe.x, foe.y) <= s.range && hasLineOfSight(state, me.x, me.y, foe.x, foe.y));
  const isOffensive = (s: Skill) => s.target === "enemy";
  const isDefensive = (s: Skill) => s.target === "self";

  const useBest = () => {
    for (let i = 0; i < 4 && state.status === "active"; i++) {
      const low = me.hp / me.maxHp < 0.4;
      const candidates = skills
        .filter((s) => usable(s) && inRange(s))
        .filter((s) => isOffensive(s) || (low && !me.shield) || (low && s.effects.some((e) => e.type === "heal")))
        .sort((a, b) => {
          // Defensive first when low; then strongest; prefer bonus actions not to waste the main one.
          if (low && isDefensive(a) !== isDefensive(b)) return isDefensive(a) ? -1 : 1;
          return offensiveValue(b) - offensiveValue(a);
        });
      const pick = candidates[0];
      if (!pick) return;
      act({ type: "skill", skillId: pick.id, x: pick.target === "self" ? me.x : foe.x, y: pick.target === "self" ? me.y : foe.y });
    }
  };

  useBest();
  if (state.status !== "active" || me.movesLeft <= 0) return;

  // Move to the cell from which the best available offensive skill reaches the player,
  // spending as few moves as possible; if none reaches, get as close as possible.
  const offensive = skills.filter((s) => isOffensive(s) && usable(s));
  if (!offensive.length) return;
  const wantRange = Math.max(...offensive.map((s) => s.range));
  const reaches = (x: number, y: number) => distance(x, y, foe.x, foe.y) <= wantRange && hasLineOfSight(state, x, y, foe.x, foe.y);
  const current = distance(me.x, me.y, foe.x, foe.y);
  let best: { x: number; y: number; score: number } | null = null;
  for (const [key, path] of reachableCells(state, "bot")) {
    const [x, y] = key.split(",").map(Number);
    const d = distance(x, y, foe.x, foe.y);
    const score = (reaches(x, y) ? 0 : 100 + d) + path.length * 0.1;
    if (!best || score < best.score) best = { x, y, score };
  }
  const stayScore = reaches(me.x, me.y) ? 0 : 100 + current;
  if (best && best.score < stayScore) act({ type: "move", x: best.x, y: best.y });
  useBest();
};
