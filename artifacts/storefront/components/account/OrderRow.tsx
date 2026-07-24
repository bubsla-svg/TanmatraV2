"use client";
// Client: one order-history row.
import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { statusLabel, TRACKABLE_STATUSES } from "@/lib/orderStatus";
import type { OrderSummary } from "@/lib/ordersApi";
import { ReorderButton } from "./ReorderButton";

export function OrderRow({ order }: { order: OrderSummary }) {
  const date = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  // Allowlist, fails safe — see TRACKABLE_STATUSES in lib/orderStatus.
  const trackable = TRACKABLE_STATUSES.has(order.status);
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
      <span className="flex items-center gap-4">
        {trackable && (
          <Link
            href={`/track/${encodeURIComponent(order.externalOrderId)}`}
            className="mt-2 inline-block text-sm font-medium text-gold-text hover:underline"
          >
            Track &rarr;
          </Link>
        )}
        <ReorderButton items={order.items ?? []} />
      </span>
    </li>
  );
}
