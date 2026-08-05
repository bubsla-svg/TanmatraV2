import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { planDisplay } from "@/lib/plans";
import type { PlanId } from "@workspace/subscription-rules";
import PlanConfigClient from "./PlanConfigClient";

export const metadata: Metadata = {
  title: "Subscription Setup | Tanmatra",
};

export default async function PlanConfigPage({ params }: { params: Promise<{ planId: string }> }) {
  const resolvedParams = await params;
  
  // Safe cast since we validate via the fallback. If invalid, plan will be undefined.
  const plan = planDisplay(resolvedParams.planId as PlanId);
  
  if (!plan) {
    return notFound();
  }

  return <PlanConfigClient plan={plan} />;
}
