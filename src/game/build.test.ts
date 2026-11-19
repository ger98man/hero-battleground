import { test } from "node:test";
import assert from "node:assert/strict";
import { availableSkills, classPoints, classSlots, combatProfile, effectiveLoadout, heroStats, overallClass, talentSlots, validateBuild, type HeroBuild } from "./build.js";
import { randomBuild } from "./bot.js";
import { ALL_SKILLS, CLASSES } from "./classes.js";

const b = (classes: [string, number, string][], talents: string[] = [], loadout: string[] = []): HeroBuild => ({
  classes: classes.map(([id, rank, spec]) => ({ id, rank, spec })),
  talents,
  loadout,
});

test("progression: class points every 3rd level, new class every 6th, talents every 4th", () => {
  assert.deepEqual([1, 3, 6, 9, 12].map(classPoints), [1, 2, 3, 4, 5]);
  assert.deepEqual([1, 5, 6, 11, 12, 18].map(classSlots), [1, 1, 2, 2, 3, 3]);
  assert.deepEqual([1, 4, 8, 12].map(talentSlots), [0, 1, 2, 3]);
});

test("validation follows the level rules", () => {
  assert.equal(validateBuild(b([["warrior", 1, "warrior_shield"]]), 1), null);
  assert.match(validateBuild(b([]), 1)!, /класс/);
  assert.match(validateBuild(b([["warrior", 2, "warrior_shield"]]), 1)!, /Очков/);
  assert.equal(validateBuild(b([["warrior", 2, "warrior_shield"]]), 3), null);
  assert.match(validateBuild(b([["warrior", 1, "warrior_shield"], ["monk", 1, "monk_light"]]), 3)!, /классов/);
  assert.equal(validateBuild(b([["warrior", 2, "warrior_shield"], ["monk", 1, "monk_light"]]), 6), null);
  assert.match(validateBuild(b([["warrior", 1, "mage_fire"]]), 1)!, /специализацию/);
  assert.match(validateBuild(b([["archer", 1, "archer_bow"]]), 1)!, /недоступен/);
  assert.match(validateBuild(b([["warrior", 1, "warrior_shield"]], ["opportunist"]), 3)!, /Талантов/);
  assert.equal(validateBuild(b([["warrior", 1, "warrior_shield"]], ["opportunist"]), 4), null);
  assert.match(validateBuild(b([["warrior", 2, "warrior_shield"]], ["last_stand", "blood_magic"]), 8)!, /нельзя/);
});

test("hybrid name and skills come from the two highest-ranked classes", () => {
  const paladin = b([["warrior", 2, "warrior_shield"], ["monk", 1, "monk_healing"]]);
  assert.equal(overallClass(paladin).name, "Паладин");
  assert.ok(availableSkills(paladin).some((s) => s.id === "paladin_strike"));
  assert.ok(!availableSkills(paladin).some((s) => s.id === "warrior_execute"), "spec skills of other specs are not available");
  assert.equal(overallClass(b([["warrior", 1, "warrior_shield"]])).name, "Воин");
  assert.equal(overallClass(b([["mage", 2, "mage_ice"], ["monk", 1, "monk_light"]])).name, "Маг/Монах");
});

test("stats, armor and slots derive from level and classes", () => {
  const w = heroStats(1, b([["warrior", 1, "warrior_shield"]]));
  assert.equal(w.strength, 13);
  assert.equal(w.stamina, 12);
  const mage3 = combatProfile(9, b([["mage", 4, "mage_fire"]]));
  assert.equal(mage3.stats.mastery, 8);
  assert.equal(mage3.skillSlots, 6);
  const shield = combatProfile(1, b([["warrior", 1, "warrior_shield"]]));
  const twohand = combatProfile(1, b([["warrior", 1, "warrior_twohand"]]));
  assert.ok(shield.physicalArmor > twohand.physicalArmor);
  assert.ok(shield.speedBonus <= 0.15 && shield.dodge <= 0.2 && shield.parry <= 0.2);
});

test("loadout keeps only available skills within slots", () => {
  const build = b([["warrior", 1, "warrior_shield"]], [], ["warrior_bash", "warrior_execute", "nope"]);
  const stats = heroStats(1, build);
  assert.deepEqual(effectiveLoadout(build, stats), ["warrior_bash"]);
  assert.ok(effectiveLoadout({ ...build, loadout: [] }, stats).length > 0);
});

test("every skill id is unique and random bot builds are legal", () => {
  const ids = CLASSES.flatMap((c) => [c.basic.id, ...c.skills.map((s) => s.id)]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ALL_SKILLS.size >= ids.length);
  for (const level of [1, 3, 4, 6, 9, 12, 20]) {
    for (let i = 0; i < 20; i++) assert.equal(validateBuild(randomBuild(level), level), null);
  }
});
