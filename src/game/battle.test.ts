import { test } from "node:test";
import assert from "node:assert/strict";
import { ARTIFACTS, getArtifact } from "./artifacts.js";
import { applyPlayerAction, BattleError, createBattle, distance, reachableCells, type BattleState, type Fighter } from "./battle.js";
import { simpleBot } from "./bot.js";
import { baseStatsForLevel, combatStats } from "./stats.js";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function fighter(name: string, artifactId: string, level = 1): Fighter {
  return { name, level, artifactId, stats: combatStats(baseStatsForLevel(level), getArtifact(artifactId)!) };
}

/** Naive player: walk towards the bot, use the strongest skill that reaches, end turn. */
function playRound(state: BattleState, rng: () => number) {
  const me = state.units.player;
  const foe = state.units.bot;
  const skills = getArtifact(me.artifactId)!.skills.filter((s) => s.target === "enemy");
  const tryAttack = () => {
    for (const s of [...skills].reverse()) {
      if (state.status !== "active") return;
      if (distance(me.x, me.y, foe.x, foe.y) > s.range) continue;
      try {
        applyPlayerAction(state, { type: "skill", skillId: s.id, x: foe.x, y: foe.y }, simpleBot, rng);
      } catch (e) {
        if (!(e instanceof BattleError)) throw e;
      }
    }
  };
  tryAttack();
  if (state.status === "active" && me.movesLeft > 0) {
    let best: [number, number] | null = null;
    let bestD = distance(me.x, me.y, foe.x, foe.y);
    for (const key of reachableCells(state, "player").keys()) {
      const [x, y] = key.split(",").map(Number);
      const d = distance(x, y, foe.x, foe.y);
      if (d < bestD) [best, bestD] = [[x, y], d];
    }
    if (best) applyPlayerAction(state, { type: "move", x: best[0], y: best[1] }, simpleBot, rng);
    tryAttack();
  }
  if (state.status === "active") applyPlayerAction(state, { type: "end_turn" }, simpleBot, rng);
}

test("every artifact has 4 skills with unique ids", () => {
  const ids = new Set<string>();
  for (const a of ARTIFACTS) {
    assert.equal(a.skills.length, 4, a.id);
    for (const s of a.skills) {
      assert.ok(!ids.has(s.id), s.id);
      ids.add(s.id);
    }
  }
  assert.ok(ARTIFACTS.filter((a) => a.starter).length >= 2);
});

test("movement respects range and obstacles", () => {
  const state = createBattle(fighter("A", "abyss_staff"), fighter("B", "ash_blade"));
  const reach = reachableCells(state, "player");
  for (const path of reach.values()) assert.ok(path.length <= state.units.player.moveRange);
  for (const [x, y] of state.obstacles) assert.ok(!reach.has(`${x},${y}`));
  assert.throws(() => applyPlayerAction(state, { type: "move", x: 9, y: 3 }, simpleBot), BattleError);
});

test("skills check range, action economy, mana and cooldown", () => {
  const rng = seeded(1);
  const state = createBattle(fighter("A", "abyss_staff"), fighter("B", "dawn_shield"));
  const { player, bot } = state.units;
  // Out of range at start (distance 7, range 5).
  assert.throws(() => applyPlayerAction(state, { type: "skill", skillId: "abyss_fireball", x: bot.x, y: bot.y }, simpleBot, rng), /далеко/);
  applyPlayerAction(state, { type: "move", x: 3, y: 3 }, simpleBot, rng);
  const hp = bot.hp;
  applyPlayerAction(state, { type: "skill", skillId: "abyss_fireball", x: bot.x, y: bot.y }, simpleBot, rng);
  assert.ok(bot.hp < hp);
  assert.equal(player.mana, player.maxMana - 30);
  assert.equal(player.cooldowns.abyss_fireball, 2);
  // Main action already used this turn.
  assert.throws(() => applyPlayerAction(state, { type: "skill", skillId: "abyss_bolt", x: bot.x, y: bot.y }, simpleBot, rng), /Действие/);
  // Bonus action is still available.
  applyPlayerAction(state, { type: "skill", skillId: "abyss_mana_shield", x: player.x, y: player.y }, simpleBot, rng);
  assert.ok(player.shield);
  applyPlayerAction(state, { type: "end_turn" }, simpleBot, rng);
  assert.equal(state.turn, "player");
  assert.equal(state.round, 2);
  assert.equal(player.cooldowns.abyss_fireball, 1);
});

test("battles between all artifact pairs finish", () => {
  for (const pa of ARTIFACTS) {
    for (const ba of ARTIFACTS) {
      const rng = seeded(pa.id.length * 31 + ba.id.length);
      const state = createBattle(fighter("P", pa.id), fighter("B", ba.id));
      for (let i = 0; i < 60 && state.status === "active"; i++) playRound(state, rng);
      assert.notEqual(state.status, "active", `${pa.id} vs ${ba.id} did not finish`);
    }
  }
});

test("surrender loses the battle", () => {
  const state = createBattle(fighter("P", "ash_blade"), fighter("B", "ash_blade"));
  applyPlayerAction(state, { type: "surrender" }, simpleBot);
  assert.equal(state.status, "lost");
  assert.throws(() => applyPlayerAction(state, { type: "end_turn" }, simpleBot), BattleError);
});
