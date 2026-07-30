"use client";
// Client: owns one subscription's delivery schedule + skip/restore actions.
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import {
  getSubscription,
  skipDelivery,
  unskipDelivery,
  type SubscriptionDetail,
  type SubscriptionDelivery,
} from "@/lib/subscriptionsApi";

const SHOW_AT_MOST = 4;

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Upcoming deliveries for one subscription (SF-10 tail / CUJ-05): skip and
 * restore against the per-delivery seams. The server owns the rules — the 24h
 * cutoff (409 past_cutoff, surfaced verbatim) and the credit grant/clawback —
 * so every action re-fetches; nothing here is optimistic. The active-mandate
 * line states autopay honestly from the detail response.
 */
export function DeliveryList({ subscriptionId }: { subscriptionId: number }) {
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(new Set());

  const load = useCallback(async () => {
    try {
      setDetail(await getSubscription(subscriptionId));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load the delivery schedule.");
    }
  }, [subscriptionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(d: SubscriptionDelivery) {
    setBusyIds((prev) => new Set(prev).add(d.id));
    setError(null);
    try {
      await (d.status === "skipped" ? unskipDelivery(d.id) : skipDelivery(d.id));
      await load();
    } catch (e) {
      // past_cutoff and friends arrive as the server's own sentence — show it.
      setError(e instanceof ApiError ? e.message : "Couldn't update that delivery.");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(d.id);
        return next;
      });
    }
  }

  if (detail === null) {
    return <p className="mt-3 text-xs text-ink-muted">{error ?? "Loading deliveries…"}</p>;
  }

  const rows = detail.deliveries
    .filter((d) => d.status === "upcoming" || d.status === "skipped")
    .slice(0, SHOW_AT_MOST);

  return (
    <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-4">
      {detail.mandate && (
        <p className="inline-flex w-fit items-center gap-1.5 self-start rounded-full bg-sage-soft px-3 py-1 text-xs font-medium text-sage-text">
          UPI Autopay active — you&rsquo;ll be notified at least 24h before each charge.
        </p>
      )}
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-xs text-ink-muted">No upcoming deliveries on the schedule.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2.5 text-sm">
              <span className={d.status === "skipped" ? "text-ink-faint line-through" : "text-ink"}>
                {fmtDay(d.scheduledFor)}
                {d.deliveryWindow ? <span className="text-ink-faint"> · {d.deliveryWindow}</span> : null}
              </span>
              <button
                type="button"
                disabled={busyIds.has(d.id)}
                onClick={() => void act(d)}
                className="-m-1 p-1 text-xs font-medium text-gold-text hover:underline disabled:opacity-40"
              >
                {d.status === "skipped" ? "Restore" : "Skip"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-0.5 text-[11px] text-ink-faint">
        Skips up to 24h ahead come back as meal credits.
      </p>
    </div>
  );
}
