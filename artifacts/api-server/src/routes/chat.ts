/**
 * POST /api/chat
 *
 * Chat endpoint with per-session in-memory history.
 * Body:  { message: string, session_id?: string }
 * Returns: { response: string, session_id: string }
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { generateAiResponse, KNOWEDGE_SYSTEM_PROMPT, type ChatMessage } from "../services/aiService";
import { logger } from "../lib/logger";
import crypto from "node:crypto";

const router: IRouter = Router();

// ── Request schema ─────────────────────────────────────────────────────────
const ChatBody = z.object({
  message:    z.string().min(1).max(2000),
  session_id: z.string().optional(),
  mode:       z.enum(["student", "career", "retiree"]).optional(),
});

// ── In-memory session store ────────────────────────────────────────────────
// Structure: Map<session_id, ChatMessage[]>
// Each session keeps the last MAX_HISTORY turns to control token usage.
const MAX_HISTORY   = 20;   // total messages kept per session (user + assistant)
const SESSION_TTL   = 60 * 60 * 1000; // 1 hour in ms — sessions expire after idle
const MAX_SESSIONS  = 1000; // cap to avoid unbounded memory growth

interface SessionEntry {
  history: ChatMessage[];
  lastUsed: number;
}

const sessions = new Map<string, SessionEntry>();

/** Return or create a session. Also evicts stale sessions when near the cap. */
function getSession(id: string): SessionEntry {
  const now = Date.now();

  // Evict oldest sessions if we're at the cap
  if (!sessions.has(id) && sessions.size >= MAX_SESSIONS) {
    let oldest = { id: "", ts: Infinity };
    for (const [sid, entry] of sessions) {
      if (entry.lastUsed < oldest.ts) oldest = { id: sid, ts: entry.lastUsed };
    }
    if (oldest.id) sessions.delete(oldest.id);
  }

  if (!sessions.has(id)) {
    sessions.set(id, { history: [], lastUsed: now });
  }

  const session = sessions.get(id)!;
  session.lastUsed = now;

  // Evict sessions idle longer than TTL (passive cleanup)
  if (now - session.lastUsed > SESSION_TTL) {
    sessions.delete(id);
    sessions.set(id, { history: [], lastUsed: now });
  }

  return sessions.get(id)!;
}

/** Trim history to the last MAX_HISTORY messages. */
function trimHistory(history: ChatMessage[]): ChatMessage[] {
  return history.length > MAX_HISTORY
    ? history.slice(history.length - MAX_HISTORY)
    : history;
}

/** Build a mode-specific system prompt. */
function buildSystemPrompt(mode?: string): string {
  const modeContext: Record<string, string> = {
    student:  " The user is a student — focus on allowance management, saving habits, SIP basics, and long-term compounding. Keep advice approachable and jargon-free.",
    career:   " The user is a working professional — focus on salary optimisation, Section 80C tax savings, EPF/NPS, and wealth accumulation through equity SIPs.",
    retiree:  " The user is retired or near retirement — focus on capital preservation, SCSS, RBI Floating Rate Bonds, safe withdrawal rate, and health-care cost planning.",
  };
  return KNOWEDGE_SYSTEM_PROMPT + (mode ? (modeContext[mode] ?? "") : "");
}

// ── Route ──────────────────────────────────────────────────────────────────
router.post("/chat", async (req, res): Promise<void> => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues.map((i) => i.message),
    });
    return;
  }

  const { message, mode } = parsed.data;
  const session_id = parsed.data.session_id ?? crypto.randomUUID();

  const session = getSession(session_id);

  logger.info(
    { session_id, mode, messageLength: message.length, historyLength: session.history.length },
    "Chat request received",
  );

  const systemPrompt = buildSystemPrompt(mode);

  // Call the AI service (falls back gracefully if no LLM key)
  const response = await generateAiResponse(systemPrompt, message, session.history);

  // Append to session history and trim
  session.history.push({ role: "user",      content: message  });
  session.history.push({ role: "assistant", content: response });
  session.history = trimHistory(session.history);

  res.json({ response, session_id });
});

export default router;
