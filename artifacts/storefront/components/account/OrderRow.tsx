"use client";
// Client: one order-history row.
import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { statusLabel } from "@/lib/orderStatus";
import type { OrderSummary } from "@/lib/ordersApi";

/**
 * Only in-flight orders can be tracked. Allowlist (not a terminal denylist):
 * new terminal states — "refunded" (refunds.ts / ops), "failed" (payments) —
 * keep appearing, so an allowlist fails safe by hiding Track for anything it
 * doesn't recognise rather than showing a dead "Track" CTA on a settled order.
 */
const TRACKABLE = new Set(["placed", "preparing", "ready", "rider_assigned", "out_for_delivery"]);

export function OrderRow({ order }: { order: OrderSummary }) {
  const date = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const trackable = TRACKABLE.has(order.status);
  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{statusLabel(order.status)}</span>
        <span className="tabular text-sm font-semibold text-ink">{formatPaise(order.totalPaise)}</span>
      </div>
      <p className="tabular mt-0.5 text-xs text-ink-faint">
        #{order.externalOrderId} · {date}
      </p>
      {order.addressLabel && <p className="text-xs text-ink-faint">{order.addressLabel}</p>}
      {trackable && (
        <Link
          href={`/track/${encodeURIComponent(order.externalOrderId)}`}
          className="mt-2 inline-block text-sm font-medium text-gold-text hover:underline"
        >
          Track &rarr;
        </Link>
      )}
    </li>
  );
}
