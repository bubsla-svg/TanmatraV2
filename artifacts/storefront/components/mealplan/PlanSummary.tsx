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
        <p className="font-display text-xl font-semibold leading-tight text-primary">Week of {formatPlanDay(plan.weekStartDate)}</p>
        <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-accent">
          {plan.model ? "AI plan" : "Plan"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat label="Total" value={t ? formatPaise(t.totalPaise) : "—"} />
        <Stat label="Kcal / day" value={t ? String(t.avgCalories) : "—"} />
        <Stat label="Protein / day" value={t ? `${t.avgProteinGrams}g` : "—"} />
      </div>
      {targets.length > 0 && <p className="font-data mt-3 text-xs text-ink-muted">{targets.join(" · ")}</p>}
      {c.allergens.length > 0 && <p className="mt-2 text-xs leading-relaxed text-ink-faint">Avoiding: {c.allergens.join(", ")}</p>}
      {accepted && (
        <p className="mt-3 rounded-2xl bg-sage-soft px-4 py-3 text-xs font-medium leading-relaxed text-sage-text">
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
      <p className="font-data text-lg font-bold text-primary">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">{label}</p>
    </div>
  );
}
