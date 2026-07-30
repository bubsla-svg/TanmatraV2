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
  failed: "text-destructive",
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
      <div aria-hidden className="h-24 animate-pulse rounded-xl bg-surface-raised" />
    );
  }

  if (result.kind === "not_found") {
    return (
      <div role="status" className="rounded-xl border border-line bg-surface p-5">
        <p className="text-sm font-semibold text-ink">We can&rsquo;t find that order.</p>
        <p className="mt-1 text-sm text-ink-muted">
          Check the link from your confirmation — order IDs are case-sensitive.
        </p>
      </div>
    );
  }

  if (result.kind === "unavailable") {
    return (
      <div role="status" className="rounded-xl border border-line bg-surface p-5">
        <p className="text-sm font-semibold text-ink">
          Live tracking is unreachable right now.
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Your order is unaffected — this screen retries automatically.
        </p>
      </div>
    );
  }

  const { status, etaMinutes } = result.status;
  const tone = statusTone(status);
  const trackable = TRACKABLE_STATUSES.has(status);
  return (
    <div aria-live="polite" className="rounded-xl border border-line bg-surface p-5">
      <p className={`flex items-center gap-2 text-lg font-semibold ${TONE_TEXT[tone]}`}>
        {tone === "live" && (
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-sage" />
        )}
        {statusLabel(status)}
      </p>
      {trackable && (
        <p className="mt-1 text-sm text-ink-muted">
          Estimated arrival in{" "}
          <span className="tabular font-semibold text-ink">{etaMinutes} min</span>
        </p>
      )}
      {tone === "failed" && (
        <p className="mt-1 text-sm font-semibold text-destructive">
          This order did not complete — you have not been charged for it.
        </p>
      )}
      {status === "delivered" && (
        <p className="mt-1 text-sm text-ink-muted">This order has been delivered.</p>
      )}
    </div>
  );
}
