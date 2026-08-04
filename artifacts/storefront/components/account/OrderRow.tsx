"use client";
// Client: one order-history row.
import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { statusLabel, statusTone, TRACKABLE_STATUSES } from "@/lib/orderStatus";
import type { OrderSummary } from "@/lib/ordersApi";
import { ReorderButton } from "./ReorderButton";

/** Tone → status-label colour (route-12 brief). Signal, not action, so sage and
 *  destructive are correct here and gold stays reserved for the CTAs below. */
const TONE_TEXT = {
  live: "text-sage-text",
  settled: "text-ink-muted",
  failed: "text-[var(--danger)]",
} as const;

export function OrderRow({ order }: { order: OrderSummary }) {
  const date = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  // Allowlist, fails safe — see TRACKABLE_STATUSES in lib/orderStatus.
  const trackable = TRACKABLE_STATUSES.has(order.status);
  const tone = statusTone(order.status);

  return (
    <li
      className={`rounded-xl border border-line bg-surface p-4 transition-transform active:scale-[0.98] ${
        tone === "failed" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`flex items-center gap-2 text-sm font-semibold ${TONE_TEXT[tone]}`}>
          {tone === "live" && (
            <span aria-hidden className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-sage" />
          )}
          {statusLabel(order.status)}
        </span>
        <span className="tabular text-sm font-semibold text-ink">
          {formatPaise(order.totalPaise)}
        </span>
      </div>

      <p className="tabular mt-2 text-xs text-ink-faint">
        #{order.externalOrderId} · {date}
        {order.addressLabel && <span className="text-ink-muted"> · {order.addressLabel}</span>}
      </p>

      {tone === "failed" ? (
        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-ink-faint">
          Incomplete transaction
        </p>
      ) : (
        <span className="mt-4 flex items-center gap-4">
          {trackable && (
            <Link
              href={`/track/${encodeURIComponent(order.externalOrderId)}`}
              className="group inline-flex items-center gap-1 text-sm font-semibold text-gold-text hover:opacity-80"
            >
              Track
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                &rarr;
              </span>
            </Link>
          )}
          <ReorderButton items={order.items ?? []} />
        </span>
      )}
    </li>
  );
}
