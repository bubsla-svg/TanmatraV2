"use client";
// Client: loads the signed-in user's order history against the live api,
// via TanStack Query.
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { getMyOrders } from "@/lib/ordersApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderRow } from "./OrderRow";

const ORDERS_KEY = ["account", "orders"] as const;

/**
 * SF-09 order history. Read-only, session-gated: an unauthenticated load 401s
 * and we offer Firebase sign-in inline (SF-03), then refetch. Every row is the
 * server's own order record — no client arithmetic, no fabricated status.
 *
 * Loading / error / empty are three distinct states (audit #17) — a failed
 * fetch used to render as plain muted text, visually indistinguishable from
 * "still loading", with no way to retry short of a full page reload.
 */
export function OrderHistory() {
  const {
    data: orders,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: async () => (await getMyOrders()).orders,
  });

  if (isPending) {
    return (
      <ul className="flex flex-col gap-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <Skeleton className="h-20 w-full rounded-xl" />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 401) {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted">Sign in to view your order history.</p>
          <PhoneAuth startExpanded onVerified={() => void refetch()} />
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load your orders</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">
          Something went wrong on our end — this usually clears up on retry.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-opacity hover:opacity-80"
        >
          Try again
        </button>
      </div>
    );
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
