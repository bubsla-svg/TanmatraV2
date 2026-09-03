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
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">Tanmatra Studio</p>
      <h1 className="mt-2 mb-6 font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">Nutrition & Health Studio</h1>
      <WellnessHub />
    </section>
  );
}
