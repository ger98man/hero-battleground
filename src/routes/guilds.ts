import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import { STAT_NAMES, type StatKey } from "../game/classes.js";
import { getGuild, GUILD_RULES, GUILDS } from "../game/guilds.js";
import { getHeroByUser, guildsView, heroView } from "../services/heroes.js";

export const guildsRouter = Router();
guildsRouter.use(requireAuth);

/** Guild catalog and the hero's progress in every guild. */
guildsRouter.get("/", async (req, res) => {
  const hero = await getHeroByUser(req.session.userId!);
  res.json({
    guilds: GUILDS,
    rules: GUILD_RULES,
    statNames: STAT_NAMES,
    progress: hero ? guildsView(hero.guilds) : [],
  });
});

/** Союз Наёмников: pick Сила, Ловкость or Интеллект for one earned guild level. Picks are final. */
guildsRouter.post("/:id/pick", async (req, res) => {
  const def = getGuild(req.params.id);
  const stat = String(req.body?.stat ?? "") as StatKey;
  if (!def?.statChoice) {
    res.status(400).json({ error: "В этой гильдии нечего выбирать" });
    return;
  }
  if (!def.statChoice.includes(stat)) {
    res.status(400).json({ error: "Выберите Силу, Ловкость или Интеллект" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hero = await getHeroByUser(req.session.userId!, client, true);
    if (!hero) throw new Error("hero not found");
    const g = hero.guilds.find((x) => x.guildId === def.id);
    if (!g || g.picks.length >= g.level) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Нет уровней гильдии для выбора" });
      return;
    }
    const picks = [...g.picks, stat];
    await client.query("UPDATE hero_guilds SET picks = $3 WHERE hero_id = $1 AND guild_id = $2", [hero.id, def.id, JSON.stringify(picks)]);
    await client.query("COMMIT");
    const guilds = hero.guilds.map((x) => (x.guildId === def.id ? { ...x, picks } : x));
    res.json({ progress: guildsView(guilds), hero: heroView({ ...hero, guilds }) });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

