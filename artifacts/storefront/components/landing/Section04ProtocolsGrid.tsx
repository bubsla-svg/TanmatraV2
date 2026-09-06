"use client";

import React from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatPaise } from "@/lib/format";
import { emitLpEvent } from "@/lib/lpEvents";
import type { PlanCardDish, PlanDishMap } from "@/lib/planCardDish";
import { planDisplay } from "@/lib/planCopy";
import { computePlanQuote } from "@workspace/subscription-rules";

/**
 * A plan card's photo, or nothing at all.
 *
 * `dish === null` renders NO element — deliberately, not as an oversight.
 * These three frames held random-image-API placeholders captioned as our own
 * meals; the replacement (lib/planCardDish.ts) resolves a dish the plan
 * actually rotates, and when it cannot, the honest output is an absent photo
 * rather than a stand-in. Sized by the frame per SafeImage's contract, so the
 * box is reserved before the image decodes and the card never reflows.
 */
function PlanPhotoFrame({ dish }: { dish: PlanCardDish | null | undefined }) {
  if (!dish) return null;
  return (
    <SafeImage
      src={dish.image}
      alt={dish.name}
      className="mt-4 mb-2 aspect-[4/3] w-full rounded-xl border border-line"
      // The photo is the appetite: it renders in full colour. It used to
      // carry `mix-blend-luminosity opacity-90`, greying the food until
      // hover, on the one surface whose job is to make lunch look good.
      // (Those classes also sat on the FRAME, not the <img> — SafeImage owns
      // the img via imgClassName — so the zoom scaled the box, not the photo.)
      imgClassName="transition-transform duration-700 ease-out group-hover:scale-105"
    />
  );
}

/**
 * §4: Plans grid — the three monthly plans, with canonical trial & monthly pricing.
 *
 * `dishes` is resolved server-side by the page (this is a client component, so
 * it cannot read the catalog itself) from the same `fetchMenu()` call the
 * homepage already makes — no extra round-trip.
 */
export function Section04ProtocolsGrid({ dishes }: { dishes: PlanDishMap }) {
  // The plan's ONE name, from lib/planCopy.ts. These three cards used to
  // invent their own — "Weight-Loss Jumpstart", "PCOS Hormone Balance",
  // "Lean Muscle Builder" — so a buyer who picked one by name landed on a
  // page titled something else ("Desk Fuel", "Steady", "Protein Build") with
  // no explanation, at the exact step where they were deciding to pay. The
  // goal framing those names carried survives in each card's kicker.
  const deskFuel = planDisplay("desk_fuel");
  const steady = planDisplay("steady");
  const proteinBuild = planDisplay("protein_build");
  const deskFuelMonthly = formatPaise(computePlanQuote("desk_fuel").cycleTotalPaise);
  const steadyMonthly = formatPaise(computePlanQuote("steady").cycleTotalPaise);
  const proteinMonthly = formatPaise(computePlanQuote("protein_build").cycleTotalPaise);

  const handlePlanSelect = (tier: string) => {
    emitLpEvent("protocol_card_select", { tier, page: "/" });
  };

  return (
    <section id="protocols" className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
      <div className="mb-9 max-w-3xl animate-rise-in">
        <span className="text-[11px] font-bold uppercase tracking-[.2em] text-accent">
          Every weekday
        </span>
        <h2 className="mt-3 font-display text-4xl font-semibold leading-none text-primary sm:text-5xl">
          Pick a plan, we cook the rest.
        </h2>
        <p className="mt-5 max-w-md text-base leading-7 text-ink-muted">
          22 weekday lunches a month. Skip or swap any of them up to a day before.
        </p>
        {/* No scarcity badge here. This slot held "Only 14 trial slots left this
            week" as a hardcoded string with no capacity source behind it — a
            claim we cannot keep, on a page that also claims ISO 22000 and
            dietitian supervision. Restoring it requires a real remaining-
            capacity signal from the API, not a second literal; and the copy
            has to degrade gracefully when capacity is plentiful, because a
            badge reading "412 slots left" sells nothing. */}
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
      <div className="grid grid-flow-dense gap-5 lg:grid-cols-3">
        {/* Card 1: Desk Fuel */}
        <div className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-secondary p-7 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-raised)]">
          <div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[.18em] text-accent">
                Plan 1 · Weight Loss
              </span>
              <span className="font-data text-2xl font-bold text-primary">{deskFuelMonthly}<span className="font-sans text-xs font-normal text-ink-muted">/mo</span></span>
            </div>
            <PlanPhotoFrame dish={dishes.desk_fuel} />
            <h3 className="mt-3 font-display text-4xl font-semibold text-primary">{deskFuel.name}</h3>
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              Filling and light, so there&rsquo;s no 4 pm slump.
            </p>
            {/* Real plan copy, not invented specs. This block held
                "1,500 kcal · 90g protein · 25g+ fiber" and two similar
                lines on the other cards. PLAN_CATALOG carries no macro
                targets — no calorie, protein or fibre figure exists for
                any plan — so those numbers had no source, and the plan
                page they link to shows nothing like them. Under the
                correct plan name they would read as verified plan specs,
                which is the more dangerous version of the same bug. */}
            <div className="mt-6 border-t border-primary/15 pt-5">
              <span className="text-sm font-semibold text-primary">{deskFuel.promise}</span>
              <p className="mt-1 text-xs text-ink-muted">{deskFuel.subtitle}</p>
            </div>
            <ul className="mt-6 flex flex-col gap-2.5 text-sm leading-5 text-ink-muted">
              <li className="flex items-center gap-2">✓ Cold-pressed oils and desi ghee</li>
              <li className="flex items-center gap-2">✓ No refined sugar or artificial additives</li>
              <li className="flex items-center gap-2">✓ Deliver to home or office, your choice</li>
            </ul>
          </div>
          {/* T-22: ONE door per card. The per-card "Start 3-Day Trial" made the
              trial pitch four times on one page; the hero and the START HERE
              band above already carry it. */}
          <div className="mt-7 flex flex-col gap-2">
            <Link
              href="/plan/desk_fuel"
              onClick={() => handlePlanSelect("weight_loss_jumpstart_plan")}
              className="flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
            >
              See plan
            </Link>
          </div>
        </div>

        {/* Card 2: Steady */}
        <div className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-primary/30 bg-surface p-7 shadow-[var(--shadow-card)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-raised)] lg:-translate-y-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[.18em] text-accent">
                Plan 2 · Recommended Care
              </span>
              <span className="font-data text-2xl font-bold text-primary">{steadyMonthly}<span className="font-sans text-xs font-normal text-ink-muted">/mo</span></span>
            </div>
            <PlanPhotoFrame dish={dishes.steady} />
            <h3 className="mt-3 font-display text-4xl font-semibold text-primary">{steady.name}</h3>
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              Low-GI plates and no refined sugar, for steady energy.
            </p>
            <div className="mt-6 border-t border-primary/15 pt-5">
              <span className="text-sm font-semibold text-primary">{steady.promise}</span>
              <p className="mt-1 text-xs text-ink-muted">{steady.subtitle}</p>
            </div>
          </div>
          <div className="mt-7 flex flex-col gap-2">
            <Link
              href="/plan/steady"
              onClick={() => handlePlanSelect("pcos_hormone_balance_plan")}
              className="flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
            >
              See plan
            </Link>
          </div>
        </div>

        {/* Card 3: Protein Build */}
        <div className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface-raised p-7 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-raised)]">
          <div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[.18em] text-accent">
                Plan 3 · Strength &amp; Recovery
              </span>
              <span className="font-data text-2xl font-bold text-primary">{proteinMonthly}<span className="font-sans text-xs font-normal text-ink-muted">/mo</span></span>
            </div>
            <PlanPhotoFrame dish={dishes.protein_build} />
            <h3 className="mt-3 font-display text-4xl font-semibold text-primary">{proteinBuild.name}</h3>
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              More protein on every plate, built for training days.
            </p>
            <div className="mt-6 border-t border-primary/15 pt-5">
              <span className="text-sm font-semibold text-primary">{proteinBuild.promise}</span>
              <p className="mt-1 text-xs text-ink-muted">{proteinBuild.subtitle}</p>
            </div>
            <ul className="mt-6 flex flex-col gap-2.5 text-sm leading-5 text-ink-muted">
              <li className="flex items-center gap-2">✓ Complete proteins on every plate</li>
              <li className="flex items-center gap-2">✓ Bigger portions on training days</li>
              <li className="flex items-center gap-2">✓ Swap in extra protein any day</li>
            </ul>
          </div>
          <div className="mt-7 flex flex-col gap-2">
            <Link
              href="/plan/protein_build"
              onClick={() => handlePlanSelect("lean_muscle_builder_plan")}
              className="flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
            >
              See plan
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-line pt-8">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <span className="font-display text-xl text-primary">Need something specific?</span>
          <p className="mt-2 max-w-sm text-sm leading-5 text-ink-muted">
            Set your own calories, protein and preferences in the <Link href="/custom-build" className="touch-target-min font-bold text-gold-text underline">plan builder</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
