import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import { getArtifact } from "../game/artifacts.js";
import { xpForNextLevel } from "../game/stats.js";
import { heroCombatStats, ownedArtifactIds } from "../services/heroes.js";

export const heroRouter = Router();

heroRouter.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT h.id::int, h.name, h.level, h.experience, h.health, h.attack, h.defense, h.speed,
            h.wins, h.losses, h.equipped_artifact, h.created_at, u.username
       FROM heroes h JOIN users u ON u.id = h.user_id
      WHERE h.user_id = $1`,
    [req.session.userId],
  );
  const hero = rows[0];
  if (!hero) {
    res.status(404).json({ error: "Герой не найден" });
    return;
  }
  const owned = await ownedArtifactIds(hero.id);
  res.json({
    hero: {
      ...hero,
      experienceToNext: xpForNextLevel(hero.level),
      artifact: getArtifact(hero.equipped_artifact) ?? null,
      combat: heroCombatStats(hero),
      ownedArtifacts: owned,
      needsStarterArtifact: owned.length === 0,
    },
  });
});
