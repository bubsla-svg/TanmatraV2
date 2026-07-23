"use client";
// "use client" justification: live tracker — polls the guest status endpoint
// and announces changes via a live region. The page shell stays RSC.
import { useEffect, useState } from "react";
import {
  fetchOrderStatus,
  statusLabel,
  type OrderStatusResult,
} from "@/lib/orderStatus";

const POLL_MS = 20_000;

/**
 * Polls GET /api/orders/:id/status (same-origin proxy) every 20s. All three
 * outcomes render honest UI: live status + ETA countdown, "not found", or
 * "can't reach the kitchen right now" — never a crash as the only content
 * (§6), never an invented status.
 */
export function TrackStatus({ externalOrderId }: { externalOrderId: string }) {
  const [result, setResult] = useState<OrderStatusResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const r = await fetchOrderStatus(externalOrderId, "");
      if (!cancelled) setResult(r);
    };
    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
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
  return (
    <div aria-live="polite" className="rounded-xl border border-line bg-surface p-5">
      <p className="text-lg font-semibold text-ink">{statusLabel(status)}</p>
      {status !== "delivered" && status !== "cancelled" && (
        <p className="mt-1 text-sm text-ink-muted">
          Estimated arrival in{" "}
          <span className="tabular font-semibold text-ink">{etaMinutes} min</span>
        </p>
      )}
    </div>
  );
}
