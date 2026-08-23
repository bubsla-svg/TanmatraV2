// ─────────────────────────────────────────────────────────────────────────────
// Razorpay Payment Reconciliation Scheduler
//
// Backstop for dropped webhooks or client connectivity aborts after successful
// Razorpay checkout. Periodically sweeps "placed" (unpaid) orders older than
// 15 minutes, inspects payment state via Razorpay API, and transitions valid
// captures to "preparing" while pushing to PetPooja KDS and logging telemetry.
// ─────────────────────────────────────────────────────────────────────────────

import { and, eq, gt, lte, isNotNull } from "drizzle-orm";
import {
  db,
  ordersTable,
  usersTable,
  companySubsidyChargesTable,
  orderClaimsTable,
  subscriptionDeliveriesTable,
  subscriptionsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { razorpayCredentials, razorpayBasicAuth } from "./razorpayRecurring";
import { pushOrderToPetpooja } from "./petpoojaClient";
import { emitServerEvent } from "./serverEvents";
import { isCaptureAmountReconciled, resolvePayableAmountPaise } from "./paymentIntegrity";
import { commitSubsidyForOrder } from "./corporateSubsidy";
import { sendOrderConfirmation } from "./orderNotification";

export interface ReconciliationSweepResult {
  inspected: number;
  reconciled: number;
  unresolved: number;
  errors: number;
}

/**
 * Zero-charge promoter — the sweep-side mirror of the verified zero-charge
 * finalize (lib/loyaltyEngine.ts / routes/subscriptions.ts). Heals two
 * windows the in-transaction promoter cannot: rows minted before the
 * paid-fulfilment invariant deployed (their finalize predates the promoter,
 * so they sit "placed" + chargePaise 0 forever — no gateway path can ever
 * touch them, payments.ts 409s on a non-positive amount), and the crash
 * window between a finalize tx committing and its post-tx subsidy commit.
 *
 * Settlement evidence is REQUIRED and MUST be a join against a server-owned
 * row this order cannot have written itself — never a property of
 * `externalOrderId`'s string content. That field is client-supplied
 * (routes/checkout.ts, routes/loyalty.ts's finalizeOrderSchema both accept it
 * verbatim, 1-64 chars, no format constraint) and is trusted nowhere else as
 * proof of anything; treating a `"sub-"` prefix as settlement evidence was a
 * confused-deputy bug — a caller could name ANY string, so the check proved
 * nothing about whether a real subscription cycle, let alone this order's own
 * cycle, ever existed. The three evidence branches below:
 *
 *   - subscription first cycle: an INNER JOIN from subscription_deliveries to
 *     subscriptions, filtered to `subscription_deliveries.order_id = <this
 *     order's own serial id>` AND `subscriptions.user_id = <this order's own
 *     userId>`. `subscription_deliveries.order_id` is written exactly once,
 *     inside the same transaction that creates the subscription and the
 *     order (routes/subscriptions.ts createOrderForNewSubscription) — no
 *     route ever lets a client set it, so satisfying this join proves a real
 *     subscription cycle was created FOR THIS SPECIFIC ORDER AND ITS OWNER.
 *     The userId equality is defense in depth against a cross-customer
 *     reference even though orderId alone already scopes it correctly (the
 *     same idiom as routes/payments.ts's registerAutopayMandate lookup).
 *   - company subsidy: a company_subsidy_charges row keyed by the order's own
 *     serial id (server-written only by the subsidy reservation flow).
 *   - credit redemption: a loyalty_order_claims row for this exact
 *     (userId, externalOrderId) with redeemedPaise > 0 — written only by
 *     finalizeOrder's own atomic credit debit, never by a client.
 *
 * A zero minted by discounts alone is NOT promoted — that is priced-free food
 * nobody settled, left non-actionable and logged by the finalize.
 */
export async function promoteSettledZeroChargeOrders(now: Date): Promise<number> {
  const grace = new Date(now.getTime() - 2 * 60 * 1000);
  const candidates = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "placed"),
        eq(ordersTable.orderChannel, "own_app"),
        eq(ordersTable.chargePaise, 0),
        lte(ordersTable.createdAt, grace),
      ),
    );

  let promoted = 0;
  for (const order of candidates) {
    try {
      let evidence: "subscription-cycle" | "subsidy" | "credit-claim" | null = null;
      if (order.userId) {
        const [subDelivery] = await db
          .select({ id: subscriptionDeliveriesTable.id })
          .from(subscriptionDeliveriesTable)
          .innerJoin(
            subscriptionsTable,
            eq(subscriptionDeliveriesTable.subscriptionId, subscriptionsTable.id),
          )
          .where(
            and(
              eq(subscriptionDeliveriesTable.orderId, order.id),
              eq(subscriptionsTable.userId, order.userId),
            ),
          )
          .limit(1);
        if (subDelivery) evidence = "subscription-cycle";
      }
      if (!evidence) {
        const [subsidy] = await db
          .select({ id: companySubsidyChargesTable.id })
          .from(companySubsidyChargesTable)
          .where(eq(companySubsidyChargesTable.orderId, order.id))
          .limit(1);
        if (subsidy) evidence = "subsidy";
      }
      if (!evidence && order.externalOrderId && order.userId) {
        // userId is part of the WHERE, not just the row shape: orders.externalOrderId
        // is unique only PER USER (routes/checkout.ts, routes/loyalty.ts both scope
        // their unique constraint to (userId, externalOrderId)), so two different
        // customers can legitimately choose the identical string. Matching on
        // orderId alone would let a forged order claim a DIFFERENT customer's real
        // credit redemption merely by reusing their externalOrderId.
        const [claim] = await db
          .select({ id: orderClaimsTable.id })
          .from(orderClaimsTable)
          .where(
            and(
              eq(orderClaimsTable.userId, order.userId),
              eq(orderClaimsTable.orderId, order.externalOrderId),
              gt(orderClaimsTable.redeemedPaise, 0),
            ),
          )
          .limit(1);
        if (claim) evidence = "credit-claim";
      }
      if (!evidence) continue; // unsettled zero (forged or discount-minted): stays non-actionable

      const updated = await db
        .update(ordersTable)
        .set({ status: "preparing" })
        .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "placed")))
        .returning({ id: ordersTable.id });
      if (updated.length === 0) continue;
      promoted++;
      logger.info(
        { orderId: order.id, evidence },
        "reconciliation: promoted settled zero-charge order",
      );

      // Same post-promotion side effects as a capture, minus the gateway.
      try {
        await commitSubsidyForOrder(order.id); // idempotent; no-op without a reservation
      } catch (err) {
        logger.error({ err, orderId: order.id }, "reconciliation: zero-charge subsidy commit failed");
      }
      void sendOrderConfirmation(order.id).catch((err: unknown) =>
        logger.error({ err, orderId: order.id }, "sendOrderConfirmation failed"),
      );
      // The kitchen push is gated on orderKind ONLY. It used to also require
      // `order.userId`, which meant a GUEST zero-charge meal order was flipped
      // to "preparing" and then never sent to Petpooja — strictly worse than
      // leaving it alone, because the customer is now told their food is being
      // made while no kitchen has heard of it. The user row is an optional
      // enrichment of the push (a nicer name on the ticket), never a
      // precondition for it.
      if (order.orderKind === "meal") {
        const [user] = order.userId
          ? await db.select().from(usersTable).where(eq(usersTable.id, order.userId)).limit(1)
          : [];
        const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
        pushOrderToPetpooja(order, {
          name: fullName || "Customer",
          email: user?.email || null,
        }, logger).catch((err) => {
          logger.error({ err, orderId: order.id }, "reconciliation: failed to push zero-charge order to Petpooja");
        });
      }
      void emitServerEvent(
        "payment_succeeded",
        {
          charge_paise: 0,
          settled_by: "zero_charge_sweep",
        },
        order.userId ?? null,
      );
    } catch (err) {
      logger.error({ err, orderId: order.id }, "reconciliation: zero-charge promotion failed");
    }
  }
  return promoted;
}

export async function runOrderReconciliationSweep(opts?: {
  now?: Date;
  fetchFn?: typeof fetch;
}): Promise<ReconciliationSweepResult> {
  const now = opts?.now ?? new Date();
  const fetcher = opts?.fetchFn ?? fetch;
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes window

  // Zero-charge promotion runs FIRST and unconditionally: it needs no
  // gateway credentials, and a fully-settled sponsored order must not stay
  // invisible to the kitchen just because Razorpay env is absent.
  try {
    await promoteSettledZeroChargeOrders(now);
  } catch (err) {
    logger.error({ err }, "reconciliation: zero-charge promoter failed");
  }

  const creds = razorpayCredentials();
  if (!creds) {
    logger.warn("reconciliation: Razorpay credentials absent, skipping sweep");
    return { inspected: 0, reconciled: 0, unresolved: 0, errors: 0 };
  }
  const [keyId, keySecret] = creds;

  const staleOrders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "placed"),
        isNotNull(ordersTable.razorpayOrderId),
        lte(ordersTable.createdAt, cutoff),
      ),
    );

  let reconciled = 0;
  let unresolved = 0;
  let errors = 0;

  for (const order of staleOrders) {
    // `userId` is deliberately NOT a condition here. It used to be, and that
    // excluded every GUEST order from the only path that heals a capture whose
    // webhook was dropped — the customer is charged, the order stays "placed",
    // and nothing ever looks at it again. Guests are exactly the population
    // that cannot chase it themselves: no account, no order history, no way
    // back in. The sibling sweep above (promoteSettledZeroChargeOrders) never
    // filtered on userId either; this one was the outlier.
    //
    // Everything downstream already copes with a null userId:
    // `sendOrderConfirmation` left-joins the user and prefers `order.phone`,
    // Petpooja falls back to a placeholder name, and `emitServerEvent` takes
    // `string | null`. Only the user-row lookup below needs guarding.
    if (!order.razorpayOrderId) continue;
    try {
      const res = await fetcher(`https://api.razorpay.com/v1/orders/${order.razorpayOrderId}/payments`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        errors++;
        logger.error({ orderId: order.id, status: res.status }, "reconciliation: Razorpay API returned error");
        continue;
      }

      const body = (await res.json()) as {
        items?: Array<{ id: string; status: string; amount?: number }>;
      };
      // captured ONLY. `authorized` money is not collected — the auth can
      // lapse — and the webhook path never promotes on it either. Promoting
      // here would cook food against money we may never receive.
      const validPayment = body.items?.find(
        (p) =>
          p.status === "captured" &&
          // Same amount-reconciliation rule as the webhook: a capture may only
          // confirm the order when it captured the order's own authoritative
          // amount. A partial or wrong-amount capture is an integrity alarm,
          // not a promotion.
          isCaptureAmountReconciled(
            resolvePayableAmountPaise(order),
            typeof p.amount === "number" ? p.amount : null,
          ),
      );

      if (validPayment) {
        // Guarded atomic UPDATE per Rule §5: never read-then-write without state predicate
        const updated = await db
          .update(ordersTable)
          .set({
            status: "preparing",
            razorpayPaymentId: validPayment.id,
          })
          .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "placed")))
          .returning({ id: ordersTable.id });

        if (updated.length > 0) {
          reconciled++;
          logger.info({ orderId: order.id, paymentId: validPayment.id }, "reconciliation: transitioned order to preparing");

          // The same side effects the webhook performs on a fresh promotion.
          // The CAS above means exactly one of (webhook | sweep) runs them.
          void sendOrderConfirmation(order.id).catch((err: unknown) =>
            logger.error({ err, orderId: order.id }, "sendOrderConfirmation failed"),
          );
          // Corporate subsidy: charge_paise is net of the company's share, so
          // a capture of it means the company now owes that share. Idempotent.
          try {
            await commitSubsidyForOrder(order.id);
          } catch (err) {
            logger.error({ err, orderId: order.id }, "reconciliation: corporate subsidy commit failed");
          }

          // Guest orders have no user row to fetch. Skipping the query is not
          // just tidiness: `eq(usersTable.id, null)` renders as `= NULL`,
          // which matches nothing in SQL, so the lookup would silently cost a
          // round-trip to return the empty result we can name up front.
          const [user] = order.userId
            ? await db.select().from(usersTable).where(eq(usersTable.id, order.userId)).limit(1)
            : [];
          const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

          // Kitchen push is meal-only by schema contract (orders.ts: "the
          // Petpooja push MUST filter to orderKind = 'meal'") — a positive
          // predicate, so a future third kind defaults to NOT cooked.
          if (order.orderKind === "meal") {
            pushOrderToPetpooja(order, {
              name: fullName || "Reconciled Customer",
              email: user?.email || null,
            }, logger).catch((err) => {
              logger.error({ err, orderId: order.id }, "reconciliation: failed to push reconciled order to Petpooja");
            });
          }

          // The webhook was dropped, so no payment_succeeded was ever
          // emitted for this order — emit it here, flagged, so the funnel
          // stays complete without inventing a new event name for the same
          // fact told later.
          void emitServerEvent("payment_succeeded", {
            charge_paise: order.chargePaise ?? order.totalPaise,
            razorpay_payment_id: validPayment.id,
            reconciled_by: "sweep",
          }, order.userId);
        }
      } else {
        unresolved++;
      }
    } catch (err) {
      errors++;
      logger.error({ err, orderId: order.id }, "reconciliation: unexpected exception inspecting order");
    }
  }

  return {
    inspected: staleOrders.length,
    reconciled,
    unresolved,
    errors,
  };
}

let sweepInterval: NodeJS.Timeout | null = null;

export function startReconciliationScheduler(intervalMs: number = 5 * 60 * 1000): void {
  if (sweepInterval) return;
  logger.info({ intervalMs }, "reconciliation scheduler started");
  sweepInterval = setInterval(() => {
    runOrderReconciliationSweep().catch((err) => {
      logger.error({ err }, "unhandled error in order reconciliation sweep");
    });
  }, intervalMs);
}

export function stopReconciliationScheduler(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
    logger.info("reconciliation scheduler stopped");
  }
}
