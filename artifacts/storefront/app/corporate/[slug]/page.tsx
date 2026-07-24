import type { Metadata } from "next";
import { CompanyLanding } from "@/components/corporate/CompanyLanding";

export const metadata: Metadata = {
  title: "Company workspace",
  robots: { index: false },
};

/** corporate/[slug] (route-parity Wave E). The member workspace — accept-invite
 *  redirect target + lunch-planner back-link. Personal/company, so noindex. */
export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <section className="mx-auto max-w-lg px-4 py-10">
      <CompanyLanding slug={slug} />
    </section>
  );
}
