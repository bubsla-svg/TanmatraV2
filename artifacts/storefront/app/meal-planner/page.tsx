import type { Metadata } from "next";
// Stitch dark scope (route-scoped) — see lib/themes/stitch.css.
import "@/lib/themes/stitch.css";
import { MealPlanner } from "@/components/mealplan/MealPlanner";

export const metadata: Metadata = {
  title: "Weekly meal planner",
  robots: { index: false },
};

/**
 * Weekly meal planner (route-parity Wave H). RSC shell; the island owns the
 * session-gated generate → swap → accept loop against /api/meal-plans. Personal
 * & authed, so noindex. No charge path — accepting assigns dishes to deliveries
 * already scheduled on an active weekly subscription.
 */
export default function MealPlannerPage() {
  return (
    <div data-stitch="dark" className="min-h-screen bg-[var(--bg)] text-ink">
      <section className="mx-auto max-w-lg px-4 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted">AI-personalised</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Weekly meal planner</h1>
        <p className="mt-2 mb-8 text-sm leading-relaxed text-ink-muted">
          A 7-day plan tuned to your goals, diet, allergens and budget. Swap dishes, then accept to
          schedule the week on your subscription.
        </p>
        <MealPlanner />
      </section>
    </div>
  );
}
