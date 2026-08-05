import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { BillingPanel } from "@/components/account/BillingPanel";

export const metadata: Metadata = {
  title: "Billing & credits",
  robots: { index: false },
};

/**
 * Account → Billing (route-parity Wave G). RSC shell; the panel is the session-
 * gated, READ-ONLY credit-ledger statement (wallet balance + credit activity).
 * Order receipts live at /account/orders, recurring billing at /account/subscriptions.
 */
export default function BillingPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <AccountNav active="billing" />
      <h1 className="text-lg font-semibold text-ink">Billing &amp; credits</h1>
      <p className="mt-1 mb-5 text-sm text-ink-muted">Your wallet balance and credit activity.</p>
      <BillingPanel />
    </section>
  );
}
