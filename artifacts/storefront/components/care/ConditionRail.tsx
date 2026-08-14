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
          className="flex h-full items-center rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong"
        >
          <span className="text-sm font-semibold text-ink">{c.name}</span>
        </Link>
      ))}
    </CardSection>
  );
}
