"use client"; // Justification: interactive range slider state and revenue estimator recalculation.
import { useState } from "react";
import { formatPaise } from "@/lib/format";
import { GYM_CALCULATOR as C } from "@/content/landing/partners";
import { computeGymMonthlyEarnings } from "@/lib/partnerCalculator";
import { emitLpEvent } from "@/lib/lpEvents";

/**
 * Ancillary-revenue ESTIMATOR for `/partners/gyms` (Stitch brief 17 — same rules
 * as the corporate estimator in brief 14). Every figure derives from
 * `computeGymMonthlyEarnings` over GYM_CALCULATOR's published assumptions; the
 * adoption rate and plan price are disclosed on the surface, and the total is
 * labelled an estimate so it can never read as a payout statement.
 */
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
    <section id="calculator" className="py-[var(--space-section)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Revenue model</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Ancillary revenue calculator</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
        Estimate your recurring monthly payout based on subscriber volume.
      </p>

      <div className="mt-8 flex flex-col gap-8 rounded-3xl border border-line bg-surface p-6">
        <div>
          <label
            htmlFor="gym-members"
            className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-ink-faint"
          >
            Active gym members
            <span className="tabular text-base font-semibold text-ink">{members}</span>
          </label>
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
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Commission tier</p>
          <div className="mt-4 -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {C.tiers.map((t) => {
              const on = tier === t.pct;
              return (
                <button
                  key={t.pct}
                  type="button"
                  onClick={() => {
                    setTier(t.pct);
                    emitLpEvent("calc_interact", { page: "/partners/gyms", members, tier: t.pct });
                  }}
                  aria-pressed={on}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                    on
                      ? "border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] text-gold-text"
                      : "border-line text-ink-muted hover:border-line-strong"
                  }`}
                >
                  <span className="tabular">{t.pct}%</span> · {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-6">
          <div className="flex items-end justify-between gap-4">
            <p className="text-base text-ink">
              Monthly payout
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
                Estimate only
              </span>
            </p>
            <span className="tabular text-2xl font-semibold tracking-tight text-gold-text">
              {formatPaise(monthlyPaise)}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Assumes a conservative {Math.round(C.adoptionRate * 100)}% adoption rate among gym members on
            our standard 30-day ({formatPaise(C.standardPlanRupees * 100)}/mo) plan. Actual numbers vary
            with member profile.
          </p>
        </div>
      </div>
    </section>
  );
}
