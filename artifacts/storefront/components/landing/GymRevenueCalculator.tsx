"use client"; // Justification: interactive range slider state and revenue estimator recalculation.
import { useState } from "react";
import { formatPaise } from "@/lib/format";
import { GYM_CALCULATOR as C } from "@/content/landing/partners";
import { computeGymMonthlyEarnings } from "@/lib/partnerCalculator";
import { emitLpEvent } from "@/lib/lpEvents";

export function GymRevenueCalculator() {
  const [members, setMembers] = useState<number>(C.defaultMembers);
  const [tier, setTier] = useState<number>(C.tiers[0].pct);
  const monthlyPaise = computeGymMonthlyEarnings({
    members,
    adoptionRate: C.adoptionRate,
    planPricePaise: C.standardPlanRupees * 100,
    tierRate: tier / 100,
  });

  const handleMemberChange = (val: number) => {
    setMembers(val);
    emitLpEvent("calc_interact", { page: "/partners/gyms", members: val, tier });
  };

  return (
    <section id="calculator" className="py-12">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">Ancillary revenue calculator</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Estimate your recurring monthly payout based on subscriber volume.
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between text-sm">
          <label htmlFor="gym-members" className="font-medium text-ink">Active gym members</label>
          <span className="tabular font-semibold text-gold-text">{members} members</span>
        </div>
        <input
          id="gym-members"
          type="range"
          min={C.minMembers}
          max={C.maxMembers}
          step={C.stepMembers}
          value={members}
          onChange={(e) => handleMemberChange(Number(e.target.value))}
          className="mt-3 w-full accent-[var(--gold)]"
        />

        <div className="mt-6 flex items-center justify-between text-sm">
          <span className="font-medium text-ink">Commission tier</span>
          <span className="tabular font-semibold text-gold-text">{tier}%</span>
        </div>
        <div className="mt-3 flex gap-2">
          {C.tiers.map((t) => {
            const on = tier === t.pct;
            return (
              <button
                key={t.pct}
                type="button"
                onClick={() => { setTier(t.pct); emitLpEvent("calc_interact", { page: "/partners/gyms", members, tier: t.pct }); }}
                aria-pressed={on}
                className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                  on
                    ? "bg-gold text-[var(--gold-ink)]"
                    : "border border-line text-ink-muted hover:text-ink"
                }`}
              >
                {t.pct}% ({t.label})
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid items-center gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Estimated monthly earnings</p>
            <p className="tabular mt-1 text-3xl font-bold text-ink sm:text-4xl">{formatPaise(monthlyPaise)}</p>
          </div>
          <p className="text-xs leading-relaxed text-ink-faint">
            Assumes a conservative {Math.round(C.adoptionRate * 100)}% adoption rate among gym members
            on our standard 30-day ({formatPaise(C.standardPlanRupees * 100)}/mo) plan. Actual numbers
            vary with member profile.
          </p>
        </div>
      </div>
    </section>
  );
}
