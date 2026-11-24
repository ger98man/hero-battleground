import { Router } from "express";
import { FACTIONS, leadership, UNIT_TAGS, MAX_ARMY_STACKS, TIER_UNLOCK_LEVEL } from "../game/factions.js";

export const factionsRouter = Router();

/** Static game data for the faction choice and the army screen: factions, heroes, unit rosters. */
factionsRouter.get("/", (_req, res) => {
  res.json({
    factions: FACTIONS,
    tags: UNIT_TAGS,
    rules: { MAX_ARMY_STACKS, TIER_UNLOCK_LEVEL, leadershipByLevel: Array.from({ length: 30 }, (_, i) => leadership(i + 1)) },
  });
});
