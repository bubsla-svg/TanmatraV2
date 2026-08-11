import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Shared single-link entry card (D-05B) — the same visual pattern as
 *  AssessmentEntryCard, generalized for TherapeuticPlanRail, TrialEntryCard
 *  and ClinicalSupportEntry: one label, one route, a declared action. */
export function NavEntryCard({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
    >
      <span className="text-sm font-semibold text-ink">{label}</span>
      <ArrowRight size={18} className="shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}
