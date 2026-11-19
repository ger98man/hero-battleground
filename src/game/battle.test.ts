import { test } from "node:test";
import assert from "node:assert/strict";
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
  turnQueue,
  unitSkill,
  type BattleState,
  type Fighter,
} from "./battle.js";
import { randomBuild, simpleBot } from "./bot.js";
import { combatProfile, type HeroBuild } from "./build.js";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const build = (classes: [string, number, string][], talents: string[] = []): HeroBuild => ({
  classes: classes.map(([id, rank, spec]) => ({ id, rank, spec })),
  talents,
  loadout: [],
});

function fighter(name: string, b: HeroBuild, level = 1, initiativeBonus = 0): Fighter {
  const profile = combatProfile(level, b);
  profile.stats.initiative += initiativeBonus;
  profile.speedBonus = Math.min(0.15, Math.max(0, profile.stats.initiative - 10) * 0.01);
  return { name, level, profile };
}

const WARRIOR = build([["warrior", 1, "warrior_shield"]]);
const MAGE = build([["mage", 1, "mage_fire"]]);
const MONK = build([["monk", 1, "monk_arts"]]);

/** Naive player: walk towards the bot, use the strongest skill that reaches, end turn. */
function playRound(state: BattleState, rng: () => number) {
  const me = state.units.player;
  const foe = state.units.bot;
  const tryAttack = () => {
    for (const id of [...me.skills].reverse()) {
      const s = unitSkill(id);
      if (state.status !== "active" || state.turn !== "player") return;
      if (s.target === "enemy" && distance(me.x, me.y, foe.x, foe.y) > s.range) continue;
      try {
        applyPlayerAction(state, { type: "skill", skillId: s.id, x: s.target === "self" ? me.x : foe.x, y: s.target === "self" ? me.y : foe.y }, simpleBot, rng);
      } catch (e) {
        if (!(e instanceof BattleError)) throw e;
      }
    }
  };
  tryAttack();
  if (state.status === "active" && me.movesLeft > 0 && me.stunned === 0) {
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

test("movement respects range and obstacles", () => {
  const state = createBattle(fighter("A", MAGE, 1, 1), fighter("B", WARRIOR));
  const reach = reachableCells(state, "player");
  for (const path of reach.values()) assert.ok(path.length <= state.units.player.moveRange);
  for (const [x, y] of state.obstacles) assert.ok(!reach.has(`${x},${y}`));
  assert.throws(() => applyPlayerAction(state, { type: "move", x: 9, y: 3 }, simpleBot), BattleError);
});

test("damage hits armor of its type first, then HP", () => {
  const rng = seeded(1);
  const state = createBattle(fighter("A", MAGE, 1, 1), fighter("B", WARRIOR));
  const { player, bot } = state.units;
  applyPlayerAction(state, { type: "move", x: 4, y: 3 }, simpleBot, rng);
  const magic = bot.armor.magic.current;
  const phys = bot.armor.physical.current;
  const hp = bot.hp;
  applyPlayerAction(state, { type: "skill", skillId: "mage_fireball", x: bot.x, y: bot.y }, simpleBot, rng);
  assert.ok(bot.armor.magic.current < magic, "magic armor took damage");
  assert.equal(bot.armor.physical.current, phys, "physical armor untouched");
  assert.equal(bot.hp, hp, "HP untouched while magic armor holds");
  assert.equal(player.mana, player.maxMana - 25);
  assert.throws(() => applyPlayerAction(state, { type: "skill", skillId: "mage_basic", x: bot.x, y: bot.y }, simpleBot, rng), /Действие/);
});

test("stun only lands when the matching armor is broken, then gives immunity", () => {
  const rng = () => 0.99; // no dodge/parry
  const state = createBattle(fighter("A", WARRIOR, 1, 1), fighter("B", MAGE));
  const { player, bot } = state.units;
  player.x = bot.x - 1;
  player.y = bot.y;
  applyPlayerAction(state, { type: "skill", skillId: "warrior_bash", x: bot.x, y: bot.y }, simpleBot, rng);
  if (bot.armor.physical.current > 0) assert.equal(bot.stunned, 0);
  // Break physical armor and try again on the next turn.
  bot.armor.physical.current = 0;
  delete player.cooldowns.warrior_bash;
  player.actionUsed = false;
  applyPlayerAction(state, { type: "skill", skillId: "warrior_bash", x: bot.x, y: bot.y }, simpleBot, rng);
  assert.equal(bot.stunned, 1);
  applyPlayerAction(state, { type: "end_turn" }, simpleBot, rng);
  // Bot skipped its turn and is now immune.
  assert.equal(state.turn, "player");
  assert.equal(bot.stunned, 0);
  assert.ok(bot.stunImmune > 0);
});

test("initiative timeline: higher initiative acts first and sometimes twice", () => {
  const fast = fighter("P", WARRIOR, 1, 15); // +15 initiative -> capped 15% speed
  const state = createBattle(fast, fighter("B", WARRIOR));
  assert.equal(state.turn, "player");
  const queue = turnQueue(state, 16);
  const playerTurns = queue.filter((s) => s === "player").length;
  assert.ok(playerTurns > queue.length / 2, `player gets more turns: ${queue.join(",")}`);
  assert.ok(queue.some((s, i) => i > 0 && s === "player" && queue[i - 1] === "player"), "an extra turn happens");
});

test("bot opening turn is played by startBattle", () => {
  const state = createBattle(fighter("P", WARRIOR), fighter("B", WARRIOR, 1, 3));
  assert.equal(state.turn, "bot");
  const events = startBattle(state, simpleBot, seeded(3));
  assert.ok(events.some((e) => e.type === "move" && e.side === "bot"));
  assert.equal(state.turn, "player");
});

test("Оппортунист attacks an enemy leaving melee range", () => {
  const state = createBattle(fighter("P", MONK, 4, 1), fighter("B", build([["warrior", 1, "warrior_twohand"]], ["opportunist"]), 4));
  const { player, bot } = state.units;
  player.x = bot.x - 1;
  player.y = bot.y;
  const hpBefore = player.hp + player.armor.physical.current;
  const events = applyPlayerAction(state, { type: "move", x: player.x - 2, y: player.y }, simpleBot, () => 0.99);
  assert.ok(events.some((e) => e.type === "reaction"));
  assert.ok(player.hp + player.armor.physical.current < hpBefore);
  assert.ok(bot.reactionUsed);
});

test("obstacles block line of sight", () => {
  const state = createBattle(fighter("P", MAGE, 1, 1), fighter("B", WARRIOR));
  state.obstacles = [[4, 3]];
  assert.equal(hasLineOfSight(state, 2, 3, 6, 3), false);
  assert.equal(hasLineOfSight(state, 2, 2, 6, 2), true);
  assert.equal(hasLineOfSight(state, 3, 1, 6, 4), true); // only touches the corner
  state.units.player.x = 2;
  state.units.bot.x = 6;
  assert.throws(() => applyPlayerAction(state, { type: "skill", skillId: "mage_basic", x: 6, y: 3 }, simpleBot), /препятствием/);
});

test("battles between random builds finish", () => {
  for (const level of [1, 3, 6, 9, 12]) {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seeded(seed * 97 + level);
      const state = createBattle(fighter("P", randomBuild(level, rng), level), fighter("B", randomBuild(level, rng), level), rng);
      startBattle(state, simpleBot, rng);
      for (let i = 0; i < 200 && state.status === "active"; i++) playRound(state, rng);
      assert.notEqual(state.status, "active", `level ${level} seed ${seed} did not finish`);
    }
  }
});

test("surrender works even on the bot's turn and ends the battle", () => {
  const state = createBattle(fighter("P", WARRIOR), fighter("B", WARRIOR, 1, 3));
  applyPlayerAction(state, { type: "surrender" }, simpleBot);
  assert.equal(state.status, "lost");
  assert.throws(() => applyPlayerAction(state, { type: "end_turn" }, simpleBot), BattleError);
});

test("pvp: sides alternate, nobody acts on the other's turn", () => {
  const state = createBattle(fighter("A", WARRIOR, 1, 3), fighter("B", WARRIOR), seeded(5), "pvp");
  assert.equal(state.mode, "pvp");
  assert.equal(state.turn, "player");
  assert.ok(!state.log.some((l) => l.includes("Ваш ход")), "pvp log is neutral");
  assert.throws(() => applySideAction(state, "bot", { type: "end_turn" }), /не ваш ход/);
  applySideAction(state, "player", { type: "move", x: 2, y: 3 });
  applySideAction(state, "player", { type: "end_turn" });
  assert.equal(state.turn, "bot");
  // The second player moves themselves: no AI turn was played.
  assert.equal(state.units.bot.x, 8);
  applySideAction(state, "bot", { type: "move", x: 7, y: 3 });
  applySideAction(state, "bot", { type: "end_turn" });
  assert.equal(state.turn, "player");
});

test("pvp: timeout passes the turn, surrender works for either side", () => {
  const state = createBattle(fighter("A", WARRIOR, 1, 3), fighter("B", WARRIOR), seeded(6), "pvp");
  timeoutTurn(state);
  assert.equal(state.turn, "bot");
  assert.ok(state.log.some((l) => l.includes("время хода вышло")));
  applySideAction(state, "bot", { type: "surrender" });
  assert.equal(state.status, "won");
  assert.ok(state.log.at(-1)!.includes("Победил A"));
});

test("pvp: a stunned side's turn is skipped", () => {
  const state = createBattle(fighter("A", WARRIOR, 1, 3), fighter("B", WARRIOR), seeded(7), "pvp");
  state.units.bot.stunned = 1;
  applySideAction(state, "player", { type: "end_turn" });
  assert.equal(state.turn, "player");
  assert.ok(state.log.some((l) => l.includes("B пропускает ход")));
});
