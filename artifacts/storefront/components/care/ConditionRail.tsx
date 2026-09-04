import Link from "next/link";
import { CardSection } from "@/components/primitives/CardSection";
import { CARE_CONDITIONS } from "@/lib/careConditions";

/** By-condition entry rail (D-05B). Every card routes straight to that
 *  condition's /care/[condition] page — a declared action, not a directory
 *  entry with nowhere to land. */
export function ConditionRail() {
  return (
    <CardSection title="By condition" layout="grid">
      {CARE_CONDITIONS.map((c) => (
        <Link
          key={c.slug}
          href={`/care/${c.slug}`}
          className="flex h-full min-h-[72px] items-center rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong active:scale-[0.98]"
        >
          <span className="font-display text-lg font-semibold leading-tight text-primary">{c.name}</span>
        </Link>
      ))}
    </CardSection>
  );
}
