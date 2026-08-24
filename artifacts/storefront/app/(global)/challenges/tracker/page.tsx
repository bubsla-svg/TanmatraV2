import type { Metadata } from "next";
import { ChallengeTrackerView } from "@/components/challenges/ChallengeTrackerView";

export const metadata: Metadata = {
  title: "Dietary Regimen & Challenge Tracker",
  description: "Track your streak, see how consistent you have been, and join the group check-ins.",
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
          Your streak
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Dietary Challenge Tracker
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          See how many days in a row you have stayed on plan across a multi-week challenge, and join the group check-ins that run alongside it.
        </p>
      </div>

      <ChallengeTrackerView />
    </section>
  );
}
