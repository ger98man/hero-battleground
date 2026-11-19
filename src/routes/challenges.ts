import { Router, type Response } from "express";
import { requireAuth } from "../session.js";
import { getHeroByUser } from "../services/heroes.js";
import {
  cancelChallenge,
  createChallenge,
  heroInBattle,
  joinChallenge,
  listChallenges,
  PVP_RULES,
  PvpError,
} from "../services/pvp.js";
import { pool } from "../db/pool.js";

/** PvP challenges ("заявки на бой"): list, create, cancel, join. */
export const challengesRouter = Router();
challengesRouter.use(requireAuth);

function fail(res: Response, err: unknown) {
  if (err instanceof PvpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  throw err;
}

/** All open challenges (newest first) plus what the client needs to filter by level. */
challengesRouter.get("/", async (req, res) => {
  const hero = await getHeroByUser(req.session.userId!);
  if (!hero) {
    res.status(404).json({ error: "Герой не найден" });
    return;
  }
  res.json({
    challenges: await listChallenges(hero.id),
    myLevel: hero.level,
    inBattle: await heroInBattle(pool, hero.id),
    rules: PVP_RULES,
    serverNow: new Date().toISOString(),
  });
});

challengesRouter.post("/", async (req, res) => {
  try {
    const id = await createChallenge(req.session.userId!);
    res.status(201).json({ id });
  } catch (err) {
    fail(res, err);
  }
});

challengesRouter.post("/:id/cancel", async (req, res) => {
  try {
    await cancelChallenge(req.session.userId!, Number(req.params.id) || 0);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

challengesRouter.post("/:id/join", async (req, res) => {
  try {
    const battleId = await joinChallenge(req.session.userId!, Number(req.params.id) || 0);
    res.status(201).json({ battleId });
  } catch (err) {
    fail(res, err);
  }
});
