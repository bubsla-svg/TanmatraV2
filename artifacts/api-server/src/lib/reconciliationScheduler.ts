// ─────────────────────────────────────────────────────────────────────────────
// Razorpay Payment Reconciliation Scheduler
//
// Backstop for dropped webhooks or client connectivity aborts after successful
// Razorpay checkout. Periodically sweeps "placed" (unpaid) orders older than
// 15 minutes, inspects payment state via Razorpay API, and transitions valid
// captures to "preparing" while pushing to PetPooja KDS and logging telemetry.
// ─────────────────────────────────────────────────────────────────────────────

import { and, eq, lte, isNotNull } from "drizzle-orm";
import { db, ordersTable, usersTable } from "@workspace/db";
import { logger } from "./logger";
import { razorpayCredentials, razorpayBasicAuth } from "./razorpayRecurring";
import { pushOrderToPetpooja } from "./petpoojaClient";
import { emitServerEvent } from "./serverEvents";

export interface ReconciliationSweepResult {
  inspected: number;
  reconciled: number;
  unresolved: number;
  errors: number;
}

export async function runOrderReconciliationSweep(opts?: {
  now?: Date;
  fetchFn?: typeof fetch;
}): Promise<ReconciliationSweepResult> {
  const now = opts?.now ?? new Date();
  const fetcher = opts?.fetchFn ?? fetch;
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes window

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
    if (!order.razorpayOrderId || !order.userId) continue;
    const orderUserId = order.userId;
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

      const body = (await res.json()) as { items?: Array<{ id: string; status: string }> };
      const validPayment = body.items?.find((p) => p.status === "captured" || p.status === "authorized");

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

          const [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, orderUserId))
            .limit(1);
          const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

          if (order.orderKind !== "marketplace") {
            pushOrderToPetpooja(order, {
              name: fullName || "Reconciled Customer",
              email: user?.email || null,
            }, logger).catch((err) => {
              logger.error({ err, orderId: order.id }, "reconciliation: failed to push reconciled order to Petpooja");
            });
          }

          void emitServerEvent("subscription_order_reconciled", {
            orderId: order.id,
            razorpayPaymentId: validPayment.id,
            reconciledBy: "scheduler",
          }, orderUserId);
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
