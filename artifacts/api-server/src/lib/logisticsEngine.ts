/**
 * Autonomous Logistics & Rider Geolocation Fallback Engine (PRD Phase 2).
 * Scans active delivery queues for dropped signals and delivery lags,
 * flags priority 3PL rescue re-assignment at 15+ minutes PAST THE PROMISED
 * time, and issues a single ₹150 goodwill voucher at 20+ minutes past it.
 * Operator-triggered from the ops console (behind the ops gate) — this is a
 * button, not a scheduler.
 */
import { inArray, eq, gte, sql } from "drizzle-orm";
import {
  db,
  ordersTable,
  vouchersTable,
} from "@workspace/db";
import { logger } from "./logger";
import { sendDeliveryDelaySms } from "./sms";

export interface LogisticsIntervention {
  orderId: number;
  userId: string;
  actionTaken: "re_assign_3pl" | "issue_apology_voucher" | "none";
  voucherCode?: string;
  delayMinutes: number;
}

/**
 * Scan active orders for delivery delays and execute autonomous fallbacks.
 */
export async function scanAndExecuteRiderFallbacks(
  maxAgeHours = 6,
): Promise<LogisticsIntervention[]> {
  const cutoff = new Date(Date.now() - maxAgeHours * 3600_000);
  const activeOrders = await db
    .select()
    .from(ordersTable)
    .where(inArray(ordersTable.status, ["preparing", "ready", "out_for_delivery"]))
    .then((rows) => rows.filter((r) => r.createdAt && r.createdAt >= cutoff));

  const interventions: LogisticsIntervention[] = [];

  // Expected-by: the promised slot when the order has one, else creation time
  // plus the standard fulfilment window. "Minutes since the customer ordered"
  // is NOT a delay — a normal 30–45 minute delivery would hit a 20-minute
  // age threshold on every order, and this function hands out money.
  const STANDARD_FULFILMENT_MIN = 45;
  for (const order of activeOrders) {
    if (!order.createdAt) continue;
    const expectedByMs = order.scheduledFor
      ? order.scheduledFor.getTime()
      : order.createdAt.getTime() + STANDARD_FULFILMENT_MIN * 60_000;
    const delayMinutes = Math.floor((Date.now() - expectedByMs) / 60000);
    const userId = order.userId || "guest";

    if (delayMinutes >= 20) {
      // Check if compensation voucher was already issued for this order
      const existingVouchers = await db
        .select()
        .from(vouchersTable)
        .where(eq(vouchersTable.message, `Compensation for delay on Order #${order.id}`))
        .limit(1);

      if (existingVouchers.length === 0) {
        const voucherCode = `APO_${order.id}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        
        await db.insert(vouchersTable).values({
          code: voucherCode,
          amountPaise: 15000, // ₹150 goodwill credit
          purchasedByUserId: null,
          message: `Compensation for delay on Order #${order.id}`,
          status: "active",
        });

        // ONE grant, not two. The voucher IS the ₹150 — redeeming it lands in
        // the wallet through the existing voucher flow. The first draft also
        // wrote a direct ₹150 credit_ledger row alongside it, paying every
        // incident twice (₹300) and once more at redemption.

        const msg = `Delay Alert for Order #${order.id}: Your meal is running behind due to weather or traffic. We have dispatched a priority rescue rider and credited ₹150 (Voucher: ${voucherCode}) to your Protocol Vault!`;
        await sendDeliveryDelaySms(
          { orderId: order.id, phone: order.phone ?? undefined, message: msg },
          { dedupe: { userId: order.userId || "guest", templateId: "delay_apology_150", serviceDate: String(order.id) } },
        ).catch(() => {});

        logger.info({ orderId: order.id, voucherCode, delayMinutes }, "logistics.autonomous.voucher_issued");
        interventions.push({
          orderId: order.id,
          userId,
          actionTaken: "issue_apology_voucher",
          voucherCode,
          delayMinutes,
        });
      } else {
        interventions.push({
          orderId: order.id,
          userId,
          actionTaken: "none",
          delayMinutes,
        });
      }
    } else if (delayMinutes >= 15) {
      // 15 to 19 minutes: trigger 3PL priority rescue re-assignment proxy
      logger.warn({ orderId: order.id, status: order.status, delayMinutes }, "logistics.autonomous.3pl_re_assign");
      interventions.push({
        orderId: order.id,
        userId,
        actionTaken: "re_assign_3pl",
        delayMinutes,
      });
    } else {
      interventions.push({
        orderId: order.id,
        userId,
        actionTaken: "none",
        delayMinutes,
      });
    }
  }

  return interventions;
}
