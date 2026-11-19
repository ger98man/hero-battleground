import express, { type ErrorRequestHandler } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sessionMiddleware } from "./session.js";
import { authRouter } from "./routes/auth.js";
import { heroRouter } from "./routes/hero.js";
import { artifactsRouter } from "./routes/artifacts.js";
import { battleRouter } from "./routes/battle.js";
import { pool } from "./db/pool.js";

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

export function createApp() {
  const app = express();
  app.set("trust proxy", 1); // Render terminates TLS in front of the app
  app.use(express.json({ limit: "10kb" }));

  app.get("/healthz", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  });

  app.use(sessionMiddleware);
  app.use("/api/auth", authRouter);
  app.use("/api/hero", heroRouter);
  app.use("/api/artifacts", artifactsRouter);
  app.use("/api/battle", battleRouter);

  /** While the hero is in a battle, the battle is the main screen. */
  const hasActiveBattle = async (userId: number) => {
    const { rowCount } = await pool.query(
      "SELECT 1 FROM battles b JOIN heroes h ON h.id = b.hero_id WHERE h.user_id = $1 AND b.status = 'active'",
      [userId],
    );
    return Boolean(rowCount);
  };

  app.get("/", async (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    res.redirect((await hasActiveBattle(req.session.userId)) ? "/battle" : "/hero");
  });
  app.get("/login", (req, res) => {
    if (req.session.userId) return res.redirect("/hero");
    res.sendFile(path.join(publicDir, "login.html"));
  });
  app.get("/hero", async (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    if (await hasActiveBattle(req.session.userId)) return res.redirect("/battle");
    res.sendFile(path.join(publicDir, "hero.html"));
  });
  app.get("/battle", (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    res.sendFile(path.join(publicDir, "battle.html"));
  });
  app.use(express.static(publicDir, { index: false }));

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  };
  app.use(onError);
  return app;
}
