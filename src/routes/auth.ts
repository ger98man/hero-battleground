import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";
import { requireAuth } from "../session.js";
import { postSystemMessage } from "../realtime/chat.js";

export const authRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const HERO_NAME_RE = /^[\p{L}\p{N}_ -]{3,20}$/u;

function regenerate(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
}

authRouter.post("/register", async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");
  const heroName = String(req.body?.heroName ?? "").trim();

  if (!USERNAME_RE.test(username)) {
    res.status(400).json({ error: "Логин: 3–20 символов, латиница, цифры или _" });
    return;
  }
  if (password.length < 8 || password.length > 72) {
    res.status(400).json({ error: "Пароль: от 8 до 72 символов" });
    return;
  }
  if (!HERO_NAME_RE.test(heroName)) {
    res.status(400).json({ error: "Имя героя: 3–20 символов, буквы, цифры, пробел, _ или -" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
      [username, passwordHash],
    );
    const userId = Number(rows[0].id);
    await client.query("INSERT INTO heroes (user_id, name) VALUES ($1, $2)", [userId, heroName]);
    await client.query("COMMIT");

    await regenerate(req);
    req.session.userId = userId;
    res.status(201).json({ ok: true });
    void postSystemMessage(`Новый игрок: ${heroName}`);
  } catch (err: unknown) {
    await client.query("ROLLBACK").catch(() => {});
    const e = err as { code?: string; constraint?: string };
    if (e.code === "23505") {
      const msg = e.constraint?.startsWith("heroes") ? "Имя героя уже занято" : "Логин уже занят";
      res.status(409).json({ error: msg });
      return;
    }
    throw err;
  } finally {
    client.release();
  }
});

authRouter.post("/login", async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  const { rows } = await pool.query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE lower(username) = lower($1)",
    [username],
  );
  const user = rows[0];
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !ok) {
    res.status(401).json({ error: "Неверный логин или пароль" });
    return;
  }

  await regenerate(req);
  req.session.userId = Number(user.id);
  res.json({ ok: true });
});

authRouter.post("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("hb.sid");
    res.json({ ok: true });
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query("SELECT id, username, created_at FROM users WHERE id = $1", [req.session.userId]);
  res.json({ user: rows[0] ?? null });
});
