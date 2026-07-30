"use client"; // Justification: client-side team size range slider and interactive corporate subsidy computation.
import { useState } from "react";
import { PER_MEAL_PAISE, GST_RATE, computeCorporateTeamsQuote } from "@workspace/subscription-rules";
import { formatPaise } from "@/lib/format";
import { SUBSIDY_MODELS, type SubsidyModel } from "@/content/landing/corporate";
import { emitLpEvent } from "@/lib/lpEvents";

/** GST-inclusive monthly employer cost for ONE employee under a model. */
function perEmployeePaise(m: SubsidyModel, teamSize: number): number {
  if (teamSize >= 10) {
    try {
      const quote = computeCorporateTeamsQuote(teamSize, "veg", m.mealsPerMonth);
      return Math.round(quote.pricePerMealPaise * m.mealsPerMonth * m.companyShare);
    } catch {
      /* fall back to PER_MEAL_PAISE if computation fails */
    }
  }
  return Math.round(m.mealsPerMonth * PER_MEAL_PAISE * m.companyShare * (1 + GST_RATE));
}

/**
 * Subsidy ESTIMATOR for `/corporate-wellness` (Stitch brief 14).
 *
 * Every figure derives from the pricing spine (PER_MEAL_PAISE / GST_RATE via
 * computeCorporateTeamsQuote) — nothing here is a hardcoded amount. It is
 * deliberately styled as an estimate, not a checkout total: no order summary
 * chrome, the total is labelled "Estimate · GST included", and the only action
 * is a jump to the pilot form where a human quotes the real number.
 */
export function SubsidyCalculator() {
  const [modelId, setModelId] = useState<SubsidyModel["id"]>("full");
  const [teamSize, setTeamSize] = useState<number>(40);
  const model = SUBSIDY_MODELS.find((m) => m.id === modelId) ?? SUBSIDY_MODELS[0]!;
  const perEmployee = perEmployeePaise(model, teamSize);
  const monthlyPaise = teamSize * perEmployee;

  const handleTeamSizeChange = (val: number) => {
    setTeamSize(val);
    emitLpEvent("calc_interact", { page: "/corporate-wellness", seats: val, model: modelId });
  };

  return (
    <section className="py-[var(--space-section)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Subsidy models</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Pick a model, see the number</h2>

      <div className="mt-8 flex flex-col gap-8 rounded-3xl border border-line bg-surface p-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Funding model</p>
          <div className="mt-4 -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {SUBSIDY_MODELS.map((m) => {
              const on = m.id === modelId;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setModelId(m.id)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                    on
                      ? "border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] text-gold-text"
                      : "border-line text-ink-muted hover:border-line-strong"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">{model.desc}</p>
        </div>

        <div>
          <label
            htmlFor="corp-team-size"
            className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-ink-faint"
          >
            Team size
            <span className="tabular text-base font-semibold text-ink">{teamSize}</span>
          </label>
          <input
            id="corp-team-size"
            type="range"
            min={5}
            max={500}
            step={5}
            value={teamSize}
            onChange={(e) => handleTeamSizeChange(Number(e.target.value))}
            className="mt-3 w-full accent-[var(--gold)]"
          />
          <p className="mt-2 text-[11px] text-ink-faint">
            {model.mealsPerMonth} macro-balanced lunches per employee per month
          </p>
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-muted">Per employee / month</p>
            <span className="tabular text-sm text-ink">{formatPaise(perEmployee)}</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <p className="text-base text-ink">
              Monthly total
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
                Estimate · GST included
              </span>
            </p>
            <span className="tabular text-2xl font-semibold tracking-tight text-gold-text">
              {formatPaise(monthlyPaise)}
            </span>
          </div>
          <a
            href="#pilot-form"
            className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-gold px-8 py-4 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
          >
            Get pilot pricing for {teamSize} people
          </a>
        </div>
      </div>
    </section>
  );
}
