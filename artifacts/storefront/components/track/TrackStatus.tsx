"use client";
// "use client" justification: live tracker — polls the guest status endpoint
// and announces changes via a live region. The page shell stays RSC.
import { useEffect, useRef, useState } from "react";
import {
  fetchOrderStatus,
  statusLabel,
  statusTone,
  TRACKABLE_STATUSES,
  type OrderStatusResult,
} from "@/lib/orderStatus";

const POLL_MS = 20_000;

/** Tone → status-line colour — same mapping as route-12's OrderRow and the
 *  order-confirmed page, so this screen doesn't paint delivered/cancelled/
 *  refunded orders with the same neutral treatment as an in-flight one. */
const TONE_TEXT = {
  live: "text-sage-text",
  settled: "text-ink-muted",
  failed: "text-danger",
} as const;

/**
 * Polls GET /api/orders/:id/status (same-origin proxy) every 20s. All three
 * outcomes render honest UI: live status + ETA countdown, "not found", or
 * "can't reach the kitchen right now" — never a crash as the only content
 * (§6), never an invented status.
 *
 * Polling stops once a fetched status leaves TRACKABLE_STATUSES (delivered,
 * cancelled, refunded, failed, or anything unrecognised) — there is nothing
 * left to change, and polling a settled order forever wastes the customer's
 * connection and the server's attention for no one's benefit.
 */
export function TrackStatus({ externalOrderId }: { externalOrderId: string }) {
  const [result, setResult] = useState<OrderStatusResult | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const r = await fetchOrderStatus(externalOrderId, "");
      if (cancelled) return;
      setResult(r);
      if (r.kind === "ok" && !TRACKABLE_STATUSES.has(r.status.status) && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    void poll();
    intervalRef.current = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [externalOrderId]);

  if (result === null) {
    return (
      <div
        aria-hidden
        className="h-56 w-full animate-pulse rounded-2xl border border-line bg-secondary"
      />
    );
  }

  if (result.kind === "not_found") {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-sm font-semibold text-ink">We can&rsquo;t find that order.</p>
        <p className="mt-1 text-sm text-ink-muted">
          Check the link from your confirmation — order IDs are case-sensitive.
        </p>
      </div>
    );
  }

  if (result.kind === "unavailable") {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-sm font-semibold text-ink">
          Live tracking is unreachable right now.
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Your order is unaffected — this screen retries automatically.
        </p>
      </div>
    );
  }

  const { status, timing, etaMinutes, scheduledFor, deliveryWindow } = result.status;
  const tone = statusTone(status);
  const trackable = TRACKABLE_STATUSES.has(status);
  const scheduledLabel = scheduledFor
    ? new Date(scheduledFor).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : null;
  return (
    <div
      aria-live="polite"
      className={`relative flex flex-col items-center gap-6 overflow-hidden rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)] ${
        tone === "failed" ? "opacity-70" : ""
      }`}
    >
      {/* Ambient card glow — decorative only, live tone alone. */}
      {tone === "live" && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-sage-soft blur-3xl"
        />
      )}
      <p
        className={`relative z-10 inline-flex items-center gap-2 rounded-full border border-line bg-secondary px-4 py-2 text-xs font-semibold uppercase tracking-widest ${TONE_TEXT[tone]}`}
      >
        {tone === "live" && (
          <span aria-hidden className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sage" />
          </span>
        )}
        {statusLabel(status)}
      </p>
      {trackable && timing === "on_demand" && (
        <div className="relative z-10 flex flex-col items-center gap-1">
          <span className="text-sm text-ink-muted">Estimated arrival in</span>
          <span className="flex items-baseline gap-1.5 font-data text-5xl font-bold leading-none text-primary">
            {etaMinutes}
            <span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
              min
            </span>
          </span>
        </div>
      )}
      {trackable && timing === "scheduled" && (
        <div className="relative z-10 flex flex-col items-center gap-1">
          <span className="text-sm text-ink-muted">Scheduled for</span>
          <span className="font-display text-2xl font-semibold leading-tight text-primary">
            {scheduledLabel}
          </span>
          {deliveryWindow && (
            <span className="font-data text-sm text-ink-muted">{deliveryWindow}</span>
          )}
        </div>
      )}
      {trackable && timing === "pending" && (
        <div className="relative z-10 flex flex-col items-center gap-1">
          <span className="text-sm font-semibold text-ink">Confirming your delivery time</span>
          <span className="text-xs text-ink-muted">This updates automatically — no action needed.</span>
        </div>
      )}
      {tone === "failed" && (
        <p className="relative z-10 text-sm font-semibold text-danger">
          This order did not complete — you have not been charged for it.
        </p>
      )}
      {status === "delivered" && (
        <p className="relative z-10 text-sm text-ink-muted">This order has been delivered.</p>
      )}
    </div>
  );
}
