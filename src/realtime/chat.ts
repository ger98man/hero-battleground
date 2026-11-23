import type { IncomingMessage, Server } from "node:http";
import type { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { pool } from "../db/pool.js";
import { sessionMiddleware } from "../session.js";

/** Placeholder limits until game design settles them. */
export const CHAT_LIMITS = {
  /** Messages sent to a player when they open the page. */
  historySize: 20,
  /** Messages kept in the database per channel; older ones are deleted. */
  storedPerChannel: 200,
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
  kind: "user" | "system";
  /** null for system messages. */
  heroName: string | null;
  level: number | null;
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
  return { type: "presence", count: online.size };
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
    `SELECT m.id, m.kind, h.name AS "heroName", h.level, m.body AS text, m.created_at AS "createdAt"
       FROM chat_messages m LEFT JOIN heroes h ON h.user_id = m.user_id
      WHERE m.channel = $1
      ORDER BY m.id DESC
      LIMIT $2`,
    [channel, limit],
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) })).reverse();
}

/** The player's active battle and the users taking part in it (one in a bot battle, two in PvP). */
async function activeBattleOf(userId: number): Promise<{ channel: string; userIds: number[] } | undefined> {
  const { rows } = await pool.query<{ id: string; creator: number; opponent: number | null }>(
    `SELECT b.id, h1.user_id::int AS creator, h2.user_id::int AS opponent
       FROM battles b
       JOIN heroes h1 ON h1.id = b.hero_id
       LEFT JOIN heroes h2 ON h2.id = b.opponent_hero_id
      WHERE b.status = 'active' AND (h1.user_id = $1 OR h2.user_id = $1)
      LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return undefined;
  return { channel: `battle:${row.id}`, userIds: row.opponent === null ? [row.creator] : [row.creator, row.opponent] };
}

/** Returns an error text for the player, or undefined if the message was posted. */
async function postMessage(player: Player, raw: unknown, toBattle = false): Promise<string | undefined> {
  // Collapse whitespace so nobody can post walls of empty lines.
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "Пустое сообщение";
  if (text.length > CHAT_LIMITS.maxLength) return `Не длиннее ${CHAT_LIMITS.maxLength} символов`;

  const now = Date.now();
  const last = lastSentAt.get(player.userId) ?? 0;
  if (now - last < CHAT_LIMITS.minIntervalMs) return "Слишком часто, подождите немного";
  lastSentAt.set(player.userId, now);

  // Refresh the level in case the hero levelled up since connecting.
  const fresh = await loadPlayer(player.userId);
  if (fresh) player.level = fresh.level;
  if (!toBattle) {
    const message = await insertMessage(GLOBAL, player.userId, text, player.heroName, player.level);
    broadcast({ type: "message", message });
    return undefined;
  }
  // Battle chat: only the participants of the player's current battle see it.
  const battle = await activeBattleOf(player.userId);
  if (!battle) return "Боевой чат доступен только во время боя";
  const message = await insertMessage(battle.channel, player.userId, text, player.heroName, player.level);
  for (const userId of battle.userIds) sendToUser(userId, { type: "battle-message", message });
  return undefined;
}

async function insertMessage(
  channel: string,
  userId: number | null,
  text: string,
  heroName: string | null,
  level: number | null,
): Promise<ChatMessage> {
  const { rows } = await pool.query<{ id: string; created_at: Date }>(
    `INSERT INTO chat_messages (channel, kind, user_id, body) VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [channel, userId === null ? "system" : "user", userId, text],
  );
  const message: ChatMessage = {
    id: Number(rows[0].id),
    kind: userId === null ? "system" : "user",
    heroName,
    level,
    text,
    createdAt: rows[0].created_at.toISOString(),
  };
  await pool.query(
    `DELETE FROM chat_messages
      WHERE channel = $1
        AND id <= (SELECT id FROM chat_messages WHERE channel = $1 ORDER BY id DESC OFFSET $2 LIMIT 1)`,
    [channel, CHAT_LIMITS.storedPerChannel],
  );
  return message;
}

/**
 * Posts a system line to the global chat, e.g. "Торин победил Арвен".
 * Never throws: chat problems must not break the caller (registration, battles).
 */
export async function postSystemMessage(text: string): Promise<void> {
  try {
    broadcast({ type: "message", message: await insertMessage(GLOBAL, null, text, null, null) });
  } catch (err) {
    console.error("system chat message failed", err);
  }
}

/** Game event to every connected player (e.g. the challenge list changed). Clients refetch on it. */
export function broadcastEvent(payload: { type: string; [key: string]: unknown }) {
  broadcast(payload);
}

/** Game event to all tabs of one player (e.g. their battle changed). */
export function sendToUser(userId: number, payload: { type: string; [key: string]: unknown }) {
  for (const ws of online.get(userId) ?? []) send(ws, payload);
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
    let msg: { type?: string; text?: unknown; channel?: unknown };
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (msg.type === "battle-history") {
      const battle = await activeBattleOf(player.userId).catch(() => undefined);
      send(ws, { type: "battle-history", history: battle ? await chatHistory(battle.channel).catch(() => []) : [] });
      return;
    }
    if (msg.type !== "chat") return;
    try {
      const error = await postMessage(player, msg.text, msg.channel === "battle");
      if (error) send(ws, { type: "error", error });
    } catch (err) {
      console.error("chat post failed", err);
      send(ws, { type: "error", error: "Не удалось отправить" });
    }
  });

  try {
    send(ws, { type: "hello", limits: CHAT_LIMITS, history: await chatHistory(), count: online.size });
  } catch (err) {
    console.error("chat history failed", err);
  }
}
