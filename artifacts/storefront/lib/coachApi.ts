/**
 * Nutrition-coach chat client (Wave-3). POST /coach-agent/chat streams NDJSON
 * (one JSON event per line). Auth-required (401 signed out); rate-limited
 * 30/5min (429). The SERVER owns all safety: a deterministic, eval-covered
 * preflight refuses clinical questions and emits a book_rd card BEFORE the
 * model runs; tools are read-only or prepare-only; a "not medical advice"
 * disclaimer is mandatory. This client only transports + renders.
 */
import { API_BASE, ApiError, type FetchImpl } from "./apiClient";

/** History turns use role "agent" (not "assistant") per the server contract. */
export interface ChatTurn {
  role: "user" | "agent";
  text: string;
}

export interface BookRdAction {
  kind: "book_rd";
  href: string;
  appointmentsHref: string;
  reason: string;
  urgency: "routine" | "soon";
  premiumConsultsRemaining: number | null;
}

export interface AddToCartAction {
  kind: "add_to_cart";
  slug: string;
  name: string;
  image: string;
  quantity: number;
  target: "cart" | "next_delivery" | "replace_in_cart";
  replaceSlug: string | null;
  pricePaise: number;
  priceLabel: string;
  reasoning: string;
}

export type CoachAction = BookRdAction | AddToCartAction;

export type CoachEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; name: string; args: unknown }
  | { type: "tool-result"; name: string; result: { action?: CoachAction; [k: string]: unknown } }
  | { type: "finish"; text: string; escalated?: boolean; refusalReason?: string }
  | { type: "error"; message: string };

export interface CoachChatInput {
  message: string;
  history: ChatTurn[];
  dishSlug?: string;
}

/**
 * Stream a coach reply. Calls `onEvent` for each NDJSON line as it arrives.
 * Rejects with an ApiError before the first byte on a non-2xx (401/400/429);
 * once streaming, malformed lines are skipped rather than throwing.
 */
export async function streamCoachChat(
  input: CoachChatInput,
  onEvent: (ev: CoachEvent) => void,
  fetchImpl: FetchImpl = fetch,
): Promise<void> {
  const res = await fetchImpl(`${API_BASE}/api/coach-agent/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let e: { error?: string; code?: string } = {};
    try {
      e = text ? JSON.parse(text) : {};
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, e.code ?? "error", e.error ?? "coach unavailable");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const drain = (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as CoachEvent);
        } catch {
          /* skip a malformed line */
        }
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    drain(decoder.decode(value, { stream: true }));
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      onEvent(JSON.parse(tail) as CoachEvent);
    } catch {
      /* skip */
    }
  }
}
