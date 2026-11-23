import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import { parseBuild, validateBuild } from "../game/build.js";
import { getHeroByUser, heroView, type HeroRow } from "../services/heroes.js";
import { defaultArmy, getFaction, getFactionHero, isFactionId, parseArmy, validateArmy, type ArmyStack } from "../game/factions.js";

export const heroRouter = Router();
heroRouter.use(requireAuth);

heroRouter.get("/", async (req, res) => {
  const hero = await getHeroByUser(req.session.userId!);
  if (!hero) {
    res.status(404).json({ error: "Герой не найден" });
    return;
  }
  const { rows } = await pool.query<{ username: string }>("SELECT username FROM users WHERE id = $1", [req.session.userId]);
  res.json({ hero: { ...heroView(hero), username: rows[0]?.username } });
});

/** Save the whole build (classes, specs, talents, skill loadout). Free to change outside battle. */
heroRouter.post("/build", async (req, res) => {
  const build = parseBuild(req.body?.build);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hero = await getHeroByUser(req.session.userId!, client, true);
    if (!hero) throw new Error("hero not found");
    const { rowCount } = await client.query("SELECT 1 FROM battles WHERE hero_id = $1 AND status = 'active'", [hero.id]);
    const error = rowCount ? "Во время боя менять билд нельзя" : validateBuild(build, hero.level);
    if (error) {
      await client.query("ROLLBACK");
      res.status(400).json({ error });
      return;
    }
    await client.query("UPDATE heroes SET build = $2 WHERE id = $1", [hero.id, build]);
    await client.query("COMMIT");
    res.json({ hero: heroView({ ...hero, build }) });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

type FactionState = { faction: string | null; faction_hero: string | null; army: ArmyStack[] };
type FactionUpdate = (hero: HeroRow) => { error: string } | { next: FactionState };

/** Locks the hero row, refuses changes during a battle, saves faction/hero/army and returns the new hero view. */
async function updateFactionState(userId: number, update: FactionUpdate): Promise<{ status: number; body: unknown }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hero = await getHeroByUser(userId, client, true);
    if (!hero) throw new Error("hero not found");
    const { rowCount } = await client.query(
      "SELECT 1 FROM battles WHERE (hero_id = $1 OR opponent_hero_id = $1) AND status = 'active'",
      [hero.id],
    );
    const result = rowCount ? { error: "Во время боя менять это нельзя" } : update(hero);
    if ("error" in result) {
      await client.query("ROLLBACK");
      return { status: 400, body: { error: result.error } };
    }
    const { faction, faction_hero, army } = result.next;
    await client.query("UPDATE heroes SET faction = $2, faction_hero = $3, army = $4 WHERE id = $1", [
      hero.id,
      faction,
      faction_hero,
      JSON.stringify(army),
    ]);
    await client.query("COMMIT");
    return { status: 200, body: { hero: heroView({ ...hero, ...result.next }) } };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Choose the faction (once, for good) and one of its four heroes (can be changed later).
 * Choosing the faction also gives the starting army.
 */
heroRouter.post("/faction", async (req, res) => {
  const factionId = String(req.body?.faction ?? "");
  const heroId = String(req.body?.hero ?? "");
  const { status, body } = await updateFactionState(req.session.userId ?? 0, (hero) => {
    if (hero.faction && hero.faction !== factionId) return { error: "Фракцию выбирают один раз" };
    const faction = getFaction(factionId);
    if (!faction) return { error: "Нет такой фракции" };
    if (!getFactionHero(faction, heroId)) return { error: "У этой фракции нет такого героя" };
    const army = hero.faction ? hero.army : defaultArmy({ faction: faction.id, level: hero.level });
    return { next: { faction: faction.id, faction_hero: heroId, army } };
  });
  res.status(status).json(body);
});

/** Save the army: which units of the faction and how many, within leadership. */
heroRouter.post("/army", async (req, res) => {
  const army = parseArmy(req.body?.army);
  const { status, body } = await updateFactionState(req.session.userId ?? 0, (hero) => {
    if (!hero.faction || !isFactionId(hero.faction)) return { error: "Сначала выберите фракцию" };
    const error = validateArmy({ army, faction: hero.faction, level: hero.level });
    if (error) return { error };
    return { next: { faction: hero.faction, faction_hero: hero.faction_hero, army } };
  });
  res.status(status).json(body);
});
