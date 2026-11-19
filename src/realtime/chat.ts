import type { IncomingMessage, Server } from "node:http";
import type { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { pool } from "../db/pool.js";
import { sessionMiddleware } from "../session.js";

/** Placeholder limits until game design settles them. */
export const CHAT_LIMITS = {
  historySize: 50,
  maxLength: 200,
  minIntervalMs: 2000,
};

const GLOBAL = "global";
const HEARTBEAT_MS = 30_000;

interface Player {
  userId: number;
  heroName: string;
  level: number;
}

interface Client extends WebSocket {
  player: Player;
  alive: boolean;
}

export interface ChatMessage {
  id: number;
  heroName: string;
  level: number;
  text: string;
  createdAt: string;
}

/** userId -> open sockets. A player with several tabs counts once. */
const online = new Map<number, Set<Client>>();
const lastSentAt = new Map<number, number>();

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(payload: unknown) {
  const data = JSON.stringify(payload);
  for (const sockets of online.values()) {
    for (const ws of sockets) if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function presence() {
  const players = [...online.values()]
    .map((sockets) => sockets.values().next().value!.player)
    .map(({ heroName, level }) => ({ heroName, level }))
    .sort((a, b) => a.heroName.localeCompare(b.heroName));
  return { type: "presence", count: players.length, players };
}

/** Coalesce join/leave bursts (page reloads) into one presence update. */
let presenceTimer: NodeJS.Timeout | undefined;
function schedulePresence() {
  if (presenceTimer) return;
  presenceTimer = setTimeout(() => {
    presenceTimer = undefined;
    broadcast(presence());
  }, 250);
}

/** Runs express-session on the upgrade request to find out who is connecting. */
function authenticate(req: IncomingMessage): Promise<number | undefined> {
  return new Promise((resolve) => {
    const r = req as Request;
    sessionMiddleware(r, {} as Response, (err?: unknown) => resolve(err ? undefined : r.session?.userId));
  });
}

async function loadPlayer(userId: number): Promise<Player | undefined> {
  const { rows } = await pool.query<{ name: string; level: number }>(
    "SELECT name, level FROM heroes WHERE user_id = $1",
    [userId],
  );
  return rows[0] && { userId, heroName: rows[0].name, level: rows[0].level };
}

export async function chatHistory(channel = GLOBAL, limit = CHAT_LIMITS.historySize): Promise<ChatMessage[]> {
  const { rows } = await pool.query(
    `SELECT m.id, h.name AS "heroName", h.level, m.body AS text, m.created_at AS "createdAt"
       FROM chat_messages m JOIN heroes h ON h.user_id = m.user_id
      WHERE m.channel = $1
      ORDER BY m.id DESC
      LIMIT $2`,
    [channel, limit],
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) })).reverse();
}

/** Returns an error text for the player, or undefined if the message was posted. */
async function postMessage(player: Player, raw: unknown): Promise<string | undefined> {
  // Collapse whitespace so nobody can post walls of empty lines.
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "Пустое сообщение";
  if (text.length > CHAT_LIMITS.maxLength) return `Не длиннее ${CHAT_LIMITS.maxLength} символов`;

  const now = Date.now();
  const last = lastSentAt.get(player.userId) ?? 0;
  if (now - last < CHAT_LIMITS.minIntervalMs) return "Слишком часто, подождите немного";
  lastSentAt.set(player.userId, now);

  const { rows } = await pool.query<{ id: string; created_at: Date }>(
    "INSERT INTO chat_messages (channel, user_id, body) VALUES ($1, $2, $3) RETURNING id, created_at",
    [GLOBAL, player.userId, text],
  );
  const message: ChatMessage = {
    id: Number(rows[0].id),
    heroName: player.heroName,
    level: player.level,
    text,
    createdAt: rows[0].created_at.toISOString(),
  };
  broadcast({ type: "message", message });
  return undefined;
}

export function onlineCount(): number {
  return online.size;
}

/** Attaches the chat/presence WebSocket endpoint at /ws to the HTTP server. */
export function attachChat(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });

  server.on("upgrade", async (req, socket, head) => {
    if (new URL(req.url ?? "/", "http://x").pathname !== "/ws") return socket.destroy();
    try {
      const userId = await authenticate(req);
      const player = userId ? await loadPlayer(userId) : undefined;
      if (!player) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        return socket.destroy();
      }
      wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws as Client, player));
    } catch (err) {
      console.error("ws upgrade failed", err);
      socket.destroy();
    }
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients as Set<Client>) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);
  wss.on("close", () => clearInterval(heartbeat));
  return wss;
}

async function onConnection(ws: Client, player: Player) {
  ws.player = player;
  ws.alive = true;
  ws.on("pong", () => (ws.alive = true));

  let sockets = online.get(player.userId);
  if (!sockets) online.set(player.userId, (sockets = new Set()));
  sockets.add(ws);
  schedulePresence();

  ws.on("close", () => {
    const set = online.get(player.userId);
    set?.delete(ws);
    if (set && set.size === 0) online.delete(player.userId);
    schedulePresence();
  });

  ws.on("message", async (data) => {
    let msg: { type?: string; text?: unknown };
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (msg.type !== "chat") return;
    try {
      const error = await postMessage(player, msg.text);
      if (error) send(ws, { type: "error", error });
    } catch (err) {
      console.error("chat post failed", err);
      send(ws, { type: "error", error: "Не удалось отправить" });
    }
  });

  try {
    const { count, players } = presence();
    send(ws, { type: "hello", limits: CHAT_LIMITS, history: await chatHistory(), count, players });
  } catch (err) {
    console.error("chat history failed", err);
  }
}
