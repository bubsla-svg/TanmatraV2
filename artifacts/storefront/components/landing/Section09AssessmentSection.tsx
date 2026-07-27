import React from "react";
import { AssessmentStepper } from "./AssessmentStepper";

/**
 * §9: Interactive Assessment Section.
 * Hosts the on-page conversion triage banner allowing users to launch the 5-step clinical assessment modal.
 */
export function Section09AssessmentSection() {
  return (
    <section id="assessment-section" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl bg-surface-raised p-2 sm:p-4">
        <AssessmentStepper
          defaultOpen={false}
          title="Find Your Perfect Meal Plan in 60 Seconds"
          subtitle="Answer a few quick questions about your goals and lifestyle, and we'll recommend the best plan for you."
          buttonLabel="Find My Plan ➔"
        />
      </div>
    </section>
  );
}
