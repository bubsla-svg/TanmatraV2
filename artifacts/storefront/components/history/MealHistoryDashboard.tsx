"use client";
// Client: interactive macro history dashboard aggregating consumed daily nutrition vs target ceilings.
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { getMyNutritionHistory } from "@/lib/ecosystemApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Button } from "@/components/ui/button";

const isAuthError = (e: unknown) => e instanceof ApiError && e.status === 401;

export function MealHistoryDashboard() {
  const historyQuery = useQuery({ queryKey: ["wellness", "history"], queryFn: () => getMyNutritionHistory() });

  if (isAuthError(historyQuery.error)) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to inspect your verified macro adherence logs.</p>
        <PhoneAuth startExpanded onVerified={() => void historyQuery.refetch()} />
      </div>
    );
  }

  if (historyQuery.isPending) return <MealHistorySkeleton />;

  if (historyQuery.isError) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center flex flex-col gap-3">
        <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load your nutrition history</p>
        <p className="mx-auto max-w-xs text-xs leading-relaxed text-ink-faint">
          {historyQuery.error instanceof ApiError ? historyQuery.error.message : "Something went wrong on our end — this usually clears up on retry."}
        </p>
        <button type="button" onClick={() => void historyQuery.refetch()} className="mx-auto mt-1 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-opacity hover:opacity-80">Try again</button>
      </div>
    );
  }

  const { logs, targets } = historyQuery.data;
  const totalKcal = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const totalProt = logs.reduce((s, l) => s + (l.proteinGrams || 0), 0);
  const totalFiber = logs.reduce((s, l) => s + (l.fiberGrams || 0), 0);

  const metrics = [
    { label: "Calorie Adherence", val: `${totalKcal} kcal`, target: `Target: ${targets.calorieTarget}/day` },
    { label: "Protein Volume", val: `${totalProt}g`, target: `Target: ${targets.proteinTargetGrams}g/day` },
    { label: "Prebiotic Fiber", val: `${totalFiber}g`, target: `Target: ${targets.fiberTargetGrams}g/day` },
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* Headline metric tiles — the answer to "am I on track", given real visual weight. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{m.label}</span>
            <div className="tabular mt-3 text-3xl font-bold text-ink sm:text-4xl">{m.val}</div>
            <div className="mt-2 text-xs font-semibold text-gold-text">{m.target}</div>
          </div>
        ))}
      </div>

      {/* Supporting detail — visually quieter than the tiles above: one flat card,
          hairline dividers between rows instead of a box-per-row treatment. */}
      <div className="rounded-2xl border border-line bg-surface">
        <div className="border-b border-line p-5 sm:p-6">
          <h3 className="text-base font-semibold text-ink">Recent Verified Meal Intake Logs</h3>
        </div>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-5 text-center sm:p-6">
            <p className="text-xs leading-relaxed text-ink-muted">
              No automated delivery order syncs or manual entries recorded in the last 30 days.
            </p>
            <Button asChild shape="xl" size="fluid" className="px-6 py-2.5 text-xs font-semibold">
              <Link href="/menu">Explore Therapeutic Menu →</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-1.5 border-b border-line p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-6"
              >
                <div>
                  <span className="text-sm font-medium text-ink">{log.label}</span>
                  <div className="mt-0.5 text-xs text-ink-muted">Logged for: {log.loggedFor}</div>
                </div>
                <div className="tabular text-xs font-semibold text-ink sm:text-right">
                  <span>{log.calories ?? 0} kcal</span> &bull; <span>{log.proteinGrams ?? 0}g Prot</span> &bull; <span>{log.fiberGrams ?? 0}g Fiber</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MealHistorySkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <p className="sr-only">Aggregating nutrition history…</p>
      <div aria-hidden className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-raised" />
        ))}
      </div>
      <div aria-hidden className="h-40 animate-pulse rounded-2xl bg-surface-raised" />
    </div>
  );
}
