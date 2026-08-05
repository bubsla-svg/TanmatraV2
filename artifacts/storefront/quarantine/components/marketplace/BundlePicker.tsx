"use client";
// Recent-orders picker for bundle-with-meal delivery. The item still gets its
// own paid order; bundleWithOrderId just links delivery to the chosen order.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatPaise } from "@/lib/format";
import { getMyOrders } from "@/lib/ordersApi";
import { ApiError } from "@/lib/apiClient";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function BundlePicker({ selected, onSelect, onAuthError }: { selected: number | null; onSelect: (id: number) => void; onAuthError?: () => void }) {
  const {
    data: orders,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["marketplace", "bundles"],
    queryFn: () => getMyOrders().then((r) => r.orders.slice(0, 6)),
  });

  const authError = isError && error instanceof ApiError && error.status === 401;

  // Same shape as before the migration: a 401 hands off to the parent's
  // PhoneAuth flow via onAuthError and this island just keeps showing its
  // loading copy underneath (the parent's CTA area is what actually switches).
  useEffect(() => {
    if (authError) onAuthError?.();
  }, [authError, onAuthError]);

  if (isError && !authError) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-xs text-ink-muted">Couldn&rsquo;t load your orders.</p>
        <button type="button" onClick={() => void refetch()} className="text-xs font-semibold text-gold-text hover:underline">
          Retry
        </button>
      </div>
    );
  }
  if (isPending || authError || !orders) return <p className="text-xs text-ink-muted">Loading your recent orders…</p>;
  if (orders.length === 0) return <p className="text-xs text-ink-muted">No recent orders to bundle with — it&rsquo;ll ship separately.</p>;

  return (
    <div className="flex flex-col gap-2">
      {orders.map((o) => (
        <label
          key={o.serverOrderId}
          className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
            selected === o.serverOrderId ? "border-[var(--gold)] bg-surface-raised" : "border-line hover:bg-surface-raised"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <input type="radio" name="bundle-order" checked={selected === o.serverOrderId} onChange={() => onSelect(o.serverOrderId)} className="accent-[var(--gold)]" />
            <span className="truncate text-sm text-ink">{day(o.createdAt)}{o.addressLabel ? ` · ${o.addressLabel}` : ""}</span>
          </span>
          <span className="tabular shrink-0 text-xs text-ink-muted">{formatPaise(o.totalPaise)} · {o.status}</span>
        </label>
      ))}
    </div>
  );
}
