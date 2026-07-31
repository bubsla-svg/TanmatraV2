import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchMenu } from "@/lib/catalog";
import { QuickSetupWizard } from "@/components/wizard/QuickSetupWizard";

export const metadata: Metadata = {
  title: "Quick Dietary Setup | Tanmatra",
  description: "Answer 3 quick questions about your goal, allergens and dietary style — see matching dishes instantly, and save your allergen exclusions to your account.",
};

export default async function QuickSetupPage() {
  const { dishes } = await fetchMenu();

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
            Tell us your goal, allergens and dietary style — we&rsquo;ll match you to dishes on the menu
            right away, and save your allergens to your account so the kitchen knows to omit them.
          </p>
        </div>

        <Suspense fallback={<p className="text-sm text-ink-muted">Loading clinical menu capabilities…</p>}>
          <QuickSetupWizard dishes={dishes} />
        </Suspense>
      </section>
    </div>
  );
}
