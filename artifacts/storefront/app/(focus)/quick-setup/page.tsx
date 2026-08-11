import type { Metadata } from "next";
import { Suspense } from "react";
import { QuickSetupWizard } from "@/components/wizard/QuickSetupWizard";

export const metadata: Metadata = {
  title: "Quick Dietary Setup | Tanmatra",
  description: "Answer 3 quick questions about your goal, dietary style and allergens — we'll route you straight to your plan.",
};

export default function QuickSetupPage() {
  return (
    <div className="min-h-dvh">
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

        <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
          <QuickSetupWizard />
        </Suspense>
      </section>
    </div>
  );
}
