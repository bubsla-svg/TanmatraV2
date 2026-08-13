import type { Metadata } from "next";
import { ChallengeTrackerView } from "@/components/challenges/ChallengeTrackerView";

export const metadata: Metadata = {
  title: "Dietary Regimen & Challenge Tracker",
  description: "Monitor consecutive daily health streaks, evaluate metabolic regimen consistency, and attend live dietitian cohort check-ins.",
};

export default function ChallengeTrackerPage() {
  return (
    <section
      data-ui-generation="stitch-74"
      data-screen-id="13.3"
      data-screen-state="default"
      className="mx-auto max-w-5xl px-4 py-12 flex flex-col gap-8"
    >
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Behavioral Consistency
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Dietary Challenge Tracker
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          Evaluate consecutive compliance across multi-week metabolic reset routines and join structured group accountability check-ins.
        </p>
      </div>

      <ChallengeTrackerView />
    </section>
  );
}
