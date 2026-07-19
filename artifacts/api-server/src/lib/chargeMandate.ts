// ─────────────────────────────────────────────────────────────────────────────
// Recurring-mandate charge driver — the single, reusable code path for
// debiting a subscription's Razorpay autopay mandate.
//
// Both POST /payments/charge-mandate (routes/payments.ts) and the periodic
// chargeMandateScheduler call chargeMandateCore() so there is exactly one
// place that resolves the amount, calls the gateway, and persists the
// outcome — never two copies drifting apart.
//
// AUTH NOTE: a separate, independent hardening task is expected to add a
// service-credential requirement to the POST /payments/charge-mandate HTTP
// route (see the route file for the marker comment). This module is
// unaffected either way: chargeMandateScheduler calls chargeMandateCore()
// directly, in-process — it never goes over HTTP, so it never needs to carry
// that credential in the first place. If/when the HTTP route grows an auth
// check, it slots in purely as a guard at the top of the route handler,
// before chargeMandateCore() is invoked; nothing here needs to change.
//
// Gateway shape (see the confidence note in the PR/report): the previous
// implementation POSTed to https://api.razorpay.com/v1/payments/charge,
// which is not a documented Razorpay endpoint. Razorpay's actual recurring-
// charge flow (confirmed against Razorpay's own docs) is two calls:
//   1. POST /v1/orders            — create a fresh order for the amount
//   2. POST /v1/payments/create/recurring
//      { order_id, customer_id, token, amount, currency, email, contact,
//        recurring: true }
// This mirrors the existing `isRecurring` order-creation branch of
// POST /payments/razorpay/order (routes/payments.ts) for step 1, minus the
// `token` REGISTRATION block — that block creates a *new* mandate; charging
// an *existing* one only needs the plain order + the recurring-charge call.
// ─────────────────────────────────────────────────────────────────────────────

import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  ordersTable,
  subscriptionsTable,
  subscriptionMandatesTable,
  subscriptionDeliveriesTable,
  preDebitNotificationsTable,
  type Subscription,
  type SubscriptionDelivery,
} from "@workspace/db";
import {
  CADENCE_DAYS,
  CADENCE_CYCLES_AHEAD,
  addDays,
  generateDeliveriesForSubscription,
  pauseUpcomingDeliveries,
} from "../routes/subscriptions";

export type ChargeLogger = {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};

// A mandate that fails this many charge attempts IN A ROW (never reset
// except by an intervening success — see the success path's
// `chargeFailureCount: 0`) is halted rather than retried forever. Mirrors a
// real Razorpay native subscription's `subscription.halted` lifecycle event:
// after N consecutive failures it stops auto-retrying until the customer
// takes action. Exported so tests can assert against it instead of a magic
// number. 3 was chosen as "clearly not a fluke" (a single bank hiccup or a
// momentarily-declined card is common and should NOT halt) while still
// stopping well short of "retried forever" — at the scheduler's ~daily retry
// cadence (see failCharge's near-future retry point below) that is 3 days of
// genuinely failed attempts before we give up and require customer action.
export const MAX_CONSECUTIVE_CHARGE_FAILURES = 3;

export interface ChargeMandateOutcome {
  ok: boolean;
  httpStatus: number;
  body: Record<string, unknown>;
}

function razorpayCredentials(): [string, string] | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return [keyId, keySecret];
}

function razorpayBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

/** cadence → billing-cycle length in days. Mirrors the mapping already used
 * for mandate registration (registerAutopayMandate in routes/payments.ts) —
 * intentionally NOT subscriptions.ts's CADENCE_DAYS (monthly=42, a delivery-
 * scheduling concept), since a Razorpay UPI Autopay mandate is only ever
 * registered for weekly/fortnightly subscriptions in practice (see the
 * isRecurring gate in POST /payments/razorpay/order); this keeps the
 * billing-cadence mapping consistent with how the mandate was created. */
function billingCadenceDays(cadence: Subscription["cadence"]): number {
  return cadence === "weekly" ? 7 : cadence === "fortnightly" ? 14 : 30;
}

/**
 * Find the earliest not-yet-billed upcoming delivery for this subscription
 * so the charge can be tied to it for reconciliation, replenishing the next
 * batch (mirrors POST /subscriptions/:id/generate-next) if the pool is
 * empty. Best-effort: fulfillment linkage never blocks or fails the charge
 * itself — the order row inserted by the caller is the load-bearing revenue
 * record regardless of whether this finds a delivery to attach to.
 */
async function ensureUpcomingDeliveryForCharge(
  sub: Subscription,
  log: ChargeLogger,
): Promise<SubscriptionDelivery | null> {
  const pick = async (): Promise<SubscriptionDelivery | null> => {
    const [row] = await db
      .select()
      .from(subscriptionDeliveriesTable)
      .where(
        and(
          eq(subscriptionDeliveriesTable.subscriptionId, sub.id),
          eq(subscriptionDeliveriesTable.status, "upcoming"),
          isNull(subscriptionDeliveriesTable.orderId),
        ),
      )
      .orderBy(asc(subscriptionDeliveriesTable.scheduledFor))
      .limit(1);
    return row ?? null;
  };

  const existing = await pick();
  if (existing) return existing;

  try {
    const last = await db
      .select()
      .from(subscriptionDeliveriesTable)
      .where(eq(subscriptionDeliveriesTable.subscriptionId, sub.id))
      .orderBy(desc(subscriptionDeliveriesTable.scheduledFor))
      .limit(1);
    const lastDate = last[0]?.scheduledFor ?? sub.startDate;
    const stepDays = CADENCE_DAYS[sub.cadence];
    const dayPlan = sub.dayPlan ?? null;
    let startFrom: Date;
    if (dayPlan && dayPlan.length > 0) {
      const base = new Date(sub.startDate);
      const elapsedMs = new Date(lastDate).getTime() - base.getTime();
      const cyclesElapsed = Math.floor(elapsedMs / (stepDays * 86400000)) + 1;
      startFrom = addDays(base, cyclesElapsed * stepDays);
    } else {
      startFrom = addDays(new Date(lastDate), stepDays);
    }
    await generateDeliveriesForSubscription(
      sub.id,
      sub.cadence,
      startFrom,
      dayPlan && dayPlan.length > 0 ? CADENCE_CYCLES_AHEAD[sub.cadence] : 4,
      sub.deliveryWindow,
      [],
      dayPlan,
    );
    // Keep nextDeliveryAt honest after replenishing (mirrors
    // recomputeNextDeliveryAt in routes/subscriptions.ts).
    const [next] = await db
      .select({ scheduledFor: subscriptionDeliveriesTable.scheduledFor })
      .from(subscriptionDeliveriesTable)
      .where(
        and(
          eq(subscriptionDeliveriesTable.subscriptionId, sub.id),
          eq(subscriptionDeliveriesTable.status, "upcoming"),
        ),
      )
      .orderBy(asc(subscriptionDeliveriesTable.scheduledFor))
      .limit(1);
    if (next?.scheduledFor) {
      await db
        .update(subscriptionsTable)
        .set({ nextDeliveryAt: next.scheduledFor })
        .where(eq(subscriptionsTable.id, sub.id));
    }
  } catch (err) {
    log.warn(
      { err, subscriptionId: sub.id },
      "charge-mandate: failed to replenish upcoming deliveries (best-effort, charge still proceeds)",
    );
    return null;
  }

  return pick();
}

export interface ChargeMandateParams {
  subscriptionId: number;
  /** Client/caller-supplied amount, if any — used only for the tamper /
   * drift diagnostic log, never to decide what gets billed. */
  amountPaiseHint?: number | null;
  /** Caller's view of the charge date, if any — used only to sanity-log a
   * mismatch against the mandate's own nextChargeAt. The mandate's stored
   * nextChargeAt is always authoritative for due-ness, the pre-debit
   * notification lookup, and the drift-corrected next cycle date. */
  requestedChargeDate?: Date | string | null;
  log: ChargeLogger;
}

/**
 * Charge a subscription's active Razorpay autopay mandate for the current
 * cycle. Shared by POST /payments/charge-mandate and chargeMandateScheduler.
 *
 * Returns a plain outcome object (never throws for expected failure modes)
 * so both an Express route and an unattended scheduler tick can consume it
 * without needing req/res.
 */
export async function chargeMandateCore(
  params: ChargeMandateParams,
): Promise<ChargeMandateOutcome> {
  const { subscriptionId, amountPaiseHint, requestedChargeDate, log } = params;

  const creds = razorpayCredentials();
  if (!creds) {
    return { ok: false, httpStatus: 503, body: { error: "payment gateway not configured" } };
  }
  const [keyId, keySecret] = creds;

  const [mandate] = await db
    .select()
    .from(subscriptionMandatesTable)
    .where(
      and(
        eq(subscriptionMandatesTable.subscriptionId, subscriptionId),
        eq(subscriptionMandatesTable.status, "active"),
      ),
    )
    .limit(1);

  if (!mandate) {
    // The mandate row itself flips to "halted" alongside the subscription
    // when MAX_CONSECUTIVE_CHARGE_FAILURES is reached (see failCharge), so a
    // halted subscription's mandate never matches the "active" filter above
    // and always lands here — never in the subForGuard race-guard below.
    // Give callers/ops a distinct, actionable signal for that case instead
    // of the generic "no active mandate" 404, mirroring a real Razorpay
    // native subscription's `subscription.halted` event.
    const [subStatusRow] = await db
      .select({ status: subscriptionsTable.status })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, subscriptionId))
      .limit(1);
    if (subStatusRow?.status === "halted") {
      return {
        ok: false,
        httpStatus: 409,
        body: {
          error: "subscription billing has been halted after repeated charge failures",
          code: "subscription_halted",
        },
      };
    }
    return { ok: false, httpStatus: 404, body: { error: "active subscription mandate not found" } };
  }

  // Defense-in-depth: never charge a subscription that is not active. The
  // mandate flip performed on cancel (or on halt, see failCharge) already
  // makes the lookup above 404 in the steady state, but this closes the
  // race where a gateway revoke lags a local cancel, or a stale active
  // mandate row outlives its subscription.
  const [subForGuard] = await db
    .select({ status: subscriptionsTable.status })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, subscriptionId))
    .limit(1);
  if (!subForGuard || subForGuard.status !== "active") {
    if (subForGuard?.status === "halted") {
      return {
        ok: false,
        httpStatus: 409,
        body: {
          error: "subscription billing has been halted after repeated charge failures",
          code: "subscription_halted",
        },
      };
    }
    return {
      ok: false,
      httpStatus: 409,
      body: { error: "subscription is not active", code: "subscription_inactive" },
    };
  }

  // The mandate's own nextChargeAt is authoritative for which calendar day
  // the pre-debit notification must have been sent for, and for the due-date
  // / drift-fix / claim logic further down — never the caller's
  // requestedChargeDate (a stale/incorrect caller value must not be able to
  // pick a different, possibly-unnotified day to bill against). When the
  // mandate genuinely has no nextChargeAt yet (e.g. a mandate mid-
  // registration), fall back to the caller's date ONLY for the notification
  // lookup below, matching the pre-existing behaviour that lookup already
  // had — but the charge is refused afterward regardless (see the explicit
  // nextChargeAt-required check after the notification gauntlet), since
  // there is no authoritative due date to bill, advance, or claim against.
  const requested = requestedChargeDate ? new Date(requestedChargeDate) : null;
  const chargeDate = mandate.nextChargeAt ?? (requested && !isNaN(requested.getTime()) ? requested : null);
  if (!chargeDate) {
    return { ok: false, httpStatus: 400, body: { error: "mandate has no scheduled charge date" } };
  }

  if (mandate.nextChargeAt && requested && !isNaN(requested.getTime()) && requested.toDateString() !== mandate.nextChargeAt.toDateString()) {
    log.warn(
      { subscriptionId, requested: requested.toISOString(), mandateNextChargeAt: mandate.nextChargeAt.toISOString() },
      "charge-mandate: caller-supplied scheduledChargeDate diverges from the mandate's own nextChargeAt — billing against the mandate's date",
    );
  }

  const startOfDay = new Date(chargeDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(chargeDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const [notification] = await db
    .select()
    .from(preDebitNotificationsTable)
    .where(
      and(
        eq(preDebitNotificationsTable.subscriptionId, subscriptionId),
        gte(preDebitNotificationsTable.scheduledChargeAt, startOfDay),
        lte(preDebitNotificationsTable.scheduledChargeAt, endOfDay),
      ),
    )
    .limit(1);

  if (!notification) {
    log.warn({ subscriptionId, chargeDate }, "charge-mandate: pre-debit notification record not found");
    return { ok: false, httpStatus: 400, body: { error: "pre-debit notification not found for this charge date" } };
  }
  if (notification.status !== "sent") {
    log.warn(
      { subscriptionId, notificationId: notification.id, status: notification.status },
      "charge-mandate: pre-debit notification status is not 'sent'",
    );
    return { ok: false, httpStatus: 400, body: { error: "pre-debit notification has not been sent yet" } };
  }
  if (!notification.dispatchedAt) {
    log.warn(
      { subscriptionId, notificationId: notification.id },
      "charge-mandate: pre-debit notification has no dispatch time",
    );
    return { ok: false, httpStatus: 400, body: { error: "pre-debit notification has no dispatch timestamp" } };
  }
  const hoursSinceDispatch = (Date.now() - new Date(notification.dispatchedAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceDispatch < 24) {
    log.warn(
      { subscriptionId, notificationId: notification.id, hoursSinceDispatch },
      "charge-mandate: pre-debit notification dispatched less than 24 hours ago",
    );
    return {
      ok: false,
      httpStatus: 400,
      body: { error: "pre-debit notification must be sent at least 24 hours before debiting" },
    };
  }

  // Everything past this point (due-check, claim, drift-corrected
  // nextChargeAt advance) requires the mandate's OWN nextChargeAt — the
  // notification-lookup fallback to the caller's date above exists only to
  // preserve that earlier gate's behaviour; it must never be treated as an
  // authoritative due date for actually moving money.
  if (!mandate.nextChargeAt) {
    return { ok: false, httpStatus: 400, body: { error: "mandate has no scheduled charge date" } };
  }

  // Only charge once the mandate is actually due. The pre-debit checks above
  // already imply this in the steady state (a "sent" notice >=24h old only
  // exists once the sweep put nextChargeAt in its lookback window), but this
  // is a direct, load-bearing guard against a caller (or a future scheduler
  // bug) firing a charge early.
  const now = new Date();
  if (mandate.nextChargeAt.getTime() > now.getTime()) {
    return { ok: false, httpStatus: 400, body: { error: "mandate is not yet due for charging", code: "not_due" } };
  }

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, subscriptionId))
    .limit(1);
  if (!sub) {
    return { ok: false, httpStatus: 404, body: { error: "subscription not found" } };
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, sub.userId)).limit(1);
  if (!user) {
    return { ok: false, httpStatus: 404, body: { error: "user not found" } };
  }

  // Money-path authority: debit the server-stored subscription price, never
  // the caller-supplied amountPaiseHint. The RBI pre-debit notice is
  // implicitly for this price (the notification row carries no amount
  // column), so charging any other value would debit an amount the customer
  // was never notified of.
  const authoritativePaise = sub.pricePerDeliveryPaise;
  if (amountPaiseHint != null && amountPaiseHint !== authoritativePaise) {
    log.warn(
      { subscriptionId, clientAmount: amountPaiseHint, authoritativePaise },
      "charge-mandate amount mismatch — billing server subscription price",
    );
  }

  // ── Claim the cycle ────────────────────────────────────────────────────
  // Atomically move nextChargeAt off the value we just read, conditioned on
  // it still being exactly that value. This does double duty:
  //   1. Concurrency guard — a second concurrent caller (an overlapping
  //      scheduler tick, or an ops-triggered HTTP call racing the
  //      scheduler) reads the OLD nextChargeAt, loses this compare-and-swap,
  //      and bails out below instead of charging the customer twice.
  //   2. Crash safety — if the process dies between claiming and resolving
  //      (gateway call in flight), the mandate is left pointing at a
  //      near-future retry date instead of stuck in the past, so it
  //      naturally re-enters the pre-debit sweep and gets retried — the
  //      same "don't strand the mandate" invariant #6 requires for a clean
  //      gateway failure.
  const previousNextChargeAt = chargeDate;
  const provisionalRetryAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const claim = await db
    .update(subscriptionMandatesTable)
    .set({ nextChargeAt: provisionalRetryAt, lastChargeAttemptAt: now })
    .where(
      and(
        eq(subscriptionMandatesTable.id, mandate.id),
        eq(subscriptionMandatesTable.status, "active"),
        eq(subscriptionMandatesTable.nextChargeAt, previousNextChargeAt),
      ),
    )
    .returning();

  if (claim.length === 0) {
    log.warn(
      { subscriptionId, mandateId: mandate.id },
      "charge-mandate: lost the claim race — another caller is already processing this cycle",
    );
    return {
      ok: false,
      httpStatus: 409,
      body: { error: "charge already being processed for this cycle", code: "charge_claim_conflict" },
    };
  }

  // ── Gateway: create an order, then charge the saved token against it ──
  // (see the module header for why this replaces the old bare
  // /v1/payments/charge call.)
  let rpOrderId: string;
  try {
    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: authoritativePaise,
        currency: "INR",
        receipt: `mandate-${mandate.id}-${chargeDate.toISOString().slice(0, 10)}`.slice(0, 40),
        payment_capture: 1,
      }),
    });
    if (!orderRes.ok) {
      const body = await orderRes.text().catch(() => "");
      throw new Error(`order creation failed: ${orderRes.status} ${body}`);
    }
    const rpOrder = (await orderRes.json()) as { id: string };
    rpOrderId = rpOrder.id;
  } catch (err) {
    return failCharge(mandate.id, subscriptionId, err, log);
  }

  let charge: { id: string; status: string; amount: number };
  try {
    const chargeRes = await fetch("https://api.razorpay.com/v1/payments/create/recurring", {
      method: "POST",
      headers: {
        Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email || undefined,
        contact: user.phoneE164 || undefined,
        amount: authoritativePaise,
        currency: "INR",
        order_id: rpOrderId,
        customer_id: mandate.razorpayCustomerId,
        token: mandate.razorpayTokenId,
        recurring: true,
        description: `Charge for subscription #${subscriptionId} delivery on ${chargeDate.toISOString().slice(0, 10)}`,
      }),
    });
    if (!chargeRes.ok) {
      let body: unknown;
      try {
        body = await chargeRes.json();
      } catch {
        body = await chargeRes.text();
      }
      log.error({ status: chargeRes.status, body, subscriptionId }, "Razorpay mandate charge failed");
      return failCharge(mandate.id, subscriptionId, new Error(`gateway charge failed: ${chargeRes.status}`), log);
    }
    charge = (await chargeRes.json()) as { id: string; status: string; amount: number };
  } catch (err) {
    return failCharge(mandate.id, subscriptionId, err, log);
  }

  // ── Success: persist a durable ledger row, advance nextChargeAt from the
  //    previously-scheduled date (not wall-clock now — avoids compounding
  //    drift on a late charge), and best-effort-link the next unbilled
  //    delivery. ────────────────────────────────────────────────────────
  const cadenceDays = billingCadenceDays(sub.cadence);
  const candidateNext = addDays(previousNextChargeAt, cadenceDays);
  const newNextChargeAt = candidateNext.getTime() > now.getTime() ? candidateNext : now;

  const delivery = await ensureUpcomingDeliveryForCharge(sub, log);
  const chargeDateStr = chargeDate.toISOString().slice(0, 10);

  let orderId: number | null = null;
  try {
    await db.transaction(async (tx) => {
      const [insertedOrder] = await tx
        .insert(ordersTable)
        .values({
          userId: sub.userId,
          // Unique per (userId, externalOrderId); one row per billed cycle.
          externalOrderId: `sub-${sub.id}-mandate-${mandate.id}-${chargeDateStr}`,
          razorpayOrderId: rpOrderId,
          razorpayPaymentId: charge.id,
          // Deliberately NOT "placed"/"preparing"/"ready" (dispatch.ts's live
          // rider-assignment queue) — this row exists purely as a durable
          // revenue/ledger record for the recurring charge. Fulfillment for
          // the linked delivery is tracked via subscriptionDeliveriesTable;
          // wiring subscription cycle-2+ deliveries into the live dispatch
          // queue is a separate, pre-existing gap outside this change.
          status: "billed",
          totalPaise: authoritativePaise,
          chargePaise: authoritativePaise,
          addressLabel: sub.addressLabel,
          addressLine: sub.addressLine,
          city: sub.city,
          pincode: sub.pincode,
          phone: sub.phone,
          items: [
            {
              id: mandate.id,
              name: `Subscription #${sub.id} recurring charge`,
              qty: 1,
              price: authoritativePaise,
            },
          ],
          fulfillmentType: "delivery",
        })
        .onConflictDoNothing({
          target: [ordersTable.userId, ordersTable.externalOrderId],
          // Match the partial unique index on orders (uniq_orders_user_external)
          // so Postgres can plan the conflict spec — mirrors loyaltyEngine.ts's
          // order insert (without this it errors at plan time).
          where: sql`${ordersTable.externalOrderId} is not null`,
        })
        .returning({ id: ordersTable.id });

      if (insertedOrder) {
        orderId = insertedOrder.id;
      } else {
        const [existing] = await tx
          .select({ id: ordersTable.id })
          .from(ordersTable)
          .where(
            and(
              eq(ordersTable.userId, sub.userId),
              eq(ordersTable.externalOrderId, `sub-${sub.id}-mandate-${mandate.id}-${chargeDateStr}`),
            ),
          )
          .limit(1);
        orderId = existing?.id ?? null;
      }

      if (delivery && orderId != null) {
        await tx
          .update(subscriptionDeliveriesTable)
          .set({ orderId })
          .where(eq(subscriptionDeliveriesTable.id, delivery.id));
      }

      await tx
        .update(subscriptionMandatesTable)
        .set({
          nextChargeAt: newNextChargeAt,
          lastChargeStatus: "succeeded",
          lastChargeError: null,
          chargeFailureCount: 0,
        })
        .where(eq(subscriptionMandatesTable.id, mandate.id));
    });
  } catch (err) {
    // The gateway charge already succeeded — money moved. A DB persistence
    // failure here must not be reported to the caller as a failed charge
    // (that would risk a retry double-charging the customer). Log loudly
    // for ops reconciliation; nextChargeAt already advanced via the claim
    // above (to a near-future retry point), so the mandate stays inside the
    // billing loop even if this write failed.
    log.error(
      { err, subscriptionId, razorpayPaymentId: charge.id },
      "charge-mandate: gateway charge succeeded but ledger persistence failed — needs manual reconciliation",
    );
    return {
      ok: true,
      httpStatus: 200,
      body: {
        success: true,
        paymentId: charge.id,
        status: charge.status,
        amount: charge.amount,
        nextChargeAt: provisionalRetryAt.toISOString(),
        warning: "ledger_persistence_failed",
      },
    };
  }

  return {
    ok: true,
    httpStatus: 200,
    body: {
      success: true,
      paymentId: charge.id,
      status: charge.status,
      amount: charge.amount,
      orderId,
      nextChargeAt: newNextChargeAt.toISOString(),
    },
  };
}

/**
 * Minimal failure persistence (see confirmed finding #6): record that an
 * attempt was made and failed, and — critically — leave nextChargeAt at the
 * near-future retry point the claim step already wrote (tomorrow), so the
 * mandate is still `nextChargeAt <= now` within a day and re-enters the
 * (now-hourly) pre-debit sweep's lookback window for a fresh notice + retry.
 * A failed charge must never leave nextChargeAt stranded in the past
 * forever — that is the "one failed debit = free food forever" bug.
 *
 * ON TOP OF THAT: once the NEW chargeFailureCount reaches
 * MAX_CONSECUTIVE_CHARGE_FAILURES, this is no longer "retry tomorrow" — it
 * is "stop trying and tell someone", the "one failed debit = free food
 * forever" bug's mirror image (an un-collectible card retried forever,
 * quietly, with nobody ever told). Both the mandate and its owning
 * subscription flip to "halted", and upcoming deliveries are paused —
 * a halted subscription shouldn't keep dispatching food nobody's paying
 * for. Recovery is POST /subscriptions/:id/reactivate-billing.
 */
async function failCharge(
  mandateId: number,
  subscriptionId: number,
  err: unknown,
  log: ChargeLogger,
): Promise<ChargeMandateOutcome> {
  const message = err instanceof Error ? err.message : String(err);
  log.error({ err, subscriptionId, mandateId }, "charge-mandate: gateway charge attempt failed");
  let halted = false;
  try {
    const [row] = await db
      .select({ chargeFailureCount: subscriptionMandatesTable.chargeFailureCount })
      .from(subscriptionMandatesTable)
      .where(eq(subscriptionMandatesTable.id, mandateId))
      .limit(1);
    const newFailureCount = (row?.chargeFailureCount ?? 0) + 1;
    halted = newFailureCount >= MAX_CONSECUTIVE_CHARGE_FAILURES;

    await db
      .update(subscriptionMandatesTable)
      .set({
        lastChargeStatus: "failed",
        lastChargeError: message.slice(0, 256),
        chargeFailureCount: newFailureCount,
        // Leave nextChargeAt untouched here — the claim step earlier in
        // chargeMandateCore already advanced it to the near-future retry
        // point regardless of outcome. Once halted, runDueMandateChargesSweep
        // never selects this row again anyway (its `status: "active"` filter
        // naturally excludes "halted"), so nextChargeAt going stale is moot.
        ...(halted ? { status: "halted" as const } : {}),
      })
      .where(eq(subscriptionMandatesTable.id, mandateId));

    if (halted) {
      await db
        .update(subscriptionsTable)
        .set({ status: "halted" })
        .where(eq(subscriptionsTable.id, subscriptionId));
      // Reuse the exact same "upcoming → paused" transition the
      // customer-initiated pause route uses (see pauseUpcomingDeliveries in
      // routes/subscriptions.ts) — best-effort in the same sense the rest of
      // this function is: a failure here must not throw and turn a recorded,
      // correctly-halted mandate into an unhandled exception.
      try {
        await pauseUpcomingDeliveries(subscriptionId);
      } catch (pauseErr) {
        log.error(
          { err: pauseErr, subscriptionId, mandateId },
          "charge-mandate: halted subscription but failed to pause its upcoming deliveries — needs manual follow-up",
        );
      }
      log.error(
        { subscriptionId, mandateId, chargeFailureCount: newFailureCount },
        `charge-mandate: ${MAX_CONSECUTIVE_CHARGE_FAILURES} consecutive failures reached — halting subscription billing`,
      );
    }
  } catch (persistErr) {
    log.error({ err: persistErr, subscriptionId, mandateId }, "charge-mandate: failed to persist failure record");
  }
  return {
    ok: false,
    httpStatus: 502,
    body: {
      error: "payment gateway charge failed",
      details: message,
      ...(halted ? { code: "subscription_halted" } : {}),
    },
  };
}
