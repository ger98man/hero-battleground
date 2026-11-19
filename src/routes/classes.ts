import { Router } from "express";
import { BASE_SKILL_SLOTS, CLASSES, HYBRIDS, MASTERY_PER_SLOT, MAX_CLASS_RANK, MAX_CLASSES, MAX_SKILL_SLOTS, STAT_NAMES, TALENT_EVERY, TALENTS } from "../game/classes.js";

export const classesRouter = Router();

/** Static game data for the hero page and the wiki: classes, specs, skills, hybrids, talents. */
classesRouter.get("/", (_req, res) => {
  res.json({
    classes: CLASSES,
    hybrids: HYBRIDS,
    talents: TALENTS,
    statNames: STAT_NAMES,
    rules: { MAX_CLASSES, MAX_CLASS_RANK, BASE_SKILL_SLOTS, MASTERY_PER_SLOT, MAX_SKILL_SLOTS, TALENT_EVERY },
  });
});
