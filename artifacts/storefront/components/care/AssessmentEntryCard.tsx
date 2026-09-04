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
      className="flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong active:scale-[0.98]"
    >
      <span className="font-display text-lg font-semibold leading-tight text-primary">Find my starting point</span>
      <ArrowRight size={18} className="shrink-0 text-primary" aria-hidden />
    </Link>
  );
}
