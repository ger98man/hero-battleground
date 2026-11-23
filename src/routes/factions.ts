import { Router } from "express";
import { FACTIONS, leadership, MAX_ARMY_STACKS, TIER_UNLOCK_LEVEL } from "../game/factions.js";

export const factionsRouter = Router();

/** Static game data for the faction choice and the army screen: factions, heroes, unit rosters. */
factionsRouter.get("/", (_req, res) => {
  res.json({
    factions: FACTIONS,
    rules: { MAX_ARMY_STACKS, TIER_UNLOCK_LEVEL, leadershipByLevel: Array.from({ length: 30 }, (_, i) => leadership(i + 1)) },
  });
});
