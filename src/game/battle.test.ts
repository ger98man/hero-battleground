import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eventsSince,
  recordEvents,
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
  bot.armor.magic = { current: 200, max: 200 }; // enough armor to soak the whole hit
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

// ---------- Armies ----------
import { actorQueue, activeStack, stackAi, stackReachable, stackTargets, ARMY_GRID_WIDTH } from "./battle.js";
import { defaultArmy, FactionId } from "./factions.js";

const armyFighter = (name: string, faction: FactionId, level = 12): Fighter => ({
  ...fighter(name, WARRIOR, level),
  army: defaultArmy({ faction, level }),
});

/** Player side: hero plays like playRound, stacks use the same AI as the bot. */
function playArmyTurn(state: BattleState, rng: () => number) {
  const st = activeStack(state);
  if (!st) return playRound(state, rng);
  stackAi(state, st, rng, []);
  if (state.status === "active" && state.turn === "player" && activeStack(state)?.id === st.id) {
    applyPlayerAction(state, { type: "end_turn" }, simpleBot, rng);
  }
}

test("armies: stacks are placed, take turns on the timeline and battles finish", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const rng = seeded(seed);
    const state = createBattle(armyFighter("P", FactionId.Dawn), armyFighter("B", FactionId.Rot), rng);
    assert.equal(state.width, ARMY_GRID_WIDTH);
    assert.equal(state.stacks?.length, 14);
    const cells = new Set([...state.stacks!.map((s) => `${s.x},${s.y}`), `${state.units.player.x},${state.units.player.y}`, `${state.units.bot.x},${state.units.bot.y}`]);
    assert.equal(cells.size, 16, "nobody shares a cell");
    assert.ok(actorQueue(state, 10).some((a) => a.id !== "player" && a.id !== "bot"), "stacks are in the queue");
    startBattle(state, simpleBot, rng);
    for (let i = 0; i < 400 && state.status === "active"; i++) playArmyTurn(state, rng);
    assert.notEqual(state.status, "active", `seed ${seed} finished`);
  }
});

test("armies: melee attack on a stack gets one counter-attack, shooters do not provoke it", () => {
  const rng = seeded(3);
  const state = createBattle(armyFighter("P", FactionId.Dawn), armyFighter("B", FactionId.Ash), rng);
  const mine = state.stacks!.find((s) => s.side === "player" && !s.ranged && !s.flyer)!;
  const theirs = state.stacks!.find((s) => s.side === "bot")!;
  theirs.x = 6; theirs.y = 7; mine.x = 5; mine.y = 7;
  state.turn = "player"; state.active = mine.id; mine.moved = false; mine.attacked = false;
  assert.ok(stackTargets(state, mine).some(([x, y]) => x === 6 && y === 7));
  const events = applyPlayerAction(state, { type: "attack", x: 6, y: 7 }, simpleBot, rng);
  const firstHit = events.findIndex((e) => e.type === "stack-damage" && e.id === theirs.id);
  assert.ok(firstHit >= 0, "the target took damage");
  const counter = events[firstHit + 1];
  assert.ok(theirs.count === 0 || (counter?.type === "reaction" && counter.name === "Ответный удар"), "the target strikes back");
  const shooter = state.stacks!.find((s) => s.side === "player" && s.ranged && s.count > 0);
  if (shooter && state.status === "active") {
    state.turn = "player"; state.active = shooter.id; shooter.attacked = false; shooter.moved = false;
    const visible = stackTargets(state, shooter);
    const target = state.stacks!.find((s) => s.side === "bot" && s.count > 0 && visible.some(([x, y]) => x === s.x && y === s.y))!;
    target.retaliated = false;
    const shot = applyPlayerAction(state, { type: "attack", x: target.x, y: target.y }, simpleBot, rng);
    const hit = shot.findIndex((e) => e.type === "stack-damage" && e.id === target.id);
    assert.ok(hit >= 0 && !(shot[hit + 1]?.type === "reaction"), "no counter-attack on a ranged shot");
  }
});

test("armies: flyers ignore obstacles, walkers cannot step on bodies", () => {
  const state = createBattle(armyFighter("P", FactionId.Dawn), armyFighter("B", FactionId.Rot));
  const walker = state.stacks!.find((s) => s.side === "player" && !s.flyer)!;
  for (const key of stackReachable(state, walker).keys()) {
    const [x, y] = key.split(",").map(Number);
    assert.ok(!state.obstacles.some(([ox, oy]) => ox === x && oy === y));
    assert.ok(!state.stacks!.some((s) => s.count > 0 && s.x === x && s.y === y));
  }
  const flyer = state.stacks!.find((s) => s.side === "player" && s.flyer)!;
  assert.ok(stackReachable(state, flyer).size > stackReachable(state, walker).size);
});

test("auto battle: the AI plays the player's hero and stacks until the battle ends", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const rng = seeded(seed + 40);
    const state = createBattle(armyFighter("P", FactionId.Grove), armyFighter("B", FactionId.Ash), rng);
    startBattle(state, simpleBot, rng);
    for (let i = 0; i < 400 && state.status === "active"; i++) applyPlayerAction(state, { type: "auto" }, simpleBot, rng);
    assert.notEqual(state.status, "active");
  }
  const pvp = createBattle(armyFighter("A", FactionId.Dawn), armyFighter("B", FactionId.Rot), seeded(9), "pvp");
  for (let i = 0; i < 600 && pvp.status === "active"; i++) applySideAction(pvp, pvp.turn, { type: "auto" }, seeded(i), simpleBot);
  assert.notEqual(pvp.status, "active");
});

test("attacker's Мастерство cancels the defender's dodge and parry", () => {
  const state = createBattle(fighter("A", WARRIOR, 1, 1), fighter("B", WARRIOR));
  const { player, bot } = state.units;
  player.x = bot.x - 1;
  player.y = bot.y;
  bot.dodge = 0.2;
  bot.parry = 0.2;
  const rng = () => 0.1; // would be a dodge without Мастерство
  player.mastery = 0;
  const hp = bot.hp + bot.armor.physical.current;
  applyPlayerAction(state, { type: "skill", skillId: "warrior_basic", x: bot.x, y: bot.y }, simpleBot, rng);
  assert.equal(bot.hp + bot.armor.physical.current, hp, "dodged");
  // Next own turn: with 20 Мастерство the 20% dodge and parry are gone.
  const state2 = createBattle(fighter("A", WARRIOR, 1, 1), fighter("B", WARRIOR));
  const a = state2.units.player;
  const b = state2.units.bot;
  a.x = b.x - 1;
  a.y = b.y;
  b.dodge = 0.2;
  b.parry = 0.2;
  a.mastery = 20;
  const hp2 = b.hp + b.armor.physical.current;
  applyPlayerAction(state2, { type: "skill", skillId: "warrior_basic", x: b.x, y: b.y }, simpleBot, rng);
  assert.ok(b.hp + b.armor.physical.current < hp2, "hit lands");
});

test("PvP event feed: numbered, replayable after a given number, trimmed to the recent ones", () => {
  const state = { version: 2 } as unknown as BattleState;
  assert.deepEqual(eventsSince(state, 0), []);
  recordEvents(state, [{ type: "end", status: "won" }, { type: "stun", side: "bot" }]);
  assert.equal(state.eventSeq, 2);
  assert.deepEqual(eventsSince(state, 1), [{ type: "stun", side: "bot" }]);
  assert.deepEqual(eventsSince(state, 2), []);
  recordEvents(state, Array.from({ length: 400 }, () => ({ type: "stun", side: "player" }) as const));
  assert.equal(state.eventSeq, 402);
  assert.equal(eventsSince(state, 0), null);
  assert.equal(eventsSince(state, 400)?.length, 2);
});
