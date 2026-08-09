import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PLAN_CATALOG, planIsSelfServiceLaunchable, type PlanId, type DietTrack } from "@workspace/subscription-rules";
import { planDisplay, planQuoteView, bookingBlock, getPlanBuilderData } from "@/lib/plans";
import { PlanBuilder } from "@/components/plans/PlanBuilder";
import { Waitlist } from "@/components/plans/Waitlist";
import { FocusHeader } from "@/components/FocusHeader";

type Props = {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ waitlist?: string }>;
};

function asPlanId(v: string): PlanId | null {
  return v in PLAN_CATALOG ? (v as PlanId) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { planId } = await params;
  const id = asPlanId(planId);
  return { title: id ? planDisplay(id).name : "Plan not found" };
}

/**
 * Plan builder host (server). Routes a blocked plan (or an explicit ?waitlist=1)
 * to waitlist capture, and a launchable one to the builder — the zero-dead-end
 * guarantee lives here, not in the client.
 */
export default async function PlanPage({ params, searchParams }: Props) {
  const { planId } = await params;
  const { waitlist } = await searchParams;
  const id = asPlanId(planId);
  if (!id) notFound();

  const q = planQuoteView(id);
  const defaultTrack: DietTrack = q.servedTracks[0] ?? "veg";
  const blocked = !planIsSelfServiceLaunchable(id) || waitlist === "1";

  const builderData = getPlanBuilderData(id);
  const planName = planDisplay(id).name;

  return (
    <div className="min-h-dvh">
      <section className="mx-auto max-w-xl px-4 pt-6 pb-32">
        <FocusHeader
          title={planName}
          backLabel="Back to plans"
          trustSignal={blocked ? undefined : "Configure your plan"}
        />
        {blocked ? (
          <Waitlist
            planId={id}
            planName={planDisplay(id).name}
            reason={bookingBlock(id, defaultTrack) ?? "it isn't open for self-serve booking yet"}
          />
        ) : (
          <PlanBuilder planId={id} defaultTrack={defaultTrack} builderData={builderData} />
        )}
      </section>
    </div>
  );
}
