import { test } from "node:test";
import assert from "node:assert/strict";
import { addGuildPoints, GUILD_RULES, GUILDS, guildStatBonus, parseGuilds, pendingPicks, pointsForNextGuildLevel } from "./guilds.js";
import { dodgeFor, effectiveDefense, parryFor, STAT_RULES } from "./stats.js";

test("six guilds with unique ids", () => {
  assert.equal(GUILDS.length, 6);
  assert.equal(new Set(GUILDS.map((g) => g.id)).size, 6);
});

test("guild points level up and stop at the max level", () => {
  assert.equal(pointsForNextGuildLevel(0), 10);
  assert.deepEqual(addGuildPoints({ level: 0, points: 8 }, 3), { level: 1, points: 1, gained: 1 });
  assert.deepEqual(addGuildPoints({ level: 0, points: 0 }, 30), { level: 2, points: 0, gained: 2 });
  const max = addGuildPoints({ level: GUILD_RULES.maxLevel - 1, points: 0 }, 10_000);
  assert.equal(max.level, GUILD_RULES.maxLevel);
  assert.equal(max.points, 0);
});

test("guild stats: fixed stat per level and mercenary picks", () => {
  const guilds = parseGuilds([
    { guildId: "syndicate", level: 2, points: 0, picks: [] },
    { guildId: "bounty", level: 1, points: 0, picks: [] },
    { guildId: "craftsmen", level: 3, points: 0, picks: [] },
    { guildId: "mercenaries", level: 3, points: 0, picks: ["strength", "strength", "mastery", "dexterity", "intellect"] },
    { guildId: "unknown", level: 5 },
  ]);
  assert.equal(guilds.length, 4);
  const merc = guilds.find((g) => g.guildId === "mercenaries")!;
  assert.deepEqual(merc.picks, ["strength", "strength", "dexterity"], "only allowed stats, at most one per level");
  assert.equal(pendingPicks({ ...merc, picks: ["strength"] }), 2);
  assert.deepEqual(guildStatBonus(guilds), { initiative: 3, craft: 3, strength: 2, dexterity: 1 });
});

test("mastery lowers parry and dodge, which are capped", () => {
  assert.equal(parryFor(10), 0);
  assert.ok(Math.abs(parryFor(15) - 0.05) < 1e-9);
  assert.equal(dodgeFor(100), STAT_RULES.defenseCap);
  assert.ok(Math.abs(effectiveDefense(0.1, 4) - 0.06) < 1e-9);
  assert.equal(effectiveDefense(0.05, 20), 0);
});
