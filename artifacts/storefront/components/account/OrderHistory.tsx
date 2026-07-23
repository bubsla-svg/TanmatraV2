"use client";
// Client: loads the signed-in user's order history against the live api.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import { getMyOrders, type OrderSummary } from "@/lib/ordersApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { OrderRow } from "./OrderRow";

/**
 * SF-09 order history. Read-only, session-gated: an unauthenticated load 401s
 * and we offer Firebase sign-in inline (SF-03), then reload. Every row is the
 * server's own order record — no client arithmetic, no fabricated status.
 */
export function OrderHistory() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { orders } = await getMyOrders();
      setOrders(orders);
      setNeedsAuth(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else setError(e instanceof ApiError ? e.message : "Couldn't load your orders.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to view your order history.</p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }

  if (orders === null) {
    return <p className="text-sm text-ink-muted">{error ?? "Loading your orders…"}</p>;
  }

  if (orders.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No orders yet.{" "}
        <Link href="/menu" className="font-medium text-gold-text hover:underline">Browse the menu</Link>.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => (
        <OrderRow key={o.serverOrderId} order={o} />
      ))}
    </ul>
  );
}
