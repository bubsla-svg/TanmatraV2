import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { SubscriptionManager } from "@/components/account/SubscriptionManager";

export const metadata: Metadata = {
  title: "Your plans",
  robots: { index: false },
};

/**
 * Account → Plans (SF-08). RSC shell; the manager island owns the session-gated
 * list + pause / resume / cancel against /api/subscriptions. Signed-out visitors
 * are offered Firebase sign-in inline — never a dead end.
 */
export default function SubscriptionsPage() {
  return (
    <section
      data-ui-generation="stitch-74"
      data-screen-id="9.3"
      data-screen-state="default"
      className="mx-auto max-w-md px-4 py-10"
    >
      <AccountNav active="subscriptions" />
      <h1 className="text-lg font-semibold text-ink">Your plans</h1>
      <p className="mt-1 mb-5 text-sm text-ink-muted">Pause, resume, or cancel your subscriptions anytime.</p>
      <SubscriptionManager />
    </section>
  );
}
