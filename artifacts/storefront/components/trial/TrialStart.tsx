"use client";
// Client: one axis (veg/nonveg) and a Start that routes into the same Breeze
// checkout as a plan. The trio itself is fixed — the toggle only swaps which
// track's three dishes are shown, never lets the buyer compose their own.

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { emitFunnel } from "@/lib/funnel";
import { formatMacroLine, formatPaise } from "@/lib/format";
import { PLAN_DELIVERY_DAYS_SENTENCE, PLAN_DELIVERY_WINDOW_LABEL } from "@/lib/planCheckout";
import { TRIAL_COPY } from "@/lib/trial";

export interface TrioDish {
  slug: string;
  name: string;
  image: string;
  /** Law 8 — the trio is the highest-intent dish moment in this funnel and it
   *  carried a name and a photo only, on a product whose whole claim is that
   *  the numbers are known. Absent when the catalog has none to give, never
   *  filled in. */
  macros?: { calories: number; protein: number };
  macrosEstimated?: boolean;
}

type TrialTrack = "veg" | "nonveg";
const TRACKS: { id: TrialTrack; label: string }[] = [
  { id: "veg", label: "Veg" },
  { id: "nonveg", label: "Non-veg" },
];

/**
 * The 3-Day Taste Test starter (02b). The trio is pre-decided (02e §3.5) — this
 * only picks the track and hands off to checkout with the trial plan. The trial
 * price is spine-quoted and passed in; this component never states an amount of
 * its own. Start emits the same `cuj_checkout_start` a plan does — the trial is
 * a checkout, not a separate funnel.
 */
export function TrialStart({
  trios,
  pricePaise,
}: {
  trios: Record<TrialTrack, TrioDish[]>;
  pricePaise: number;
}) {
  const router = useRouter();
  const [track, setTrack] = useState<TrialTrack>("veg");
  const trio = trios[track];

  function start() {
    emitFunnel("cuj_checkout_start", { planId: "trial_3day", track });
    router.push(`/checkout?plan=trial_3day&track=${track}`);
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Start the 3-day taste test">
      <div className="flex flex-col items-center gap-2">
        <p
          id="trial-pref-label"
          className="text-xs font-semibold uppercase tracking-wide text-ink-faint"
        >
          Preference
        </p>
        <div
          role="group"
          aria-labelledby="trial-pref-label"
          className="inline-flex gap-1 rounded-full border border-line bg-surface p-1"
        >
          {TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={track === t.id}
              onClick={() => setTrack(t.id)}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors active:scale-[0.98] ${
                track === t.id
                  ? "bg-gold text-[var(--gold-ink)]"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* The trio is the highest-intent moment for dish appeal in this funnel
          (BATCH-4-BRIEFS.md, Brief 23) — real catalogue photos, given room to
          read as food, not a strip of thumbnails. */}
      <ul className="grid grid-cols-3 gap-3">
        {trio.map((dish) => (
          <li
            key={dish.slug}
            className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-surface-raised">
              {/* `fill` inside the aspect-square box keeps CLS at zero. sizes:
                  the trio sits in /trial's max-w-md (28rem) px-4 column, three
                  columns with two 12px gaps — (448 − 32 − 24)/3 ≈ 131px once
                  the container is capped, and (100vw − 56px)/3 below that. */}
              <Image
                src={dish.image}
                alt=""
                fill
                sizes="(min-width: 28rem) 131px, calc((100vw - 3.5rem) / 3)"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2.5 text-center">
              <p className="text-xs font-semibold leading-snug text-ink">{dish.name}</p>
              {dish.macros && (
                <p className="tabular text-[0.6875rem] leading-tight text-ink-faint">
                  {formatMacroLine(dish.macros, dish.macrosEstimated)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Law 1: what arrives, and when, stated before the CTA rather than
          discovered after paying. Same constants the create call books the
          delivery with, so this cannot drift from what is actually scheduled. */}
      <p className="text-center text-xs text-ink-muted">
        Delivered {PLAN_DELIVERY_DAYS_SENTENCE}, {PLAN_DELIVERY_WINDOW_LABEL}.
      </p>

      {/* Glass sticky footer (checkout vocabulary, BATCH-4-BRIEFS.md) — the ONE
          money-bearing CTA on this screen, since starting the trial IS the
          commitment moment, same treatment as CheckoutPay's Pay button.
          Always rendered: /trial lives under app/(focus)/, and FocusLayout
          mounts no MiniCartBar to hand the bottom edge to (unlike the global
          shell DishBuyBar shares it with) — so there is nothing else that
          could ever occupy `bottom-16`, cart state or not. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:bottom-0">
        <div className="mx-auto max-w-md px-4 py-3">
          <Button
            type="button"
            onClick={start}
            shape="pill"
            size="fluid"
            className="w-full px-8 py-4 text-center text-base font-semibold"
          >
            Start the taste test · {formatPaise(pricePaise)}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-muted">{TRIAL_COPY.noAutoConvert}</p>
          {/* Kitchen-level trust, at the money moment (N5.10's counterpart on
              the trial surface). Same house copy as the checkout pay bars —
              licence-backed kitchen claims only, never per-dish RD badges (F5). */}
          <p className="mt-1 text-center text-2xs text-ink-faint">
            FSSAI-licensed, RD-reviewed kitchen · secure UPI checkout
          </p>
        </div>
      </div>
    </section>
  );
}
