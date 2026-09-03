"use client";
// Client: a two-state price comparison the customer drives. The prices
// themselves are server-quoted and passed in; nothing here computes money.

import { useState } from "react";
import Link from "next/link";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/format";
import { emitFunnel } from "@/lib/funnel";
import { registersAutopayMandate } from "@/lib/planDecisionFacts";
import type { DishPlanOffer } from "@/lib/dishPlanOffer";

const CYCLE_NOUN: Record<string, string> = {
  weekly: "week",
  fortnightly: "fortnight",
  monthly: "month",
  quarterly: "quarter",
  one_off: "one-off",
};

/**
 * One-time or on a plan, for a dish that a bookable plan actually rotates
 * (plan item 1.1).
 *
 * WHAT THIS DOES NOT DO, deliberately: it does not become a second money CTA.
 * The dish page's own doc comment records that the Astryx template's "Buy it
 * now" was dropped because "this funnel's canonical path is add → cart drawer
 * → checkout; a second money CTA here would fork it". That reasoning did not
 * stop being true. The sticky ledger remains the one-time buy; this block is
 * where the plan alternative is stated and entered.
 *
 * WHAT IT REFUSES TO CLAIM: a saving that does not exist. `dishPlanOffer`
 * returns `savingPaise: null` whenever the plan's per-delivery price is equal
 * to or higher than the dish's own — true for 27 of the 56 dishes a live plan
 * carries. In that case the plan side states its real price and says what the
 * plan is FOR (the rotation, the cutoff, no lock-in) instead of inventing a
 * discount. Plan item 1.1 assumed "per-delivery savings" always exist; on this
 * catalog they do not, and the honest version is the one that survives someone
 * doing the arithmetic.
 */
export function DishPlanToggle({
  offer,
  dishSlug,
  dishPricePaise,
}: {
  offer: DishPlanOffer;
  dishSlug: string;
  /** The dish's own à-la-carte price, as the server sent it. */
  dishPricePaise: number;
}) {
  const [mode, setMode] = useState<"one_time" | "plan">("one_time");
  const period = CYCLE_NOUN[offer.cycle] ?? offer.cycle;
  const autopay = registersAutopayMandate(offer.cycle);

  function choose(next: "one_time" | "plan") {
    if (next === mode) return;
    setMode(next);
    emitFunnel("plan_toggle", { dish_id: dishSlug, mode: next, plan_id: offer.planId });
  }

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4" aria-label="How to buy this dish">
      <div role="group" aria-label="Buying option" className="inline-flex gap-1 self-start rounded-full border border-line bg-bg p-1">
        {([["one_time", "One-time"], ["plan", "On a plan"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => choose(id)}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors active:scale-[0.98] ${
              mode === id ? "bg-gold text-[var(--gold-ink)]" : "text-ink-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "one_time" ? (
        <div className="flex flex-col gap-1">
          <Text type="body" weight="bold" hasTabularNumbers>
            {formatPaise(dishPricePaise)}
          </Text>
          <Text type="supporting" color="secondary">
            This dish, once. Add it below.
          </Text>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Text type="body" weight="bold" hasTabularNumbers>
            {formatPaise(offer.perDeliveryPaise)} per delivery
          </Text>
          <Text type="supporting" color="secondary">
            On {offer.planName} — {offer.mealsPerCycle} meals a {period},{" "}
            {formatPaise(offer.cycleTotalPaise)} a {period}.
          </Text>
          {offer.savingPaise != null ? (
            <Text type="supporting" color="secondary">
              {formatPaise(offer.savingPaise)} less per delivery than buying this dish on its own.
            </Text>
          ) : (
            // No discount to claim. Say what the plan is actually for.
            <Text type="supporting" color="secondary">
              Not cheaper than this dish on its own — a plan is for the whole
              rotation arriving without re-ordering, and you can skip or swap any
              delivery.
            </Text>
          )}
          <Text type="supporting" color="secondary">
            {autopay
              ? // "every month" would be specific and false for the monthly plan —
                // its billed cycle is the 6-week protocol (see planDecisionFacts's
                // renewPeriod note). Same rule, same word.
                `Renews every ${offer.cycle === "monthly" ? "cycle" : period} by UPI Autopay, with a notification before each charge. Cancel any time.`
              : `Paid once for this ${period}. Nothing renews automatically and no recurring charge is set up.`}
          </Text>
          <Button
            asChild
            shape="pill"
            size="fluid"
            className="mt-1 min-h-11 px-6 py-3 font-semibold"
          >
            <Link
              href={`/plan/${offer.planId}`}
              onClick={() =>
                emitFunnel("subscribe_cta_click", { dish_id: dishSlug, plan_id: offer.planId })
              }
            >
              See {offer.planName}
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
