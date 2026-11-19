import { test } from "node:test";
import assert from "node:assert/strict";
import { ARTIFACTS, getArtifact } from "./artifacts.js";
import {
  applyPlayerAction,
  applySideAction,
  BattleError,
  createBattle,
  distance,
  hasLineOfSight,
  reachableCells,
  startBattle,
  timeoutTurn,
  type BattleState,
  type Fighter,
} from "./battle.js";
import { simpleBot } from "./bot.js";
import { baseStatsForLevel, combatStats } from "./stats.js";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function fighter(name: string, artifactId: string, level = 1, speedBonus = 0): Fighter {
  const stats = combatStats(baseStatsForLevel(level), getArtifact(artifactId)!);
  return { name, level, artifactId, stats: { ...stats, speed: stats.speed + speedBonus } };
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
  const state = createBattle(fighter("A", "abyss_staff", 1, 1), fighter("B", "ash_blade"));
  const reach = reachableCells(state, "player");
  for (const path of reach.values()) assert.ok(path.length <= state.units.player.moveRange);
  for (const [x, y] of state.obstacles) assert.ok(!reach.has(`${x},${y}`));
  assert.throws(() => applyPlayerAction(state, { type: "move", x: 9, y: 3 }, simpleBot), BattleError);
});

test("skills check range, action economy, mana and cooldown", () => {
  const rng = seeded(1);
  const state = createBattle(fighter("A", "abyss_staff", 1, 1), fighter("B", "dawn_shield"));
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
      const state = createBattle(fighter("P", pa.id), fighter("B", ba.id), rng);
      startBattle(state, simpleBot, rng);
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

test("faster side acts first; bot opening turn is played by startBattle", () => {
  const playerFirst = createBattle(fighter("P", "ash_blade", 1, 3), fighter("B", "ash_blade"));
  assert.equal(playerFirst.turn, "player");
  const botFirst = createBattle(fighter("P", "ash_blade"), fighter("B", "ash_blade", 1, 3));
  assert.equal(botFirst.turn, "bot");
  const events = startBattle(botFirst, simpleBot, seeded(3));
  assert.ok(events.some((e) => e.type === "move" && e.side === "bot"));
  assert.equal(botFirst.turn, "player");
  assert.equal(botFirst.round, 1);
  applyPlayerAction(botFirst, { type: "end_turn" }, simpleBot, seeded(4));
  assert.equal(botFirst.round, 2);
});

test("obstacles block line of sight", () => {
  const state = createBattle(fighter("P", "abyss_staff", 1, 1), fighter("B", "dawn_shield"));
  state.obstacles = [[4, 3]];
  assert.equal(hasLineOfSight(state, 2, 3, 6, 3), false);
  assert.equal(hasLineOfSight(state, 2, 2, 6, 2), true);
  // Touching an obstacle corner does not block.
  assert.equal(hasLineOfSight(state, 3, 1, 6, 4), true); // only touches the corner
  state.units.player.x = 2;
  state.units.bot.x = 6;
  assert.throws(
    () => applyPlayerAction(state, { type: "skill", skillId: "abyss_bolt", x: 6, y: 3 }, simpleBot),
    /препятствием/,
  );
});

test("pvp: sides alternate, nobody acts on the other's turn", () => {
  const state = createBattle(fighter("A", "ash_blade", 1, 3), fighter("B", "ash_blade"), seeded(5), "pvp");
  assert.equal(state.mode, "pvp");
  assert.equal(state.turn, "player");
  assert.ok(!state.log.some((l) => l.includes("Ваш ход")), "pvp log is neutral");
  assert.throws(() => applySideAction(state, "bot", { type: "end_turn" }), /не ваш ход/);
  applySideAction(state, "player", { type: "move", x: 3, y: 3 });
  applySideAction(state, "player", { type: "end_turn" });
  assert.equal(state.turn, "bot");
  assert.equal(state.round, 1);
  // The second player moves themselves: no AI turn was played.
  assert.equal(state.units.bot.x, 8);
  applySideAction(state, "bot", { type: "move", x: 6, y: 3 });
  applySideAction(state, "bot", { type: "end_turn" });
  assert.equal(state.turn, "player");
  assert.equal(state.round, 2);
});

test("pvp: timeout passes the turn, surrender works for either side", () => {
  const state = createBattle(fighter("A", "ash_blade", 1, 3), fighter("B", "ash_blade"), seeded(6), "pvp");
  timeoutTurn(state);
  assert.equal(state.turn, "bot");
  assert.ok(state.log.some((l) => l.includes("время хода вышло")));
  applySideAction(state, "bot", { type: "surrender" });
  assert.equal(state.status, "won");
  assert.ok(state.log.at(-1)!.includes("Победил A"));
});

test("pvp: a stunned side's turn is skipped", () => {
  const state = createBattle(fighter("A", "ash_blade", 1, 3), fighter("B", "ash_blade"), seeded(7), "pvp");
  state.units.bot.stunned = 1;
  applySideAction(state, "player", { type: "end_turn" });
  assert.equal(state.turn, "player");
  assert.equal(state.round, 2);
});
