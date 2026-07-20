import { useMemo } from "react";
import { Link } from "react-router";
import { useMenuCatalog } from "@/lib/menuData";
import type {
  SubscriptionDelivery,
  SubscriptionMember,
} from "@/lib/subscriptionsApi";

// Ring gauges for the plan detail header: this week's average kcal/day and
// protein/day across UPCOMING deliveries, resolved to dish macros via the
// same catalog SwapDialog uses, compared against the member's stored targets.
//
// Honesty rules:
// - No target set -> "Set your goal to see this" empty state, never a
//   fabricated target.
// - A dish slug that can't be resolved in the catalog is EXCLUDED from the
//   average (not treated as 0 kcal); if nothing resolves, show the empty
//   state rather than a fake 0.

function Ring({
  pct,
  color,
  value,
  unit,
}: {
  pct: number; // 0..1, already clamped
  color: string;
  value: number;
  unit: string;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 64, height: 64, flex: "none" }}>
      <svg width={64} height={64} viewBox="0 0 64 64" role="presentation">
        <circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          stroke="var(--s3)"
          strokeWidth={6}
        />
        <circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="tnm-data" style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(value)}
        </span>
        <span className="lab" style={{ fontSize: 8 }}>{unit}</span>
      </div>
    </div>
  );
}

function GaugeCard({
  title,
  avg,
  target,
  unit,
}: {
  title: string;
  avg: number;
  target: number;
  unit: string;
}) {
  const over = avg > target;
  const color = over ? "var(--tnm-caution)" : "var(--sage)";
  return (
    <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 f1">
      <div className="lab">{title}</div>
      <div className="fx ac gap12 mt8">
        <Ring pct={Math.min(1, avg / target)} color={color} value={avg} unit={unit} />
        <div style={{ minWidth: 0 }}>
          <div className="fine tnm-data" style={{ fontVariantNumeric: "tabular-nums" }}>
            Target {Math.round(target)} {unit}/day
          </div>
          {/* Icon + text, never color alone */}
          <div className="fine mt4 fx ac g6" style={{ color }}>
            <i className={`ph-bold ${over ? "ph-warning-circle" : "ph-check-circle"}`} />
            {over ? "Over target" : "Within target"}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyGauge({ title }: { title: string }) {
  return (
    <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 f1">
      <div className="lab">{title}</div>
      <div className="fine mt8" style={{ color: "var(--mut)" }}>
        <Link to="/preferences" style={{ color: "var(--safb)" }}>
          Set your goal
        </Link>{" "}
        to see this.
      </div>
    </div>
  );
}

export function PlanNutritionGauges({
  members,
  deliveries,
}: {
  members: SubscriptionMember[];
  deliveries: SubscriptionDelivery[];
}) {
  const { dishes } = useMenuCatalog();
  const bySlug = useMemo(() => new Map(dishes.map((d) => [d.slug, d])), [dishes]);

  // First member with any target set — never invent one for the rest.
  const target = members.find(
    (m) => m.dailyCalorieTarget != null || m.dailyProteinTargetGrams != null,
  );

  const averages = useMemo(() => {
    const upcoming = deliveries.filter((d) => d.status === "upcoming");
    let days = 0;
    let kcal = 0;
    let protein = 0;
    for (const d of upcoming) {
      let dayKcal = 0;
      let dayProtein = 0;
      let resolvedAny = false;
      for (const item of d.items) {
        const dish = bySlug.get(item.slug);
        // Unresolvable slug: exclude it rather than counting it as 0 kcal.
        if (!dish) continue;
        resolvedAny = true;
        dayKcal += dish.macros.calories * item.quantity;
        dayProtein += dish.macros.protein * item.quantity;
      }
      if (!resolvedAny) continue;
      days += 1;
      kcal += dayKcal;
      protein += dayProtein;
    }
    if (days === 0) return null;
    return { kcalPerDay: kcal / days, proteinPerDay: protein / days };
  }, [deliveries, bySlug]);

  return (
    <div className="fx gap12 mt12">
      {target?.dailyCalorieTarget != null && averages ? (
        <GaugeCard
          title="Avg calories / day"
          avg={averages.kcalPerDay}
          target={target.dailyCalorieTarget}
          unit="kcal"
        />
      ) : (
        <EmptyGauge title="Avg calories / day" />
      )}
      {target?.dailyProteinTargetGrams != null && averages ? (
        <GaugeCard
          title="Avg protein / day"
          avg={averages.proteinPerDay}
          target={target.dailyProteinTargetGrams}
          unit="g"
        />
      ) : (
        <EmptyGauge title="Avg protein / day" />
      )}
    </div>
  );
}
