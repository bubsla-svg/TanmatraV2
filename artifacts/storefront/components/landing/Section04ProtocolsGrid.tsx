"use client"; // Interactive protocol selection and waitlist tabs

import React from "react";
import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { emitLpEvent } from "@/lib/lpEvents";
import { PLAN_PRICE_TABLE } from "@workspace/subscription-rules";
import { FlipCard } from "./FlipCard";
import { WaitlistForm } from "./WaitlistForm";

/**
 * §4: Protocols Tier Grid.
 * Displays Wellness, Performance, and Clinical tiers, incorporating SpecSheetCard/FlipCard
 * and WaitlistForm for gated clinical plans (Steady and GLP-1). Strictly ≤ 150 lines.
 */
export function Section04ProtocolsGrid() {
  const deskFuelPrice = formatPaise(PLAN_PRICE_TABLE.desk_fuel.veg.perMealPaise!);
  const proteinPrice = formatPaise(PLAN_PRICE_TABLE.protein_build.veg.perMealPaise!);
  const steadyPrice = formatPaise(PLAN_PRICE_TABLE.steady.nonveg.perMealPaise!);
  const glp1Price = formatPaise(PLAN_PRICE_TABLE.glp1_companion.regular.monthlyTotalPaise!);

  const handlePlanSelect = (tier: string) => {
    emitLpEvent("protocol_card_select", { tier, page: "/" });
  };

  return (
    <section id="protocols" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Targeted Cadences
        </span>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-4xl">
          Three Tiers of Precision Metabolic Care
        </h2>
        <p className="mt-3 text-sm text-ink-muted sm:text-base">
          From daily workday endurance to lab-monitored therapeutic nutrition protocols.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        {/* Tier 1: Wellness (Desk Fuel) */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Tier 1 · Wellness Cadence
            </span>
            <h3 className="mt-2 text-xl font-bold text-ink">Desk Fuel Protocol</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Engineered for steady cognitive focus and stable post-meal glucose during office work hours. Zero lethargy, verified macros.
            </p>
            <div className="mt-6 border-y border-line py-4">
              <span className="tabular text-3xl font-extrabold text-ink">{deskFuelPrice}</span>
              <span className="text-xs font-medium text-ink-muted"> /meal · GST inclusive</span>
            </div>
            <ul className="mt-6 flex flex-col gap-2.5 text-xs text-ink-muted">
              <li className="flex items-center gap-2">✓ 22 scheduled hot desk lunches per cycle</li>
              <li className="flex items-center gap-2">✓ 100% cold-pressed olive oil &amp; desi ghee</li>
              <li className="flex items-center gap-2">✓ Flexible evening pause/resume before 9:00 PM</li>
            </ul>
          </div>
          <Link
            href="/plans?plan=desk_fuel&track=veg"
            onClick={() => handlePlanSelect("desk_fuel")}
            className="mt-8 inline-flex w-full items-center justify-center rounded-xl border border-line py-3 text-sm font-semibold text-ink transition-colors hover:border-line-strong active:scale-95"
          >
            Configure Desk Fuel
          </Link>
        </div>

        {/* Tier 2: Performance (Protein Build + FlipCard Demo) */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-line-strong bg-surface p-6 shadow-md">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gold-text">
              Tier 2 · Performance Recovery
            </span>
            <h3 className="mt-2 text-xl font-bold text-ink">Protein Build Track</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              High biological-value protein density (~38g verified) formulated for active training recovery and lean hypertrophy.
            </p>
            <div className="mt-6 border-y border-line py-4">
              <span className="tabular text-3xl font-extrabold text-ink">{proteinPrice}</span>
              <span className="text-xs font-medium text-ink-muted"> /meal · GST inclusive</span>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink">
                Interactive Spec Preview:
              </p>
              <FlipCard />
            </div>
          </div>
          <Link
            href="/plans?plan=protein_build&track=veg"
            onClick={() => handlePlanSelect("protein_build")}
            className="mt-8 inline-flex w-full items-center justify-center rounded-xl border border-line py-3 text-sm font-semibold text-ink transition-colors hover:border-line-strong active:scale-95"
          >
            Select Protein Build
          </Link>
        </div>

        {/* Tier 3: Clinical (Steady & GLP-1 Companion + WaitlistForm) */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface-raised p-6 shadow-sm">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink">
              Tier 3 · Medical Protocols (Gated)
            </span>
            <h3 className="mt-2 text-xl font-bold text-ink">Steady &amp; GLP-1 Care</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Therapeutic nutritional interventions for Type 2 Diabetes, PCOS, CKD, cardiac recovery, and active GLP-1 treatment support.
            </p>
            <div className="mt-6 border-y border-line py-4 text-xs font-semibold text-ink">
              <p className="tabular">Steady Track: From {steadyPrice}/meal</p>
              <p className="mt-1 tabular">GLP-1 Companion: {glp1Price}/mo</p>
            </div>
            <div className="mt-6">
              <WaitlistForm
                defaultTier="steady"
                source="web:/protocols-grid"
                submitLabel="Request Clinical Access"
              />
            </div>
          </div>
          <p className="mt-4 text-[11px] font-medium text-ink-faint text-center">
            Requires initial clinical screening or verified physician recommendation.
          </p>
        </div>
      </div>
    </section>
  );
}
