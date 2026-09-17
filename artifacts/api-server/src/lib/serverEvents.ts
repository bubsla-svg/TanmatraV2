import { db, funnelEventsTable } from "@workspace/db";
import { logger } from "./logger";
import { forwardFunnelEvent } from "./eventForwarders";

// Server-truth money events (playbook Part 8, A4). The client keeps firing
// its own copies as corroboration; rows emitted here are the revenue truth
// and are marked source:"server" + path:"server" (sessionId stays null —
// there is no browser session on this path).
type ServerEventName =
  | "order_created"
  | "payment_succeeded"
  // T2 (CRO handoff 2026-09-17): the canonical conversion event, emitted
  // once per order on the fresh placed→preparing transition, carrying
  // order_id, amount_paise, method, src and the funnel session. Forwarded
  // to GA4 (Measurement Protocol) and Meta (Conversions API) server-side.
  | "purchase"
  | "payment_failed"
  | "subscription_started"
  | "trial_started"
  | "delivery_completed"
  | "meal_swapped"
  | "consult_booked"
  // T3: the gateway told us the customer revoked/paused the UPI Autopay
  // mandate (token.cancelled / token.paused / token.rejected webhook).
  | "mandate_revoked";

/**
 * Insert a server-emitted funnel event. Never throws and never blocks the
 * money path — mirrors orderNotification.ts: any failure is swallowed into a
 * structured log. Call as `void emitServerEvent(...)` (fire-and-forget).
 * Props must follow §8.4 governance: bands/booleans/paise only, no PII.
 */
export async function emitServerEvent(
  name: ServerEventName,
  props: Record<string, unknown>,
  userId: string | null,
  sessionId: string | null = null,
): Promise<void> {
  const row = {
    name,
    props: { ...props, source: "server" },
    sessionId: sessionId ?? null,
    userId: userId ?? null,
    path: "server",
  };
  // Vendor forwarding is independent of the insert: a warehouse hiccup must
  // not also lose the GA4 / Meta copy, and vice versa. Both never throw.
  void forwardFunnelEvent(row, {});
  try {
    await db.insert(funnelEventsTable).values(row);
  } catch (err) {
    // Analytics must never break checkout/payment/subscribe. Same degraded
    // posture as POST /events: log and move on.
    logger.warn({ err, event: name }, "server_funnel_event_insert_failed");
  }
}
