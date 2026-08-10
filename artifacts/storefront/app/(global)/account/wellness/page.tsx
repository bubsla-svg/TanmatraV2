import type { Metadata } from "next";
import { WellnessHub } from "@/components/wellness/WellnessHub";

export const metadata: Metadata = {
  title: "Nutrition & Wellness Studio",
  robots: { index: false },
};

/**
 * Nutrition & Wellness Studio. The authed food/water/fasting tracker and family leaderboard;
 * the public /wellness lander stays as-is for acquisition. Personal PHI, so noindex.
 */
export default function WellnessTrackerPage() {
  return (
    <section
      data-ui-generation="stitch-74"
      data-screen-id="10.5"
      data-screen-state="default"
      className="mx-auto max-w-5xl px-4 py-10"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Tanmatra Studio</p>
      <h1 className="mt-1 mb-6 text-2xl font-bold tracking-tight text-ink">Nutrition & Health Studio</h1>
      <WellnessHub />
    </section>
  );
}
