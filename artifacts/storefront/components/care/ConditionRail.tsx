import Link from "next/link";
import { HorizontalSnapRail } from "@/components/primitives/HorizontalSnapRail";
import { CARE_CONDITIONS } from "@/lib/careConditions";

/** By-condition entry rail (D-05B). Every card routes straight to that
 *  condition's /care/[condition] page — a declared action, not a directory
 *  entry with nowhere to land. */
export function ConditionRail() {
  return (
    <HorizontalSnapRail title="By condition" layout="grid">
      {CARE_CONDITIONS.map((c) => (
        <Link
          key={c.slug}
          href={`/care/${c.slug}`}
          className="flex h-full items-center rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
        >
          <span className="text-sm font-semibold text-ink">{c.name}</span>
        </Link>
      ))}
    </HorizontalSnapRail>
  );
}
