import type { Metadata } from "next";
import { CareHeader } from "@/components/care/CareHeader";
import { NeedStateRail } from "@/components/care/NeedStateRail";
import { ConditionRail } from "@/components/care/ConditionRail";
import { AssessmentEntryCard } from "@/components/care/AssessmentEntryCard";
import { TherapeuticPlanRail } from "@/components/care/TherapeuticPlanRail";
import { TrialEntryCard } from "@/components/care/TrialEntryCard";
import { ClinicalSupportEntry } from "@/components/care/ClinicalSupportEntry";
import { CARE_BY_CONDITION_ENABLED } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Care",
  description: "Find the right Tanmatra plan for your goal.",
};

/**
 * Care index (D-05B, TNM-CRO-01 owner ruling 2026-08-11): a compact
 * consumer-commerce feed, not a medical directory — every card declares an
 * action. Ruled hierarchy, top to bottom: CareHeader, NeedStateRail,
 * ConditionRail, AssessmentEntryCard, TherapeuticPlanRail, TrialEntryCard,
 * ClinicalSupportEntry. All data comes from existing sources (the plan
 * catalog via lib/plans.ts, the same condition set /care/[condition] pages
 * read) — no new fetch surface.
 *
 * The by-condition half of that hierarchy — ConditionRail, the assessment
 * entry and the clinical-support link — is behind CARE_BY_CONDITION_ENABLED
 * and OFF by default (consumer copy deck). The ruled order is preserved when
 * the flag is on; with it off the page is the header, the goal rail and the
 * two commerce entries.
 */
export default function CarePage() {
  return (
    <div className="min-h-dvh pb-24">
      <section className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
        <CareHeader />
        <NeedStateRail />
        {CARE_BY_CONDITION_ENABLED && (
          <>
            <ConditionRail />
            <AssessmentEntryCard />
          </>
        )}
        <TherapeuticPlanRail />
        <TrialEntryCard />
        {CARE_BY_CONDITION_ENABLED && <ClinicalSupportEntry />}
      </section>
    </div>
  );
}
