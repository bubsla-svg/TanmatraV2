import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { OrderHistory } from "@/components/account/OrderHistory";

export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false },
};

/**
 * Account → Orders (SF-09). RSC shell; the history island owns the session-gated
 * list against /api/orders/mine. Signed-out visitors are offered Firebase
 * sign-in inline — never a dead end.
 */
export default function OrdersPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <AccountNav active="orders" />
      <h1 className="text-3xl font-bold tracking-tight text-ink">Orders</h1>
      <p className="mt-1 mb-8 text-sm text-ink-muted">
        Your clinical history and metabolic logs — most recent first.
      </p>
      <OrderHistory />
    </section>
  );
}
