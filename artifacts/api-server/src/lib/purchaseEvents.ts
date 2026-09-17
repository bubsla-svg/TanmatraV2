/**
 * The two server-truth money events T2 adds (CRO handoff 2026-09-17), in one
 * place so the three capture paths (verify, payment.captured webhook, payment
 * link) and the payment.failed webhook cannot drift in what they record.
 *
 * `purchase` is emitted exactly once per order: every caller sits inside the
 * guarded placed→preparing UPDATE, which only one path wins. `src` and the
 * funnel session come off the order row (stamped from the browser's cookies
 * at creation, routes/checkout.ts), so the conversion joins back to the scan
 * or visit that produced it — the join the scoreboard could not make before.
 */
import { emitServerEvent } from "./serverEvents";

export interface PurchaseOrderFacts {
  id: number;
  /** Nullable on the row (imported / POS orders carry none); the event falls
   *  back to the internal id so a purchase is never emitted without a key. */
  externalOrderId: string | null;
  userId: string | null;
  chargePaise: number | null;
  totalPaise: number;
  acquisitionSrc: string | null;
  funnelSessionId: string | null;
}

export function purchaseProps(
  order: PurchaseOrderFacts,
  opts: { method: string; path: "verify" | "webhook" | "payment_link" },
): Record<string, unknown> {
  return {
    order_id: order.externalOrderId ?? `order-${order.id}`,
    amount_paise: order.chargePaise ?? order.totalPaise,
    method: opts.method,
    capture_path: opts.path,
    ...(order.acquisitionSrc ? { src: order.acquisitionSrc } : {}),
  };
}

export function emitPurchase(
  order: PurchaseOrderFacts,
  opts: { method: string; path: "verify" | "webhook" | "payment_link" },
): Promise<void> {
  return emitServerEvent("purchase", purchaseProps(order, opts), order.userId, order.funnelSessionId);
}

export function paymentFailedProps(
  order: PurchaseOrderFacts,
  opts: { method: string | null; errorCode: string | null; errorReason: string | null },
): Record<string, unknown> {
  return {
    order_id: order.externalOrderId ?? `order-${order.id}`,
    amount_paise: order.chargePaise ?? order.totalPaise,
    ...(opts.method ? { method: opts.method } : {}),
    error_code: opts.errorCode ?? "unknown",
    ...(opts.errorReason ? { reason: opts.errorReason.slice(0, 128) } : {}),
    ...(order.acquisitionSrc ? { src: order.acquisitionSrc } : {}),
    source_path: "webhook",
  };
}

export function emitPaymentFailed(
  order: PurchaseOrderFacts,
  opts: { method: string | null; errorCode: string | null; errorReason: string | null },
): Promise<void> {
  return emitServerEvent("payment_failed", paymentFailedProps(order, opts), order.userId, order.funnelSessionId);
}
