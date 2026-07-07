import { useMemo } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { wellnessApi, type WellnessWeekResponse } from "@/lib/wellnessApi";

export function WeeklySummaryCard() {
  const weekQ = useQuery({
    queryKey: ["wellness", "week"],
    queryFn: () => wellnessApi.week(),
    retry: false,
  });
  const week: WellnessWeekResponse | undefined = weekQ.data;

  const summary = useMemo(() => {
    if (!week) return null;
    const totals = week.days.reduce(
      (acc, d) => ({
        calories: acc.calories + d.calories,
        protein: acc.protein + d.proteinGrams,
        fiber: acc.fiber + d.fiberGrams,
        water: acc.water + d.waterMl,
      }),
      { calories: 0, protein: 0, fiber: 0, water: 0 },
    );
    const proteinHits = week.days.filter(
      (d) => d.proteinGrams >= week.targets.proteinTargetGrams,
    ).length;
    return { totals, proteinHits, days: week.days.length };
  }, [week]);

  if (!week || !summary || summary.totals.calories === 0) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="lab">Your week so far</div>
          <div className="text-lg font-semibold" style={{ color: "var(--tx)" }}>
            {summary.proteinHits}/{summary.days} protein-target days
          </div>
        </div>
        <Link
          to="/wellness"
          className="text-xs uppercase tracking-widest hover:underline"
          style={{ color: "var(--sage)" }}
        >
          Open dashboard
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <div className="font-semibold" style={{ color: "var(--tx)" }}>
            {Math.round(summary.totals.calories / Math.max(1, summary.days))}
          </div>
          <div className="lab" style={{ fontSize: 10 }}>avg kcal</div>
        </div>
        <div>
          <div className="font-semibold" style={{ color: "var(--tx)" }}>
            {Math.round(summary.totals.protein / Math.max(1, summary.days))}g
          </div>
          <div className="lab" style={{ fontSize: 10 }}>avg protein</div>
        </div>
        <div>
          <div className="font-semibold" style={{ color: "var(--tx)" }}>
            {Math.round(summary.totals.fiber / Math.max(1, summary.days))}g
          </div>
          <div className="lab" style={{ fontSize: 10 }}>avg fiber</div>
        </div>
        <div>
          <div className="font-semibold" style={{ color: "var(--tx)" }}>
            {Math.round(summary.totals.water / Math.max(1, summary.days))} ml
          </div>
          <div className="lab" style={{ fontSize: 10 }}>avg water</div>
        </div>
      </div>
    </div>
  );
}
