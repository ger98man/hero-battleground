import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import { artifactBonuses, getArtifact } from "../game/artifacts.js";
import { xpForNextLevel } from "../game/stats.js";
import { artifactProgress, heroCombatStats, ownedArtifacts } from "../services/heroes.js";

export const heroRouter = Router();

heroRouter.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT h.id::int, h.name, h.level, h.experience, h.health, h.attack, h.defense, h.speed,
            h.wins, h.losses, h.bot_wins, h.bot_losses, h.equipped_artifact, h.created_at, u.username
       FROM heroes h JOIN users u ON u.id = h.user_id
      WHERE h.user_id = $1`,
    [req.session.userId],
  );
  const hero = rows[0];
  if (!hero) {
    res.status(404).json({ error: "Герой не найден" });
    return;
  }
  const owned = await ownedArtifacts(hero.id);
  const equipped = owned.find((o) => o.artifactId === hero.equipped_artifact);
  const artifact = getArtifact(hero.equipped_artifact);
  res.json({
    hero: {
      ...hero,
      experienceToNext: xpForNextLevel(hero.level),
      artifact: artifact ? { ...artifact, currentBonuses: artifactBonuses(artifact, equipped?.level ?? 1) } : null,
      artifactProgress: equipped ? artifactProgress(equipped) : null,
      combat: heroCombatStats(hero, equipped?.level ?? 1),
      ownedArtifacts: owned.map((o) => o.artifactId),
      needsStarterArtifact: owned.length === 0,
    },
  });
});
