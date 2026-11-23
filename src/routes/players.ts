import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import { onlineCount } from "../realtime/chat.js";
import { overallClass, parseBuild } from "../game/build.js";
import { getClass } from "../game/classes.js";

export const playersRouter = Router();

/** Public: shown on the login page too. */
playersRouter.get("/online", (_req, res) => {
  res.json({ count: onlineCount() });
});

/** Another player's hero, opened by clicking a name in chat. */
playersRouter.get("/heroes/:name", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT name, level, build, faction, faction_hero AS "factionHero", wins, losses, bot_wins AS "botWins", bot_losses AS "botLosses", created_at AS "createdAt"
       FROM heroes WHERE lower(name) = lower($1)`,
    [req.params.name],
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Герой не найден" });
    return;
  }
  const { build, ...hero } = rows[0];
  const b = parseBuild(build);
  res.json({
    hero: {
      ...hero,
      className: overallClass(b).name,
      classes: b.classes.map((c) => ({ name: getClass(c.id)?.name ?? c.id, rank: c.rank })),
    },
  });
});
