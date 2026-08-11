"use client";

import React from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatPaise } from "@/lib/format";
import { emitLpEvent } from "@/lib/lpEvents";
import { TRIAL_PRICE_PAISE } from "@/lib/trial";
import { computePlanQuote } from "@workspace/subscription-rules";
import { FlipCard } from "./FlipCard";

/**
 * §4: Protocols Tier Grid.
 * Displays D2C Therapeutic Subscriptions with canonical trial & monthly pricing.
 */
export function Section04ProtocolsGrid() {
  const trialPrice = formatPaise(TRIAL_PRICE_PAISE);
  const deskFuelMonthly = formatPaise(computePlanQuote("desk_fuel").cycleTotalPaise);
  const steadyMonthly = formatPaise(computePlanQuote("steady").cycleTotalPaise);
  const proteinMonthly = formatPaise(computePlanQuote("protein_build").cycleTotalPaise);

  const handlePlanSelect = (tier: string) => {
    emitLpEvent("protocol_card_select", { tier, page: "/" });
  };

  return (
    <section id="protocols" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
          Healthy Meal Subscriptions
        </span>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Meal Plans Designed for Real Results.
        </h2>
        <p className="mt-3 text-sm text-ink-muted sm:text-base">
          Choose a plan tailored to your health goals, whether it's sustainable weight loss, hormone balance, or building strength.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-semibold text-gold-text">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gold"></span>
          </span>
          Only 14 trial slots left this week
        </div>
      </div>

      {/* Two rules this grid used to break, both fixed in place:
       *
       * 1. ALL THREE plan CTAs are the same gold pill. Cards 1 and 3 carried
       *    `bg-ink … text-surface`, and inside the Stitch dark scope --ink is
       *    the bone ink — so the two NON-recommended plans rendered as near-
       *    WHITE buttons measuring 16.1:1 on the canvas against gold's 7.7:1,
       *    visually out-shouting the plan we recommend. Gold is the only action
       *    colour (CLAUDE.md's one surviving DS-0 caveat) and DESIGN.md §4
       *    sanctions gold-fill or hairline-ghost — a white fill is a third
       *    treatment nobody approved. Card 2 keeps its lead by the `border-2
       *    border-gold-text` frame, not by a different button colour. All three
       *    are spelled `bg-primary`/`text-primary-foreground`: --primary IS
       *    --gold (see globals.css §3.1), and one signal deserves one spelling.
       *
       * 2. The trial buttons hover on --surface-raised, not --surface-muted.
       *    There is no --surface-muted token anywhere — not tokens.css, not the
       *    Astryx bridge, not globals.css — so all three emitted no hover rule
       *    at all and sat inert next to CTAs that do respond. --surface-raised
       *    is the house hover for a bordered control on a card (AccountHub,
       *    BillingPanel, VoucherRedeem, …). */}
      <div className="mt-12 grid grid-flow-dense gap-8 lg:grid-cols-3">
        {/* Card 1: Weight-Loss Jumpstart */}
        <div className="group flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-sm overflow-hidden transition-transform duration-700 ease-out hover:scale-105 hover:shadow-xl hover:border-gold/30">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Plan 1 · Weight Loss
              </span>
              <span className="tabular text-xs font-bold text-ink-muted">{deskFuelMonthly}/mo</span>
            </div>
            <div className="mt-4 mb-2 aspect-[4/3] w-full overflow-hidden rounded-xl border border-line">
              <SafeImage
                src="https://picsum.photos/seed/weightloss/800/600"
                alt="Weight Loss Meal"
                className="w-full h-full object-cover mix-blend-luminosity opacity-90 transition-transform duration-700 ease-out group-hover:scale-105 group-hover:mix-blend-normal group-hover:opacity-100"
              />
            </div>
            <h3 className="mt-2 text-xl font-bold text-ink">Weight-Loss Jumpstart</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Focus: Shed weight without feeling tired. Keeps you full and energized all day.
            </p>
            <div className="mt-6 border-y border-line py-4">
              <span className="tabular text-lg font-bold text-ink">1,500 kcal · 90g protein · 25g+ fiber</span>
              <p className="mt-1 text-xs text-ink-muted">Keeps blood sugar steady</p>
            </div>
            <ul className="mt-6 flex flex-col gap-2.5 text-xs text-ink-muted">
              <li className="flex items-center gap-2">✓ 100% cold-pressed olive oil &amp; desi ghee</li>
              <li className="flex items-center gap-2">✓ Zero refined sugars or artificial additives</li>
              <li className="flex items-center gap-2">✓ 1-click hybrid delivery routing (Home &amp; Office)</li>
            </ul>
          </div>
          <div className="mt-8 flex flex-col gap-2">
            <Link
              href="/plan/desk_fuel"
              onClick={() => handlePlanSelect("weight_loss_jumpstart_plan")}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
            >
              View Subscription Options
            </Link>
            <Link
              href="/trial"
              onClick={() => handlePlanSelect("weight_loss_jumpstart")}
              className="inline-flex w-full items-center justify-center rounded-xl border border-line bg-surface py-3.5 text-sm font-bold text-ink transition-colors hover:bg-surface-raised active:scale-95"
            >
              Start 3-Day Trial — {trialPrice}
            </Link>
          </div>
        </div>

        {/* Card 2: PCOS Hormone Balance */}
        <div className="group flex flex-col justify-between rounded-2xl border-2 border-gold-text bg-surface p-6 shadow-md overflow-hidden transition-transform duration-700 ease-out hover:scale-105 hover:shadow-xl hover:border-gold/80">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gold-text">
                Plan 2 · Recommended Care
              </span>
              <span className="tabular text-xs font-bold text-ink">{steadyMonthly}/mo</span>
            </div>
            <div className="mt-4 mb-2 aspect-[4/3] w-full overflow-hidden rounded-xl border border-line">
              <SafeImage
                src="https://picsum.photos/seed/hormone/800/600"
                alt="Hormone Balance Meal"
                className="w-full h-full object-cover mix-blend-luminosity opacity-90 transition-transform duration-700 ease-out group-hover:scale-105 group-hover:mix-blend-normal group-hover:opacity-100"
              />
            </div>
            <h3 className="mt-2 text-xl font-bold text-ink">PCOS Hormone Balance</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Focus: Supports hormone balance and manages energy levels naturally. Approved by experts.
            </p>
            <div className="mt-6 border-y border-line py-4">
              <span className="tabular text-lg font-bold text-ink">1,700 kcal · 100g protein</span>
              <p className="mt-1 text-xs text-ink-muted">Healthy fats, slow-burning carbs</p>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink">
                Interactive Macro Spec:
              </p>
              <FlipCard />
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2">
            <Link
              href="/plan/steady"
              onClick={() => handlePlanSelect("pcos_hormone_balance_plan")}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
            >
              View Subscription Options
            </Link>
            <Link
              href="/trial"
              onClick={() => handlePlanSelect("pcos_hormone_balance")}
              className="inline-flex w-full items-center justify-center rounded-xl border border-gold bg-surface py-3.5 text-sm font-bold text-gold-text transition-colors hover:bg-surface-raised active:scale-95"
            >
              Start 3-Day Trial — {trialPrice}
            </Link>
          </div>
        </div>

        {/* Card 3: Lean Muscle Builder */}
        <div className="group flex flex-col justify-between rounded-2xl border border-line bg-surface-raised p-6 shadow-sm overflow-hidden transition-transform duration-700 ease-out hover:scale-105 hover:shadow-xl hover:border-gold/30">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Plan 3 · Strength &amp; Recovery
              </span>
              <span className="tabular text-xs font-bold text-ink-muted">{proteinMonthly}/mo</span>
            </div>
            <div className="mt-4 mb-2 aspect-[4/3] w-full overflow-hidden rounded-xl border border-line">
              <SafeImage
                src="https://picsum.photos/seed/muscle/800/600"
                alt="Muscle Building Meal"
                className="w-full h-full object-cover mix-blend-luminosity opacity-90 transition-transform duration-700 ease-out group-hover:scale-105 group-hover:mix-blend-normal group-hover:opacity-100"
              />
            </div>
            <h3 className="mt-2 text-xl font-bold text-ink">Lean Muscle Builder</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Focus: Fuel your workouts and recover faster with high-protein, energy-packed meals.
            </p>
            <div className="mt-6 border-y border-line py-4">
              <span className="tabular text-lg font-bold text-ink">2,400 kcal · 160g protein</span>
              <p className="mt-1 text-xs text-ink-muted">High-quality protein for muscle growth</p>
            </div>
            <ul className="mt-6 flex flex-col gap-2.5 text-xs text-ink-muted">
              <li className="flex items-center gap-2">✓ High amino-acid completeness</li>
              <li className="flex items-center gap-2">✓ Post-workout recovery macro windows</li>
              <li className="flex items-center gap-2">✓ Tailored for high-performance training</li>
            </ul>
          </div>
          <div className="mt-8 flex flex-col gap-2">
            <Link
              href="/plan/protein_build"
              onClick={() => handlePlanSelect("lean_muscle_builder_plan")}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
            >
              View Subscription Options
            </Link>
            {/* Rests on --surface like cards 1 and 2's trial button, not on
                --surface-raised: this card's own fill IS --surface-raised, so a
                raised button on a raised card had nowhere left to hover to. */}
            <Link
              href="/trial"
              onClick={() => handlePlanSelect("lean_muscle_builder")}
              className="inline-flex w-full items-center justify-center rounded-xl border border-line bg-surface py-3.5 text-sm font-bold text-ink transition-colors hover:bg-surface-raised active:scale-95"
            >
              Start 3-Day Trial — {trialPrice}
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 border-t border-line pt-8">
        <div className="flex flex-col items-center text-center p-4 bg-surface rounded-xl border border-line">
          <span className="text-lg font-bold text-ink">Don't go it alone.</span>
          <p className="mt-1 text-xs text-ink-muted max-w-sm">
            Join an upcoming RD-led <Link href="/challenges" className="font-bold text-gold-text underline">Community Challenge</Link> for real-time accountability and group support.
          </p>
        </div>
        <div className="flex flex-col items-center text-center p-4 bg-surface rounded-xl border border-line">
          <span className="text-lg font-bold text-ink">Need something specific?</span>
          <p className="mt-1 text-xs text-ink-muted max-w-sm">
            Customize your macros, calorie targets, and dietary preferences in our <Link href="/custom-build" className="font-bold text-gold-text underline">Custom Plan Builder</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
