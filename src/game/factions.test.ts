import { test } from "node:test";
import assert from "node:assert/strict";
import { armyCost, defaultArmy, FACTIONS, FactionId, leadership, MAX_ARMY_STACKS, parseArmy, validateArmy } from "./factions.js";

test("every faction has 4 heroes and 7 tiers with 2 units, all ids unique", () => {
  assert.equal(FACTIONS.length, 4);
  const ids = FACTIONS.flatMap((f) => [...f.heroes.map((h) => h.id), ...f.tiers.flatMap((t) => t.units.map((u) => u.id))]);
  assert.equal(new Set(ids).size, ids.length);
  for (const f of FACTIONS) {
    assert.equal(f.heroes.length, 4, f.name);
    assert.deepEqual(f.tiers.map((t) => t.tier), [1, 2, 3, 4, 5, 6, 7]);
    for (const t of f.tiers) assert.equal(t.units.length, 2);
  }
});

test("default army uses unlocked tiers and fits into leadership", () => {
  for (const level of [1, 5, 12, 20]) {
    for (const f of FACTIONS) {
      const army = defaultArmy({ faction: f.id, level });
      assert.ok(army.length > 0);
      assert.ok(armyCost(army) <= leadership(level));
      assert.equal(validateArmy({ army, faction: f.id, level }), null, `${f.name} at level ${level}`);
    }
  }
  assert.equal(defaultArmy({ faction: FactionId.Dawn, level: 1 }).length, 2, "tiers 1-2 at level 1");
  assert.equal(defaultArmy({ faction: FactionId.Dawn, level: 12 }).length, 7, "all tiers at level 12");
});

test("army validation: faction, duplicates, tier unlock, leadership, stack limit", () => {
  const ok = [{ unitId: "dawn_militia", count: 10 }];
  assert.equal(validateArmy({ army: ok, faction: FactionId.Dawn, level: 1 }), null);
  assert.match(validateArmy({ army: [{ unitId: "rot_skeleton", count: 5 }], faction: FactionId.Dawn, level: 1 }) ?? "", /своей фракции/);
  assert.match(validateArmy({ army: [...ok, ...ok], faction: FactionId.Dawn, level: 1 }) ?? "", /одним отрядом/);
  assert.match(validateArmy({ army: [{ unitId: "dawn_militia", count: 0 }], faction: FactionId.Dawn, level: 1 }) ?? "", /хотя бы одно/);
  assert.match(validateArmy({ army: [{ unitId: "dawn_guardian", count: 1 }], faction: FactionId.Dawn, level: 11 }) ?? "", /12 уровне/);
  assert.match(validateArmy({ army: [{ unitId: "dawn_militia", count: leadership(1) + 1 }], faction: FactionId.Dawn, level: 1 }) ?? "", /лидерства/);
  const eight = FACTIONS[0].tiers.flatMap((t) => t.units).slice(0, MAX_ARMY_STACKS + 1).map((u) => ({ unitId: u.id, count: 1 }));
  assert.match(validateArmy({ army: eight, faction: FactionId.Dawn, level: 30 }) ?? "", /отрядов/);
});

test("parseArmy keeps only the expected shape", () => {
  assert.deepEqual(parseArmy("nope"), []);
  assert.deepEqual(parseArmy([{ unitId: "dawn_militia", count: "7.9" }, null]), [
    { unitId: "dawn_militia", count: 7 },
    { unitId: "", count: 0 },
  ]);
});

test("faction heroes replace classes: their class lines are playable and legal at every level", async () => {
  const { getClass } = await import("./classes.js");
  const { validateBuild } = await import("./build.js");
  const { heroClasses } = await import("./factions.js");
  for (const f of FACTIONS) {
    for (const h of f.heroes) {
      assert.ok(h.classes.length >= 1 && h.classes.length <= 2, h.name);
      for (const line of h.classes) {
        const def = getClass(line.id);
        assert.ok(def?.playable, `${h.name}: ${line.id}`);
        assert.ok(def?.specs.some((s) => s.id === line.spec), `${h.name}: ${line.spec}`);
      }
      for (let level = 1; level <= 30; level++) {
        const classes = heroClasses({ hero: h, level });
        assert.equal(validateBuild({ classes, talents: [], loadout: [] }, level), null, `${h.name} at level ${level}`);
      }
    }
  }
  const paladin = FACTIONS[0].heroes[0];
  assert.deepEqual(heroClasses({ hero: paladin, level: 5 }).map((c) => c.rank), [2], "second line closed before level 6");
  assert.deepEqual(heroClasses({ hero: paladin, level: 6 }).map((c) => c.rank), [2, 1]);
  assert.deepEqual(heroClasses({ hero: paladin, level: 12 }).map((c) => c.rank), [4, 1]);
});
