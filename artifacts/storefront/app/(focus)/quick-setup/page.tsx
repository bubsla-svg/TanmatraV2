import type { Metadata } from "next";
import { Suspense } from "react";
import { QuickSetupWizard } from "@/components/wizard/QuickSetupWizard";
import { FocusHeader } from "@/components/FocusHeader";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Quick Dietary Setup",
  description: "Answer 3 quick questions about your goal, dietary style and allergens — we'll route you straight to your plan.",
};

/**
 * Suspense fallback mirroring the wizard card's own geometry (the CLS
 * guardrail in components/ui/skeleton.tsx: reserve the REAL element's
 * dimensions) — container, stepper header, heading line, three squircle
 * option rows, and the CTA bar, matching QuickSetupWizard's rendered shell.
 * The wizard forces client-side render up to this boundary (it reads
 * useSearchParams), so this is what a customer actually sees first; the
 * previous fallback was a bare "Loading…" line that collapsed the layout.
 */
function WizardSkeleton() {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5 flex flex-col gap-6 shadow-sm">
      <p role="status" className="sr-only">
        Loading the dietary setup…
      </p>
      <div aria-hidden className="flex flex-col gap-4 border-b border-line pb-5">
        <Skeleton className="h-2 w-16 rounded-full" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
      </div>
      <div aria-hidden className="flex flex-col gap-3 pt-3 border-t border-line">
        <Skeleton className="h-11 rounded-full" />
        <Skeleton className="mx-auto h-3 w-48" />
      </div>
    </div>
  );
}

export default function QuickSetupPage() {
  return (
    <div className="min-h-dvh">
      <FocusHeader backLabel="Back" />
      <section className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-12">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
            Precision Personalization
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            3-Step Dietary Setup
          </h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            Tell us your goal, dietary style and allergens — we&rsquo;ll route you straight to the right
            plan, and save your allergens to your account so the kitchen knows to omit them.
          </p>
        </div>

        <Suspense fallback={<WizardSkeleton />}>
          <QuickSetupWizard />
        </Suspense>
      </section>
    </div>
  );
}
