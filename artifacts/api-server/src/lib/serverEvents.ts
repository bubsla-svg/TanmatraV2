import { db, funnelEventsTable } from "@workspace/db";
import { logger } from "./logger";

// Server-truth money events (playbook Part 8, A4). The client keeps firing
// its own copies as corroboration; rows emitted here are the revenue truth
// and are marked source:"server" + path:"server" (sessionId stays null —
// there is no browser session on this path).
type ServerEventName =
  | "order_created"
  | "payment_succeeded"
  | "subscription_started"
  | "trial_started"
  | "delivery_completed"
  | "meal_swapped"
  | "consult_booked";

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
): Promise<void> {
  try {
    await db.insert(funnelEventsTable).values({
      name,
      props: { ...props, source: "server" },
      sessionId: null,
      userId: userId ?? null,
      path: "server",
    });
  } catch (err) {
    // Analytics must never break checkout/payment/subscribe. Same degraded
    // posture as POST /events: log and move on.
    logger.warn({ err, event: name }, "server_funnel_event_insert_failed");
  }
}
