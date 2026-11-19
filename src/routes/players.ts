import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import { onlineCount } from "../realtime/chat.js";

export const playersRouter = Router();

/** Public: shown on the login page too. */
playersRouter.get("/online", (_req, res) => {
  res.json({ count: onlineCount() });
});

/** Another player's hero, opened by clicking a name in chat. */
playersRouter.get("/heroes/:name", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT name, level, health, attack, defense, speed, wins, losses, created_at AS "createdAt"
       FROM heroes WHERE lower(name) = lower($1)`,
    [req.params.name],
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Герой не найден" });
    return;
  }
  res.json({ hero: rows[0] });
});
