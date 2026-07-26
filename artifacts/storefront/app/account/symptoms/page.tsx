import type { Metadata } from "next";
import { SymptomTrackerView } from "@/components/symptoms/SymptomTrackerView";

export const metadata: Metadata = {
  title: "Health Symptom & Reaction Tracker | Tanmatra",
  description: "Correlate post-meal digestive comfort, glycemic alertness, and satiety levels directly with your dietary prescriptions.",
};

export default function SymptomTrackerPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Clinical Feedback Loop
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Health Symptom &amp; Reaction Tracker
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          Log physiological post-meal reactions to provide our registered dietitians with verified clinical telemetry for adjusting your upcoming culinary formulas.
        </p>
      </div>

      <SymptomTrackerView />
    </section>
  );
}
