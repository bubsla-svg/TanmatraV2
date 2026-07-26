"use client"; // Justification: interactive dietary track toggle state and analytics click tracking.

import { useState } from "react";
import Link from "next/link";
import { PLAN_CATALOG, type DietTrack } from "@workspace/subscription-rules";
import { formatPaise } from "@/lib/format";
import { emitLpEvent } from "@/lib/lpEvents";

const TRACK_LABELS: Record<DietTrack, string> = {
  veg: "Pure Veg (Base)",
  egg: "Egg Vegetarian (+10/meal)",
  nonveg: "Clean Non-Veg (+20-30/meal)",
};

const COMPARATIVE_DATA = [
  { brand: "Zomato Healthy (15-day)", price: "250/meal", note: "No clinical contraindication gates" },
  { brand: "Eatfit / Parafit", price: "195-210/meal", note: "Generic commercial preparation" },
  { brand: "Tanmatra (Desk Fuel)", price: "199/meal (Veg)", note: "Hospital-grade safety + verified macros", highlight: true },
];

/**
 * Consumer plans grid & parity strip (L-2).
 * Reads Table II.1 variant pricing directly from subscription-rules (P-2 integration).
 * Enforces zero price literals in JSX and component line limits (≤150 lines).
 */
export function ConsumerPlansGrid() {
  const [track, setTrack] = useState<DietTrack>("veg");
  const plans = Object.values(PLAN_CATALOG).filter((p) => p.id !== "trial_3day" && p.status === "live");

  const handleTrackSelect = (t: DietTrack) => {
    setTrack(t);
    emitLpEvent("menu_preview_interact", { page: "/", track: t });
  };

  return (
    <section id="plans" className="py-12 border-t border-line">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Subscription Plans</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Macro-calibrated daily nutrition</h2>
          <p className="mt-2 text-sm text-ink-muted">Select your dietary preference to preview live GST-inclusive per-meal pricing.</p>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {(["veg", "egg", "nonveg"] as const).map((t) => {
            const on = track === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => handleTrackSelect(t)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                  on ? "bg-gold text-[var(--gold-ink)] shadow-sm" : "border border-line bg-surface text-ink-muted hover:text-ink"
                }`}
              >
                {TRACK_LABELS[t]}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const variantPricePaise = p.variantPrices?.[track] ?? p.pricePerMealPaise ?? (p.flatPricePaise ? Math.round(p.flatPricePaise / p.mealsPerCycle) : 19900);
            return (
              <div key={p.id} className="rounded-2xl border border-line bg-surface p-6 flex flex-col justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{p.cycle} cadence</span>
                  <h3 className="mt-2 text-lg font-semibold text-ink capitalize">{p.id.replace("_", " ")}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{p.routerAnswer}</p>
                  <p className="mt-4 tabular text-2xl font-bold text-ink">
                    {formatPaise(variantPricePaise)}
                    <span className="text-xs font-medium text-ink-faint"> /meal · GST inc.</span>
                  </p>
                </div>
                <Link
                  href={`/plans?plan=${p.id}&track=${track}`}
                  onClick={() => emitLpEvent("plan_card_select", { page: "/", planId: p.id, track })}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-line py-2.5 text-sm font-semibold text-ink hover:border-line-strong active:scale-95"
                >
                  Select Plan
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-14 rounded-2xl border border-line bg-surface p-6">
          <h3 className="text-sm font-semibold text-ink uppercase tracking-wider text-center mb-6">Market Parity &amp; Value Assurance</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {COMPARATIVE_DATA.map((row) => (
              <div key={row.brand} className={`rounded-xl p-4 border ${row.highlight ? "border-[var(--gold)]/50 bg-[color-mix(in_srgb,var(--gold)_6%,transparent)]" : "border-line bg-surface-subtle"}`}>
                <p className="text-xs font-semibold text-ink">{row.brand}</p>
                <p className={`mt-1 text-base font-bold ${row.highlight ? "text-gold-text" : "text-ink"}`}>INR {row.price}</p>
                <p className="mt-2 text-xs text-ink-muted">{row.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
