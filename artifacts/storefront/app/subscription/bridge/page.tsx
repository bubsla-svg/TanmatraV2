import type { Metadata } from "next";
import { Suspense } from "react";
import { BridgeView } from "@/components/subscription/BridgeView";

export const metadata: Metadata = {
  title: "Trial Upgrade & Bridge Credit",
  description: "Transition from your 3-day taste test to a full dietitian-curated meal subscription with automatic trial credit redemption.",
};

export default function SubscriptionBridgePage() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Next Step in Wellness
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Upgrade to Full Care
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Your intro trial has set the foundation. Secure your recurring meal schedule with zero financial gap.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-ink-muted">Loading your credit status…</p>}>
        <BridgeView />
      </Suspense>
    </section>
  );
}
