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
  const handlePlanSelect = (tier: string) => {
    emitLpEvent("protocol_card_select", { tier, page: "/" });
  };

  return (
    <section id="protocols" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
          Revenue Stream 1 · D2C Therapeutic Subscriptions
        </span>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Not Just a Meal — A Protocol on a Plate.
        </h2>
        <p className="mt-3 text-sm text-ink-muted sm:text-base">
          FSSAI-certified therapeutic meal plans formulated for specific metabolic profiles & glycemic control.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        {/* Card 1: Weight-Loss Jumpstart */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Protocol 1 · Weight Loss
            </span>
            <h3 className="mt-2 text-xl font-bold text-ink">Weight-Loss Jumpstart</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Focus: Low-GI, sustainable fat loss without energy slumps. Formulated with complex fiber and high satiety index.
            </p>
            <div className="mt-6 border-y border-line py-4">
              <span className="tabular text-lg font-bold text-ink">1,500 kcal · 90g protein · 25g+ fiber</span>
              <p className="mt-1 text-xs text-ink-muted">Anti-inflammatory, glycemic-buffered</p>
            </div>
            <ul className="mt-6 flex flex-col gap-2.5 text-xs text-ink-muted">
              <li className="flex items-center gap-2">✓ 100% cold-pressed olive oil & desi ghee</li>
              <li className="flex items-center gap-2">✓ Zero refined sugars or artificial additives</li>
              <li className="flex items-center gap-2">✓ 1-click hybrid delivery routing (Home & Office)</li>
            </ul>
          </div>
          <Link
            href="/trial"
            onClick={() => handlePlanSelect("weight_loss_jumpstart")}
            className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-gold py-3.5 text-sm font-bold text-[var(--gold-ink)] transition-opacity hover:opacity-90 active:scale-95"
          >
            Start Your 3-Day Trial — ₹5,316
          </Link>
        </div>

        {/* Card 2: PCOS Hormone Balance */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-gold-text bg-surface p-6 shadow-md">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gold-text">
              Protocol 2 · Recommended Clinical Care
            </span>
            <h3 className="mt-2 text-xl font-bold text-ink">PCOS Hormone Balance</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Focus: Anti-inflammatory, manages insulin resistance and hormone spikes. Registered Dietitian approved profile.
            </p>
            <div className="mt-6 border-y border-line py-4">
              <span className="tabular text-lg font-bold text-ink">1,700 kcal · 100g protein</span>
              <p className="mt-1 text-xs text-ink-muted">Low-GI, hormone-friendly lipid profile</p>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink">
                Interactive Macro Spec:
              </p>
              <FlipCard />
            </div>
          </div>
          <Link
            href="/trial"
            onClick={() => handlePlanSelect("pcos_hormone_balance")}
            className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-gold py-3.5 text-sm font-bold text-[var(--gold-ink)] transition-opacity hover:opacity-90 active:scale-95"
          >
            Start Your 3-Day Trial — ₹5,316
          </Link>
        </div>

        {/* Card 3: Lean Muscle Builder */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface-raised p-6 shadow-sm">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Protocol 3 · Hypertrophy & Recovery
            </span>
            <h3 className="mt-2 text-xl font-bold text-ink">Lean Muscle Builder</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Focus: Recovery-focused calorie surplus for athletic performance, clean hypertrophy, and muscular endurance.
            </p>
            <div className="mt-6 border-y border-line py-4">
              <span className="tabular text-lg font-bold text-ink">2,400 kcal · 160g protein</span>
              <p className="mt-1 text-xs text-ink-muted">High biological-value protein density</p>
            </div>
            <ul className="mt-6 flex flex-col gap-2.5 text-xs text-ink-muted">
              <li className="flex items-center gap-2">✓ High amino-acid completeness</li>
              <li className="flex items-center gap-2">✓ Post-workout recovery macro windows</li>
              <li className="flex items-center gap-2">✓ Tailored for high-performance training</li>
            </ul>
          </div>
          <Link
            href="/trial"
            onClick={() => handlePlanSelect("lean_muscle_builder")}
            className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-gold py-3.5 text-sm font-bold text-[var(--gold-ink)] transition-opacity hover:opacity-90 active:scale-95"
          >
            Start Your 3-Day Trial — ₹5,316
          </Link>
        </div>
      </div>
    </section>
  );
}
