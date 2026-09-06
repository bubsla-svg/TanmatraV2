import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AssessmentEntryCard } from "@/components/care/AssessmentEntryCard";
import { conditionDisplayName } from "@/lib/conditionDisplay";
import { isCareConditionKnown } from "@/lib/careConditions";

type Props = {
  params: Promise<{ condition: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { condition } = await params;
  const name = conditionDisplayName(condition);
  const known = isCareConditionKnown(condition);
  // De-indexed with the by-condition surface (consumer copy deck): the route
  // still resolves for anyone holding the URL, but it is unlinked from nav and
  // the sitemap and must not be indexed while the claim behind it is
  // unreviewed. Restored by the same decision that flips
  // CARE_BY_CONDITION_ENABLED.
  return {
    title: known ? `${name} Therapeutic Care Plan` : `${name}`,
    robots: { index: false, follow: false },
  };
}

export default async function CareConditionPage({ params }: Props) {
  const { condition } = await params;
  const name = conditionDisplayName(condition);
  const known = isCareConditionKnown(condition);

  return (
    <div
      data-ui-generation="stitch-74"
      data-screen-id="11.4"
      data-screen-state="default"
      className="min-h-dvh pb-24"
    >
      <section className="mx-auto max-w-xl px-4 py-12">
        <Link href="/care" className="text-xs font-semibold text-primary hover:underline">
          &larr; Back to Care Directory
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">
          {name}{known ? " Protocol" : ""}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {known
            ? `RD-crafted therapeutic meal plan designed specifically for ${name} management.`
            : `We don't yet have a dedicated protocol for ${name} — browse the Care Directory for a condition we support, or tell us more about what you're looking for.`}
        </p>

        {/* D-21/D-23: assessment before commerce — progressive disclosure. */}
        <div className="mt-6">
          <AssessmentEntryCard condition={condition} />
        </div>

        {known ? (
          <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
            <h2 className="font-display text-lg font-semibold leading-tight text-primary">Clinical Objectives</h2>
            <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-ink-muted">
              <li>• Tailored glycemic &amp; sodium thresholds</li>
              <li>• Zero ultra-processed additives or hidden sugars</li>
              <li>• Biweekly RD consultation &amp; WhatsApp progress tuning</li>
            </ul>

            <div className="mt-6 flex flex-col gap-3">
              <Link href="/plans">
                <Button type="button" shape="pill" size="fluid" className="w-full text-sm font-semibold">
                  Explore Matching Plans
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
            <p className="text-xs leading-relaxed text-ink-muted">
              Every Tanmatra plan is reviewed by a registered dietitian and adapts to your
              dietary preferences and restrictions — explore our plans or browse the Care
              Directory to find the closest fit.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Link href="/plans">
                <Button type="button" shape="pill" size="fluid" className="w-full text-sm font-semibold">
                  Explore Plans
                </Button>
              </Link>
              <Link href="/care">
                <Button type="button" variant="outline" shape="pill" size="fluid" className="w-full text-sm font-semibold">
                  Browse Care Directory
                </Button>
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
