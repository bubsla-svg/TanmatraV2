import type { Metadata } from "next";
import { WellnessTracker } from "@/components/wellness/WellnessTracker";

export const metadata: Metadata = {
  title: "Nutrition tracker",
  robots: { index: false },
};

/**
 * Nutrition tracker (route-parity — PHI v2). The authed food/water tracker; the
 * public /wellness lander stays as-is for acquisition. Personal PHI, so noindex.
 * Wearable sync is deferred (manual logging only).
 */
export default function WellnessTrackerPage() {
  return (
    <section className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Today</p>
      <h1 className="mt-1 mb-6 text-2xl font-semibold tracking-tight text-ink">Nutrition tracker</h1>
      <WellnessTracker />
    </section>
  );
}
