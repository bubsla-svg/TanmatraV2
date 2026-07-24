"use client";
// Recent-orders picker for bundle-with-meal delivery. The item still gets its
// own paid order; bundleWithOrderId just links delivery to the chosen order.
import { useEffect, useState } from "react";
import { formatPaise } from "@/lib/format";
import { getMyOrders, type OrderSummary } from "@/lib/ordersApi";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function BundlePicker({ selected, onSelect }: { selected: number | null; onSelect: (id: number) => void }) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getMyOrders()
      .then((r) => { if (live) setOrders(r.orders.slice(0, 6)); })
      .catch(() => { if (live) setError("Couldn't load your orders."); });
    return () => { live = false; };
  }, []);

  if (error) return <p className="text-xs text-ink-muted">{error}</p>;
  if (orders === null) return <p className="text-xs text-ink-muted">Loading your recent orders…</p>;
  if (orders.length === 0) return <p className="text-xs text-ink-muted">No recent orders to bundle with — it&rsquo;ll ship separately.</p>;

  return (
    <div className="flex flex-col gap-2">
      {orders.map((o) => (
        <label
          key={o.serverOrderId}
          className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 ${selected === o.serverOrderId ? "border-[var(--gold)]" : "border-line"}`}
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
