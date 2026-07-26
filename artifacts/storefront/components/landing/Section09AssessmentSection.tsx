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
          title="Match with your ideal clinical nutrition protocol in 60 seconds"
          subtitle="Our interactive medical & dietary triage aligns your metabolic goals with certified RD formulations and meal tracks."
          buttonLabel="Start Triage Assessment ➔"
        />
      </div>
    </section>
  );
}
