import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { RequestHandler } from "express";
import { pool } from "./db/pool.js";
import { config } from "./config.js";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const PgStore = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgStore({ pool, tableName: "user_sessions" }),
  secret: config.sessionSecret,
  name: "hb.sid",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  },
});

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Нужно войти" });
    return;
  }
  next();
};
