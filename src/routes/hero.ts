import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";

export const heroRouter = Router();

/** XP needed to go from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return 100 * level;
}

heroRouter.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT h.id, h.name, h.level, h.experience, h.health, h.attack, h.defense, h.speed,
            h.wins, h.losses, h.created_at, u.username
       FROM heroes h JOIN users u ON u.id = h.user_id
      WHERE h.user_id = $1`,
    [req.session.userId],
  );
  const hero = rows[0];
  if (!hero) {
    res.status(404).json({ error: "Герой не найден" });
    return;
  }
  res.json({ hero: { ...hero, experienceToNext: xpForNextLevel(hero.level) } });
});
