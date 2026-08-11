/**
 * Trial lifecycle finalization sweep.
 *
 * `subscriptionsTable.trialState` has two states that are set at creation
 * (`trial_purchased`), on first delivery (`trial_active`) and once all 3
 * sampler deliveries are marked "delivered" (`trial_bridge_eligible`) — see
 * `updateTrialState` in routes/subscriptions.ts — plus one set by the
 * explicit trial→standard conversion route (`converted`). Nothing in the
 * codebase ever assigned `trial_ended_undecided` or `ended_abandoned`: a
 * customer who finished all 3 deliveries but never explicitly converted
 * stayed `trial_bridge_eligible` (and `status: "active"`) forever, even
 * though the trial is a one-off pack that never recurs and has nothing left
 * scheduled. This sweep closes that loop.
 *
 * Two-stage transition, both gated by elapsed time since the trial actually
 * finished:
 *
 *   trial_bridge_eligible --(TRIAL_UNDECIDED_GRACE_DAYS)--> trial_ended_undecided
 *   trial_ended_undecided --(TRIAL_ABANDON_GRACE_DAYS more)--> ended_abandoned (+ cancelled)
 *
 * Anchor: the "trial finished on this date" instant is taken as the
 * `updatedAt` of the 3rd subscription_deliveries row (for that subscription)
 * whose status flipped to "delivered" — NOT the subscription's own
 * createdAt/updatedAt, which is touched by unrelated updates (address edits,
 * member changes, the trialState writes themselves) and would silently
 * reset a clock that has nothing to do with delivery completion.
 *
 * Elapsed-time placement, not per-tick advancement: a subscription is placed
 * directly in whichever stage its total elapsed time since the anchor
 * implies, rather than always moving exactly one stage per sweep tick. This
 * makes the sweep resilient to gaps (scheduler disabled for a while, a
 * deploy, etc.) — a trial that finished 3 weeks ago and was never swept
 * jumps straight to `ended_abandoned` in a single tick instead of needing
 * two separate runs to "catch up" through `trial_ended_undecided` first.
 *
 * Scoping: subscriptionsTable has no `planType` column — `trialState`
 * non-null IS the trial marker (see isTrial checks throughout
 * routes/subscriptions.ts, e.g. the /convert route). This sweep only ever
 * touches rows whose trialState is exactly `trial_bridge_eligible` or
 * `trial_ended_undecided`; `converted` and `ended_abandoned` are terminal
 * and excluded by construction (they're simply never selected).
 */

import { and, asc, eq, or } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  subscriptionDeliveriesTable,
  type Subscription,
} from "@workspace/db";
import { logger } from "./logger";
import { cancelAutopayMandate } from "./autopay";

const DAY_MS = 24 * 60 * 60 * 1000;

// Grace period #1: how long a customer has, after their 3rd trial delivery
// is marked delivered, to explicitly convert before the trial is flagged
// "ended, undecided". Judgment call — 3 days.
const UNDECIDED_GRACE_DAYS = Number(
  process.env["TRIAL_UNDECIDED_GRACE_DAYS"] ?? 3,
);
// Grace period #2: how much longer an undecided trial is left alone before
// it's abandoned outright and the subscription is cancelled. Judgment
// call — 4 more days, so ~1 week end-to-end from trial completion by default.
const ABANDON_GRACE_DAYS = Number(
  process.env["TRIAL_ABANDON_GRACE_DAYS"] ?? 4,
);

const UNDECIDED_GRACE_MS = UNDECIDED_GRACE_DAYS * DAY_MS;
const ABANDON_TOTAL_MS = (UNDECIDED_GRACE_DAYS + ABANDON_GRACE_DAYS) * DAY_MS;

export interface TrialLifecycleSweepResult {
  scanned: number;
  toUndecided: number;
  toAbandoned: number;
  errors: number;
}

/**
 * The updatedAt of the 3rd subscription_deliveries row (ordered by when it
 * flipped, ascending) whose status is "delivered" for this subscription —
 * i.e. the moment the trial's 3 deliveries were actually completed. Returns
 * null if fewer than 3 delivered rows exist (defensive: reaching
 * trial_bridge_eligible/trial_ended_undecided already implies count >= 3,
 * per updateTrialState, so this should not happen in practice).
 */
async function findTrialCompletionAnchor(
  subscriptionId: number,
): Promise<Date | null> {
  const [thirdDelivered] = await db
    .select({ updatedAt: subscriptionDeliveriesTable.updatedAt })
    .from(subscriptionDeliveriesTable)
    .where(
      and(
        eq(subscriptionDeliveriesTable.subscriptionId, subscriptionId),
        eq(subscriptionDeliveriesTable.status, "delivered"),
      ),
    )
    .orderBy(asc(subscriptionDeliveriesTable.updatedAt))
    .limit(1)
    .offset(2);
  return thirdDelivered?.updatedAt ?? null;
}

/**
 * Finalize an abandoned trial: flip trialState + status, cancel any
 * still-upcoming deliveries, and revoke autopay billing.
 *
 * Deliberately not routed through routes/subscriptions.ts's
 * cancelSubscriptionById(): that helper only flips `status`, but abandonment
 * needs to atomically set `trialState: "ended_abandoned"` alongside it in
 * the same update. The remaining two steps (cancel upcoming deliveries,
 * revoke the autopay mandate) intentionally mirror it exactly.
 *
 * Trial subscriptions never get a Razorpay autopay mandate in the intended
 * flow (a trial's one-off charge doesn't need one), and — corrected 2026-08-11,
 * see docs/audit/P0-9-TRIAL-LIFECYCLE.md — that is what the current code
 * actually does: the /payments create-order `isRecurring` gate is
 * `!isLiveTrialState(sub.trialState) && (cadence === "weekly" ||
 * "fortnightly")`, so a live trial is excluded even though it reuses cadence
 * "weekly" for scheduling (see subscriptions.trial.test.ts), and the
 * post-payment mandate-registration step independently re-checks
 * `isLiveTrialState` before ever writing a mandate row, whether confirmation
 * came from verify or the webhook. This comment previously (and wrongly)
 * claimed the create-order gate had no trialState exclusion at all.
 * cancelAutopayMandate is still called unconditionally below regardless: it
 * is documented idempotent/safe to call on a subscription with zero mandate
 * rows (the common case, and now the *only* case for a trial that stayed on
 * the intended path), so this is defense-in-depth against a future
 * regression in either gate above, not a known live gap. Its own DB step is
 * wrapped separately so a mandate-revocation failure never rolls back the
 * (more important) abandonment flip, and never counts this row as a sweep
 * error.
 */
async function abandonTrial(sub: Subscription): Promise<void> {
  await db
    .update(subscriptionsTable)
    .set({
      trialState: "ended_abandoned",
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(subscriptionsTable.id, sub.id));

  await db
    .update(subscriptionDeliveriesTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(subscriptionDeliveriesTable.subscriptionId, sub.id),
        eq(subscriptionDeliveriesTable.status, "upcoming"),
      ),
    );

  try {
    await cancelAutopayMandate(sub.id, logger);
  } catch (err) {
    logger.error(
      { err, subscriptionId: sub.id },
      "trial lifecycle sweep: cancelAutopayMandate failed after abandonment (subscription is still marked cancelled/ended_abandoned)",
    );
  }
}

export async function runTrialLifecycleSweep(): Promise<TrialLifecycleSweepResult> {
  const now = new Date();
  const result: TrialLifecycleSweepResult = {
    scanned: 0,
    toUndecided: 0,
    toAbandoned: 0,
    errors: 0,
  };

  const candidates = await db
    .select()
    .from(subscriptionsTable)
    .where(
      or(
        eq(subscriptionsTable.trialState, "trial_bridge_eligible"),
        eq(subscriptionsTable.trialState, "trial_ended_undecided"),
      ),
    );

  for (const sub of candidates) {
    result.scanned++;
    try {
      const anchor = await findTrialCompletionAnchor(sub.id);
      if (!anchor) {
        logger.warn(
          { subscriptionId: sub.id },
          "trial lifecycle sweep: no 3rd delivered-delivery anchor found, skipping",
        );
        continue;
      }

      const elapsedMs = now.getTime() - anchor.getTime();

      if (elapsedMs >= ABANDON_TOTAL_MS) {
        if (sub.trialState !== "ended_abandoned") {
          await abandonTrial(sub);
          result.toAbandoned++;
        }
      } else if (elapsedMs >= UNDECIDED_GRACE_MS) {
        if (sub.trialState === "trial_bridge_eligible") {
          await db
            .update(subscriptionsTable)
            .set({ trialState: "trial_ended_undecided", updatedAt: new Date() })
            .where(
              and(
                eq(subscriptionsTable.id, sub.id),
                eq(subscriptionsTable.trialState, "trial_bridge_eligible"),
              ),
            );
          result.toUndecided++;
        }
      }
    } catch (err) {
      result.errors++;
      logger.error(
        { err, subscriptionId: sub.id },
        "trial lifecycle sweep: failed processing subscription, skipping row",
      );
    }
  }

  logger.info(result, "trial lifecycle sweep complete");
  return result;
}

const DEFAULT_INTERVAL_MS = Number(
  process.env["TRIAL_LIFECYCLE_SWEEP_INTERVAL_MS"] ?? 6 * 60 * 60 * 1000,
);

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runTrialLifecycleSweep();
  } catch (err) {
    logger.error({ err }, "trial lifecycle scheduler tick failed");
  } finally {
    running = false;
  }
}

export function startTrialLifecycleScheduler(
  intervalMs = DEFAULT_INTERVAL_MS,
): void {
  if (timer) return;
  if (process.env["TRIAL_LIFECYCLE_SCHEDULER_DISABLED"] === "1") {
    logger.info("trial lifecycle scheduler disabled via env");
    return;
  }
  setTimeout(() => void tick(), 30_000);
  timer = setInterval(() => void tick(), intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs }, "trial lifecycle scheduler started");
}

export function stopTrialLifecycleScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
