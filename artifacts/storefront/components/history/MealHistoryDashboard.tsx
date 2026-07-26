"use client";
// Client: interactive macro history dashboard aggregating consumed daily nutrition vs target ceilings.
import { useState, useEffect } from "react";
import Link from "next/link";
import { getMyNutritionHistory, type NutritionHistorySummary } from "@/lib/ecosystemApi";

export function MealHistoryDashboard() {
  const [data, setData] = useState<NutritionHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyNutritionHistory()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        setError("Please sign in to inspect your verified macro adherence logs.");
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-center text-xs font-semibold text-ink-muted">Aggregating nutrition history…</div>;
  if (error || !data) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center flex flex-col gap-3 shadow-sm">
        <p className="text-sm font-medium text-ink">{error ?? "No nutritional history records located yet."}</p>
        <Link href="/menu" className="mt-2 mx-auto rounded-xl bg-gold px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-gold/90 transition-colors">
          Explore Therapeutic Menu &rarr;
        </Link>
      </div>
    );
  }

  const { logs, targets } = data;
  const totalKcal = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const totalProt = logs.reduce((s, l) => s + (l.proteinGrams || 0), 0);
  const totalFiber = logs.reduce((s, l) => s + (l.fiberGrams || 0), 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Calorie Adherence", val: `${totalKcal} kcal`, target: `Target: ${targets.calorieTarget || 2000}/day` },
          { label: "Protein Volume", val: `${totalProt}g`, target: `Target: ${targets.proteinTargetGrams || 80}g/day` },
          { label: "Prebiotic Fiber", val: `${totalFiber}g`, target: `Target: ${targets.fiberTargetGrams || 28}g/day` },
        ].map((m, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{m.label}</span>
            <span className="text-2xl font-bold text-ink">{m.val}</span>
            <span className="text-xs font-semibold text-gold-text">{m.target}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col gap-4">
        <h3 className="text-base font-semibold text-ink">Recent Verified Meal Intake Logs</h3>
        {logs.length === 0 ? (
          <p className="text-xs text-ink-muted leading-relaxed">
            No automated delivery order syncs or manual entries recorded in the last 30 days.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-line p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-ink">{log.label}</span>
                  <div className="text-[11px] text-ink-muted mt-0.5">Logged for: {log.loggedFor}</div>
                </div>
                <div className="font-semibold text-ink text-right">
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
