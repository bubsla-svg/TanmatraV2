import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Assessment entry point (D-21/D-23, D-05B — shared by /care/[condition] and
 * /care). Progressive disclosure per the ruling: the assessment is offered
 * before commerce (plan exploration), never after. `condition` threads
 * straight into the D-04B quick-setup exit-routing contract.
 */
export function AssessmentEntryCard({ condition }: { condition?: string }) {
  const href = condition ? `/quick-setup?condition=${encodeURIComponent(condition)}` : "/quick-setup";
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong"
    >
      <span className="text-sm font-semibold text-ink">Find my starting point</span>
      <ArrowRight size={18} className="shrink-0 text-gold-text" aria-hidden />
    </Link>
  );
}
