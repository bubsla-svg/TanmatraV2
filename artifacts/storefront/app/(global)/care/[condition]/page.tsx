import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AssessmentEntryCard } from "@/components/care/AssessmentEntryCard";
import { conditionDisplayName } from "@/lib/conditionDisplay";

type Props = {
  params: Promise<{ condition: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { condition } = await params;
  const name = conditionDisplayName(condition);
  return { title: `${name} Therapeutic Care Plan | Tanmatra` };
}

export default async function CareConditionPage({ params }: Props) {
  const { condition } = await params;
  const name = conditionDisplayName(condition);

  return (
    <div
      data-ui-generation="stitch-74"
      data-screen-id="11.4"
      data-screen-state="default"
      className="min-h-dvh pb-24"
    >
      <section className="mx-auto max-w-xl px-4 py-12">
        <Link href="/care" className="text-xs font-semibold text-gold-text hover:underline">
          &larr; Back to Care Directory
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
          {name} Protocol
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          RD-crafted therapeutic meal plan designed specifically for {name} management.
        </p>

        {/* D-21/D-23: assessment before commerce — progressive disclosure. */}
        <div className="mt-6">
          <AssessmentEntryCard condition={condition} />
        </div>

        <div className="mt-6 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-base font-semibold text-ink">Clinical Objectives</h2>
          <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-ink-muted">
            <li>• Tailored glycemic &amp; sodium thresholds</li>
            <li>• Zero ultra-processed additives or hidden sugars</li>
            <li>• Biweekly RD consultation &amp; WhatsApp progress tuning</li>
          </ul>

          <div className="mt-6 flex flex-col gap-3">
            <Link href="/plans">
              <Button type="button" shape="xl" size="fluid" className="w-full text-sm font-semibold">
                Explore Matching Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
