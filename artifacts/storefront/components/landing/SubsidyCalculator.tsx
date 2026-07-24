"use client";
// Client island: the corporate subsidy ESTIMATOR. Every figure derives from
// PER_MEAL_PAISE × GST_RATE (imported live) — no price is hardcoded, and this is
// an estimate, not a quote (the form returns real pilot pricing). Pick a model,
// drag the team size, read the monthly number.
import { useState } from "react";
import { PER_MEAL_PAISE, GST_RATE } from "@workspace/subscription-rules";
import { formatPaise } from "@/lib/format";
import { SUBSIDY_MODELS, type SubsidyModel } from "@/content/landing/corporate";

/** GST-inclusive monthly employer cost for ONE employee under a model. */
function perEmployeePaise(m: SubsidyModel): number {
  return Math.round(m.mealsPerMonth * PER_MEAL_PAISE * m.companyShare * (1 + GST_RATE));
}

export function SubsidyCalculator() {
  const [modelId, setModelId] = useState<SubsidyModel["id"]>("full");
  const [teamSize, setTeamSize] = useState<number>(40);
  const model = SUBSIDY_MODELS.find((m) => m.id === modelId) ?? SUBSIDY_MODELS[0]!;
  const monthlyPaise = teamSize * perEmployeePaise(model);

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
                {formatPaise(perEmployeePaise(m))}
                <span className="text-[10px] font-medium text-ink-faint"> /employee/month</span>
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--gold)]/40 bg-[color-mix(in_srgb,var(--gold)_5%,transparent)] p-6">
        <h3 className="text-base font-semibold text-ink">Your monthly estimate</h3>
        <div className="mt-5 grid items-center gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="corp-team-size" className="flex items-center justify-between text-xs font-semibold text-ink-muted">
              Team size
              <span className="tabular text-base font-bold text-ink">{teamSize}</span>
            </label>
            <input
              id="corp-team-size"
              type="range"
              min={5}
              max={500}
              step={5}
              value={teamSize}
              onChange={(e) => setTeamSize(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--gold)]"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              {model.mealsPerMonth} lunches per employee per month
            </p>
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
              {formatPaise(perEmployeePaise(model))} per employee · GST included
            </p>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
          Estimated at the list rate of {formatPaise(PER_MEAL_PAISE)} per meal + {Math.round(GST_RATE * 100)}% GST.
          Pilot pricing is customised to team size and park — the form below gets you the real number.
        </p>
      </div>
    </section>
  );
}
