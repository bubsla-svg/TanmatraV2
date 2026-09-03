import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { SymptomTrackerView } from "@/components/symptoms/SymptomTrackerView";

export const metadata: Metadata = {
  title: "Health Symptom & Reaction Tracker",
  description: "Tell us how a meal left you feeling, so your dietitian can adjust what comes next.",
};

export default function SymptomTrackerPage() {
  return (
    <section
      data-ui-generation="stitch-74"
      data-screen-id="10.7"
      data-screen-state="default"
      className="mx-auto max-w-6xl px-4 py-12 flex flex-col gap-10"
    >
      <AccountNav active="symptoms" />
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">
          How meals are landing
        </span>
        <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">
          Health Symptom &amp; Reaction Tracker
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          Note how you felt after a meal — digestion, energy, how full it kept you. Your dietitian reads these and changes what we cook for you next.
        </p>
      </div>

      <SymptomTrackerView />
    </section>
  );
}
