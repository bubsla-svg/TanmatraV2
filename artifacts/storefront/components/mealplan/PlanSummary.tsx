import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { formatPlanDay, type MealPlan, type AcceptResult } from "@/lib/mealPlanApi";

/** The week header — totals ribbon, targets, allergens, and (post-accept) the
 *  scheduling confirmation. All numbers are the server's; display only. */
export function PlanSummary({ plan, accepted }: { plan: MealPlan; accepted: AcceptResult | null }) {
  const t = plan.totals;
  const c = plan.constraints;
  const targets: string[] = [];
  if (c.weeklyBudgetPaise != null) targets.push(`Budget ${formatPaise(c.weeklyBudgetPaise)}`);
  if (c.dailyCalorieTarget != null) targets.push(`${c.dailyCalorieTarget} kcal/day`);
  if (c.dailyProteinTargetGrams != null) targets.push(`${c.dailyProteinTargetGrams}g protein/day`);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Week of {formatPlanDay(plan.weekStartDate)}</p>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] px-2.5 py-0.5 text-[11px] font-medium text-gold-text">
          {plan.model ? "AI plan" : "Plan"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat label="Total" value={t ? formatPaise(t.totalPaise) : "—"} />
        <Stat label="Kcal / day" value={t ? String(t.avgCalories) : "—"} />
        <Stat label="Protein / day" value={t ? `${t.avgProteinGrams}g` : "—"} />
      </div>
      {targets.length > 0 && <p className="mt-3 text-xs text-ink-muted">{targets.join(" · ")}</p>}
      {c.allergens.length > 0 && <p className="mt-2 text-xs text-ink-faint">Avoiding: {c.allergens.join(", ")}</p>}
      {accepted && (
        <p className="mt-3 rounded-lg bg-sage-soft px-3 py-2 text-xs font-medium text-sage-text">
          {accepted.deliveryIds.length > 0
            ? `Accepted — ${accepted.deliveryIds.length} deliveries scheduled on your weekly plan.`
            : "Accepted. Start a weekly subscription to schedule these as deliveries."}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="tabular text-lg font-bold text-ink">{value}</p>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}
