import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import { getArtifact, SHARDS_TO_CRAFT } from "../game/artifacts.js";
import { catalogView, getHeroByUser, ownedArtifacts, shardCounts } from "../services/heroes.js";

export const artifactsRouter = Router();
artifactsRouter.use(requireAuth);

artifactsRouter.get("/", async (req, res) => {
  const hero = await getHeroByUser(req.session.userId!);
  if (!hero) {
    res.status(404).json({ error: "Герой не найден" });
    return;
  }
  const owned = await ownedArtifacts(hero.id);
  const shards = await shardCounts(hero.id);
  res.json({ artifacts: catalogView(owned, shards, hero.equipped_artifact), needsStarter: owned.length === 0 });
});

/** Runs `fn` in a transaction with the current hero row locked. */
async function withHero<T>(userId: number, fn: (client: import("pg").PoolClient, heroId: number) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hero = await getHeroByUser(userId, client, true);
    if (!hero) throw new Error("hero not found");
    const result = await fn(client, hero.id);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** First artifact: only once, only one from the starter set. */
artifactsRouter.post("/starter", async (req, res) => {
  const artifact = getArtifact(String(req.body?.artifactId ?? ""));
  try {
    if (!artifact?.starter) throw new HttpError(400, "Этот артефакт нельзя выбрать как стартовый");
    await withHero(req.session.userId!, async (client, heroId) => {
      if ((await ownedArtifacts(heroId, client)).length > 0) throw new HttpError(409, "Стартовый артефакт уже выбран");
      await client.query("INSERT INTO hero_artifacts (hero_id, artifact_id, source) VALUES ($1, $2, 'starter')", [heroId, artifact.id]);
      await client.query("UPDATE heroes SET equipped_artifact = $2 WHERE id = $1", [heroId, artifact.id]);
    });
    res.json({ ok: true });
  } catch (err) {
    if (!(err instanceof HttpError)) throw err;
    res.status(err.status).json({ error: err.message });
  }
});

/** Craft an artifact from its shards. */
artifactsRouter.post("/craft", async (req, res) => {
  const artifact = getArtifact(String(req.body?.artifactId ?? ""));
  try {
    if (!artifact) throw new HttpError(400, "Нет такого артефакта");
    await withHero(req.session.userId!, async (client, heroId) => {
      const owned = await ownedArtifacts(heroId, client);
      if (owned.length === 0) throw new HttpError(409, "Сначала выберите стартовый артефакт");
      if (owned.some((o) => o.artifactId === artifact.id)) throw new HttpError(409, "Этот артефакт уже есть");
      const { rowCount } = await client.query(
        "UPDATE artifact_shards SET amount = amount - $3 WHERE hero_id = $1 AND artifact_id = $2 AND amount >= $3",
        [heroId, artifact.id, SHARDS_TO_CRAFT],
      );
      if (!rowCount) throw new HttpError(400, `Нужно ${SHARDS_TO_CRAFT} осколков`);
      await client.query("INSERT INTO hero_artifacts (hero_id, artifact_id, source) VALUES ($1, $2, 'craft')", [heroId, artifact.id]);
    });
    res.json({ ok: true });
  } catch (err) {
    if (!(err instanceof HttpError)) throw err;
    res.status(err.status).json({ error: err.message });
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
