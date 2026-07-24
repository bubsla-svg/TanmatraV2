import type { Metadata } from "next";
import { LunchPlanner } from "@/components/corporate/LunchPlanner";

export const metadata: Metadata = {
  title: "Lunch planner",
  robots: { index: false },
};

/** corporate/[slug]/lunch-planner (route-parity Wave E, admin). Team diet profile
 *  → generated weekly plan → schedule. Admin-gated inside the island; noindex. */
export default async function LunchPlannerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <section className="mx-auto max-w-xl px-4 py-10">
      <LunchPlanner slug={slug} />
    </section>
  );
}
