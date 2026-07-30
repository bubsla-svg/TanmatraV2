import type { Metadata } from "next";
import { Suspense } from "react";
import { BridgeView } from "@/components/subscription/BridgeView";
// Stitch dark scope (route-scoped) — see lib/themes/stitch.css. The bridge is
// a single terminal conversion action (Batch 4/Brief 23 vocabulary: "this IS
// a purchase decision"), so it shares /trial and /checkout's dark canvas +
// glass sticky-footer treatment rather than the lighter Astryx surfaces
// elsewhere in the app.
import "@/lib/themes/stitch.css";

export const metadata: Metadata = {
  title: "Trial Upgrade & Bridge Credit",
  description: "Transition from your 3-day taste test to a full dietitian-curated meal subscription with automatic trial credit redemption.",
};

export default function SubscriptionBridgePage() {
  return (
    <div data-stitch="dark" className="min-h-screen bg-[var(--bg)] text-ink">
      {/* pb-48 clears BridgeView's sticky footer CTA (ready state) so the
          unlock card is never hidden behind it while scrolling — same
          reasoning as /trial's section padding. */}
      <section className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-10 pb-48">
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
    </div>
  );
}
