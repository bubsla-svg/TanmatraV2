"use client";
// Client: interactive macro history dashboard aggregating consumed daily nutrition vs target ceilings.
import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import { getMyNutritionHistory, type NutritionHistorySummary } from "@/lib/ecosystemApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

export function MealHistoryDashboard() {
  const [data, setData] = useState<NutritionHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyNutritionHistory();
      setData(res);
      setNeedsAuth(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else setError(e instanceof ApiError ? e.message : "Couldn't load your nutrition history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to inspect your verified macro adherence logs.</p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-xs font-semibold text-ink-muted">Aggregating nutrition history…</div>;
  if (error || !data) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center flex flex-col gap-3">
        <p className="text-sm font-medium text-ink">{error ?? "No nutritional history records located yet."}</p>
        <Link href="/menu" className="mt-2 mx-auto rounded-xl bg-gold px-6 py-2.5 text-xs font-semibold text-[var(--gold-ink)] hover:bg-gold/90 transition-colors">
          Explore Therapeutic Menu →
        </Link>
      </div>
    );
  }

  const { logs, targets } = data;
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
          <p className="p-5 text-xs leading-relaxed text-ink-muted sm:p-6">
            No automated delivery order syncs or manual entries recorded in the last 30 days.
          </p>
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
