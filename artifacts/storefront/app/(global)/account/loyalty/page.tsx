import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { LoyaltyHub } from "@/components/account/LoyaltyHub";

export const metadata: Metadata = {
  title: "Rewards",
  robots: { index: false },
};

/**
 * Account → Rewards (Wave-3). RSC shell; LoyaltyHub owns the session-gated
 * referral code + per-subscription loyalty progress reads.
 */
export default function LoyaltyPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <AccountNav active="loyalty" />
      <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">Rewards</h1>
      <p className="mt-2 mb-6 text-sm text-ink-muted">Refer friends and track your plan&rsquo;s loyalty rewards.</p>
      <LoyaltyHub />
    </section>
  );
}
