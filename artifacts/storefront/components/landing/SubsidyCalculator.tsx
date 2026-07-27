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

export function SubsidyCalculator() {
  const [modelId, setModelId] = useState<SubsidyModel["id"]>("full");
  const [teamSize, setTeamSize] = useState<number>(40);
  const model = SUBSIDY_MODELS.find((m) => m.id === modelId) ?? SUBSIDY_MODELS[0]!;
  const monthlyPaise = teamSize * perEmployeePaise(model, teamSize);

  const handleTeamSizeChange = (val: number) => {
    setTeamSize(val);
    emitLpEvent("calc_interact", { page: "/corporate-wellness", seats: val, model: modelId });
  };


  return (
    <section className="py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Subsidy models</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Pick a model, see the number</h2>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {SUBSIDY_MODELS.map((m) => {
          const on = m.id === modelId;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => setModelId(m.id)}
              className={`rounded-2xl border bg-surface p-5 text-left transition-colors ${
                on ? "border-[var(--gold)]" : "border-line hover:border-line-strong"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">{m.name}</h3>
                {on && (
                  <span className="rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--gold-ink)]">
                    Selected
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{m.desc}</p>
              <p className="tabular mt-2 text-sm font-bold text-gold-text">
                {formatPaise(perEmployeePaise(m, teamSize))}
                <span className="text-[10px] font-medium text-ink-faint"> /employee/month</span>
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--gold)]/40 bg-[color-mix(in_srgb,var(--gold)_5%,transparent)] p-6">
        <h3 className="text-base font-semibold text-ink">Your Monthly Estimate & Health Insurance ROI</h3>
        <div className="mt-5 grid items-center gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="corp-team-size" className="flex items-center justify-between text-xs font-semibold text-ink-muted">
              Team size
              <span className="tabular text-base font-bold text-ink">{teamSize} employees</span>
            </label>
            <input
              id="corp-team-size"
              type="range"
              min={5}
              max={500}
              step={5}
              value={teamSize}
              onChange={(e) => handleTeamSizeChange(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--gold)]"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              {model.mealsPerMonth} macro-perfect lunches per employee per month
            </p>

            <div className="mt-4 rounded-xl border border-line bg-surface p-3 text-xs">
              <span className="font-bold text-sage-text">Projected Insurance & Absenteeism Savings:</span>
              <ul className="mt-1 flex flex-col gap-1 text-[11px] text-ink-muted">
                <li>• Estimated Premium Savings: ₹{Math.round(teamSize * 1800).toLocaleString("en-IN")}/yr</li>
                <li>• Afternoon Productivity Gained: ~{Math.round(teamSize * 3.2)} hours/month</li>
              </ul>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 text-center md:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
              {model.name} · {teamSize} people
            </p>
            <p className="tabular mt-1 text-3xl font-bold text-ink sm:text-4xl">
              {formatPaise(monthlyPaise)}
              <span className="text-xs font-medium text-ink-faint"> /month</span>
            </p>
            <p className="tabular mt-1 text-[11px] text-ink-muted">
              {formatPaise(perEmployeePaise(model, teamSize))} per employee · GST included
            </p>
            <a
              href="#pilot-form"
              className="mt-4 inline-block w-full rounded-xl bg-gold px-4 py-2.5 text-xs font-bold text-[var(--gold-ink)] text-center shadow-xs hover:opacity-90"
            >
              Book a Free 50-Person Pilot Drop &rarr;
            </a>
          </div>
        </div>

        {/* Cafeteria Wallet & API Integration Badge */}
        <div className="mt-6 border-t border-line/60 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 text-gold-text font-bold text-sm">
              ⚡
            </div>
            <div>
              <p className="text-xs font-semibold text-ink">Tanmatra Cafeteria Wallet & SSO API Sync</p>
              <p className="text-[11px] text-ink-faint">Direct integration with corporate health allowances & ID badge scanners in Noida IT parks.</p>
            </div>
          </div>
          <span className="rounded-md border border-line px-2.5 py-1 text-[10px] font-mono text-ink-muted">
            OAuth2 / OpenID API
          </span>
        </div>
      </div>
    </section>
  );
}
