/**
 * Subscription-abandonment sweep.
 *
 * `POST /subscriptions` inserts the subscription row with `status: "active"`
 * and generates its full delivery schedule BEFORE any payment happens — the
 * Razorpay checkout modal only opens after the row already exists. Today the
 * only rollback is client-side (Subscribe.tsx cancels on an explicit
 * "cancelled" Razorpay outcome) and is fire-and-forget: a closed tab, lost
 * network, crashed tab, or a gateway-"unavailable" outcome all leave the
 * subscription `active` forever with zero payment. Every delivery-facing
 * surface (add-item, generate-next, ops/kitchen views) keys off
 * `status === "active"` with no payment check, so these "zombie"
 * subscriptions look completely real to fulfillment.
 *
 * This sweep is the load-bearing fix: it finds subscriptions that are
 * unambiguously zombies and cancels them the same way a customer-initiated
 * cancel does (see `cancelSubscriptionById` in ../routes/subscriptions),
 * so their upcoming deliveries are cancelled too, not left dangling.
 *
 * "Unambiguous zombie" = active status + zero `subscription_mandates` row
 * (any status — active or cancelled, since even a cancelled mandate proves a
 * payment attempt happened) + created more than GRACE_MS ago.
 *
 * Cadence scope — weekly/fortnightly ONLY, monthly is deliberately excluded:
 * `POST /payments/razorpay/order` only requests a Razorpay recurring token
 * (`isRecurring`) for `cadence === "weekly" || "fortnightly"` (see
 * ../routes/payments.ts). A monthly plan is a one-time prepaid charge for the
 * whole 6-week cycle — it NEVER gets a `subscription_mandates` row, even when
 * fully and successfully paid. So "zero mandate" is not an unambiguous zombie
 * signal for monthly subscriptions; sweeping them would cancel legitimately
 * -paid customers. (Trial subscriptions are not a special case here: the
 * client always sends `cadence: "weekly"` for a trial — see Subscribe.tsx's
 * `activeCadence` — so a completed trial payment registers a mandate exactly
 * like a normal weekly subscription and is covered by the same check.)
 *
 * Grace window: default 2 hours. Long enough that a slow-but-legitimate
 * checkout is never falsely killed — UPI Autopay mandate approval happens in
 * the customer's bank app and is not always instant, and payment retries
 * after a flaky network add more slack — while still short enough that a
 * genuine zombie is caught well before it could reach a kitchen prep batch
 * (subscriptions always start at least 2 days out; see Subscribe.tsx's
 * startDate cut-off logic). Override via SUBSCRIPTION_ABANDONMENT_GRACE_MS.
 */

import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { db, subscriptionsTable, subscriptionMandatesTable } from "@workspace/db";
import { logger } from "./logger";
import { cancelSubscriptionById } from "../routes/subscriptions";

const RECURRING_CADENCES = ["weekly", "fortnightly"] as const;

export const DEFAULT_GRACE_MS = 2 * 60 * 60 * 1000; // 2 hours — see module docstring.
const GRACE_MS = Number(
  process.env["SUBSCRIPTION_ABANDONMENT_GRACE_MS"] ?? DEFAULT_GRACE_MS,
);

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes.
const INTERVAL_MS = Number(
  process.env["SUBSCRIPTION_ABANDONMENT_SWEEP_INTERVAL_MS"] ?? DEFAULT_INTERVAL_MS,
);

export interface AbandonmentSweepResult {
  candidates: number;
  cancelled: number[];
  errors: number;
}

export async function runSubscriptionAbandonmentSweep(
  graceMs: number = GRACE_MS,
): Promise<AbandonmentSweepResult> {
  const cutoff = new Date(Date.now() - graceMs);

  // Anti-join: subscriptions with no matching row in subscription_mandates at all.
  const rows = await db
    .select({ subscription: subscriptionsTable })
    .from(subscriptionsTable)
    .leftJoin(
      subscriptionMandatesTable,
      eq(subscriptionMandatesTable.subscriptionId, subscriptionsTable.id),
    )
    .where(
      and(
        eq(subscriptionsTable.status, "active"),
        inArray(subscriptionsTable.cadence, RECURRING_CADENCES),
        lte(subscriptionsTable.createdAt, cutoff),
        isNull(subscriptionMandatesTable.id),
      ),
    );

  const cancelled: number[] = [];
  let errors = 0;

  for (const { subscription: sub } of rows) {
    try {
      const updated = await cancelSubscriptionById(sub.id, logger);
      if (updated) cancelled.push(sub.id);
    } catch (err) {
      errors++;
      logger.error(
        { err, subscriptionId: sub.id },
        "subscription abandonment sweep: failed to cancel zombie subscription",
      );
    }
  }

  logger.info(
    {
      candidates: rows.length,
      cancelledCount: cancelled.length,
      cancelledSubscriptionIds: cancelled,
      errors,
      graceMs,
    },
    "subscription abandonment sweep: tick complete",
  );

  return { candidates: rows.length, cancelled, errors };
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runSubscriptionAbandonmentSweep();
  } catch (err) {
    logger.error({ err }, "subscription abandonment scheduler tick failed");
  } finally {
    running = false;
  }
}

export function startSubscriptionAbandonmentScheduler(): void {
  if (timer) return;
  // First tick after a short delay so server startup isn't slammed; then on
  // the configured interval.
  const initialTimer = setTimeout(() => void tick(), 60_000);
  if (typeof initialTimer.unref === "function") initialTimer.unref();
  timer = setInterval(() => void tick(), INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
  logger.info(
    { intervalMs: INTERVAL_MS, graceMs: GRACE_MS },
    "subscription abandonment scheduler started",
  );
}

export function stopSubscriptionAbandonmentScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
