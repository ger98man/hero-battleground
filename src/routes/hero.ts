import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import { parseBuild, validateBuild } from "../game/build.js";
import { getHeroByUser, heroView } from "../services/heroes.js";

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
