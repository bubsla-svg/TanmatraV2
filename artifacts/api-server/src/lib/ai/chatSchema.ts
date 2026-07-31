import { z } from "zod/v4";

/**
 * Shared request schema for the agent chat routes (ops, cms, coach, support,
 * forecasting). All five previously declared byte-identical copies of this
 * inline; the copies are the reason OA-MED-1.7 existed in all five at once.
 *
 * OA-MED-1.7 (TODO_optimization-auditor.md): `text` had no `.max()` while the
 * sibling `message` field was capped at 8000, and up to 50 turns are forwarded
 * verbatim to the model on every request. That made history a per-request lever
 * to inflate input-token billing well past what an IP-keyed request-count
 * limiter bounds — 50 unbounded turns cost far more than one 8000-char message,
 * and the limiter counts them the same.
 *
 * The cap matches `message`'s existing 8000 so a turn can hold a full prior
 * message and nothing more: 50 × 8000 is the worst case, which is a bounded
 * (if still large) prompt rather than an open one.
 */
export const MAX_CHAT_TURN_CHARS = 8000;
export const MAX_CHAT_HISTORY_TURNS = 50;

export const ChatTurnSchema = z.object({
  role: z.enum(["user", "agent"]),
  text: z.string().max(MAX_CHAT_TURN_CHARS),
});

export const ChatHistorySchema = z
  .array(ChatTurnSchema)
  .max(MAX_CHAT_HISTORY_TURNS)
  .optional();

export type ChatTurn = z.infer<typeof ChatTurnSchema>;
