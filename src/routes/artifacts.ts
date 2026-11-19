import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import { getArtifact } from "../game/artifacts.js";
import { catalogView, getHeroByUser, ownedArtifactIds } from "../services/heroes.js";

export const artifactsRouter = Router();
artifactsRouter.use(requireAuth);

artifactsRouter.get("/", async (req, res) => {
  const hero = await getHeroByUser(req.session.userId!);
  if (!hero) {
    res.status(404).json({ error: "Герой не найден" });
    return;
  }
  const owned = await ownedArtifactIds(hero.id);
  res.json({ artifacts: catalogView(owned, hero.equipped_artifact), needsStarter: owned.length === 0 });
});

/** First artifact: only once, only from the starter set. */
artifactsRouter.post("/starter", async (req, res) => {
  const artifact = getArtifact(String(req.body?.artifactId ?? ""));
  if (!artifact?.starter) {
    res.status(400).json({ error: "Этот артефакт нельзя выбрать как стартовый" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hero = await getHeroByUser(req.session.userId!, client, true);
    if (!hero) throw new Error("hero not found");
    if ((await ownedArtifactIds(hero.id, client)).length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Стартовый артефакт уже выбран" });
      return;
    }
    await client.query("INSERT INTO hero_artifacts (hero_id, artifact_id, source) VALUES ($1, $2, 'starter')", [hero.id, artifact.id]);
    await client.query("UPDATE heroes SET equipped_artifact = $2 WHERE id = $1", [hero.id, artifact.id]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

/** Switch between owned artifacts. */
artifactsRouter.post("/equip", async (req, res) => {
  const artifactId = String(req.body?.artifactId ?? "");
  const { rowCount } = await pool.query(
    `UPDATE heroes h SET equipped_artifact = $2
      WHERE h.user_id = $1
        AND EXISTS (SELECT 1 FROM hero_artifacts ha WHERE ha.hero_id = h.id AND ha.artifact_id = $2)`,
    [req.session.userId, artifactId],
  );
  if (!rowCount) {
    res.status(403).json({ error: "Этого артефакта у вас нет" });
    return;
  }
  res.json({ ok: true });
});
