import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PLAN_CHECKOUT_ENABLED } from "@/lib/flags";
import { planLandingHref } from "@/lib/planLanding";
import { PLAN_CATALOG, planIsSelfServiceLaunchable, type PlanId, type DietTrack } from "@workspace/subscription-rules";
import { planDisplay, planQuoteView, bookingBlock, getPlanBuilderData } from "@/lib/plans";
import { PlanBuilder } from "@/components/plans/PlanBuilder";
import { Waitlist } from "@/components/plans/Waitlist";
import { FocusHeader } from "@/components/FocusHeader";

type Props = {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ waitlist?: string } & Record<string, string | undefined>>;
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
  const { waitlist, ...rest } = await searchParams;
  const id = asPlanId(planId);
  if (!id) notFound();

  // T1: the builder's only exit is the subscription checkout, which is dark.
  // Land on the goal-filtered menu instead, carrying the acquisition context
  // the wizard attached. An explicit ?waitlist=1 is still lead capture, so it
  // keeps rendering.
  if (!PLAN_CHECKOUT_ENABLED && waitlist !== "1") {
    redirect(planLandingHref(id, rest));
  }

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
