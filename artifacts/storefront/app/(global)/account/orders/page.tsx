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
    <section
      data-ui-generation="stitch-74"
      data-screen-id="10.2"
      data-screen-state="default"
      className="mx-auto max-w-md px-4 py-10"
    >
      <AccountNav active="orders" />
      <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">Orders</h1>
      <p className="mt-1 mb-8 text-sm text-ink-muted">
        Your clinical history and metabolic logs — most recent first.
      </p>
      <OrderHistory />
    </section>
  );
}
