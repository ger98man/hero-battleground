import { Router } from "express";
import { STAT_RULES, UNIT_ATTRIBUTE_NAMES } from "../game/stats.js";
import { DAMAGE_SCALE, STACK_VS_HERO } from "../game/battle.js";
import { BASE_SKILL_SLOTS, CLASSES, HYBRIDS, LEVELS_PER_SLOT, MAX_CLASS_RANK, MAX_CLASSES, MAX_SKILL_SLOTS, STAT_NAMES, TALENT_EVERY, TALENTS } from "../game/classes.js";

export const classesRouter = Router();

/** Static game data for the hero page and the wiki: classes, specs, skills, hybrids, talents. */
classesRouter.get("/", (_req, res) => {
  res.json({
    classes: CLASSES,
    hybrids: HYBRIDS,
    talents: TALENTS,
    statNames: STAT_NAMES,
    rules: { MAX_CLASSES, MAX_CLASS_RANK, BASE_SKILL_SLOTS, LEVELS_PER_SLOT, MAX_SKILL_SLOTS, TALENT_EVERY },
    statRules: { ...STAT_RULES, damageScale: DAMAGE_SCALE, stackVsHero: STACK_VS_HERO },
    unitAttributeNames: UNIT_ATTRIBUTE_NAMES,
  });
});
