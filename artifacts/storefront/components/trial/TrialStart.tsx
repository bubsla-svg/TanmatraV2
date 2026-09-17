"use client";
// Client: one axis (veg/nonveg) and a Start that routes into the same Breeze
// checkout as a plan. The trio itself is fixed — the toggle only swaps which
// track's three dishes are shown, never lets the buyer compose their own.

import { useState } from "react";
import { DishImage } from "@/components/menu/DishImage";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StickyAction } from "@/components/primitives/StickyAction";
import { emitFunnel } from "@/lib/funnel";
import { formatMacroLine, formatPaise } from "@/lib/format";
import { PLAN_DELIVERY_DAYS_SENTENCE } from "@/lib/planCheckout";
import { TRIAL_COPY } from "@/lib/trial";
import type { TrialTrack, TrioDish } from "@/lib/trialTrio";
import { KitchenSafetyChip } from "@/components/trust/KitchenSafetySheet";
import { checkoutHref } from "@/lib/checkoutIntent";
import { PLAN_CHECKOUT_ENABLED } from "@/lib/flags";
import { useCart } from "@/components/cart/CartProvider";
import { trioTotalPaise, withTrioInCart } from "@/lib/trialBundle";

// The shape lives in lib/trialTrio.ts, where the resolver that BUILDS it also
// lives — /trial and the QR landing both render this trio, and a second local
// copy of the type is how the two surfaces start disagreeing about it.
export type { TrioDish } from "@/lib/trialTrio";

/** The à-la-carte promise, in place of the subscription one (T1): what is
 *  in the cart is three dishes at their menu price, and nothing recurs. */
export const TRIO_ORDER_COPY =
  "Three dishes at their menu price, in your cart. Order once — nothing renews.";

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
  const { cart, setCart } = useCart();
  const [track, setTrack] = useState<TrialTrack>("veg");
  const trio = trios[track];
  // T1: with plan checkout dark, the trio is three ordinary cart lines and the
  // price is the sum of their catalog prices — the server's figures, summed
  // for display. With the flag on, the spine's trial price is what is billed.
  const ctaPaise = PLAN_CHECKOUT_ENABLED ? pricePaise : trioTotalPaise(trio);

  function start() {
    if (!PLAN_CHECKOUT_ENABLED) {
      setCart(withTrioInCart(cart, trio));
      for (const d of trio) {
        emitFunnel("add_to_cart", { dish_id: d.slug, price_paise: d.pricePaise, source: "trial_trio" });
      }
      emitFunnel("begin_checkout", { source: "trial_trio", track });
      router.push(checkoutHref({ mode: "alacarte" }));
      return;
    }
    emitFunnel("cuj_checkout_start", { planId: "trial_3day", track });
    router.push(checkoutHref({ mode: "plan", planId: "trial_3day", track }));
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Start the trial">
      <div className="flex flex-col items-center gap-2">
        <p
          id="trial-pref-label"
          className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted"
        >
          Preference
        </p>
        <div
          role="group"
          aria-labelledby="trial-pref-label"
          className="flex flex-wrap justify-center gap-2"
        >
          {TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={track === t.id}
              onClick={() => setTrack(t.id)}
              className={`inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-medium transition-colors active:scale-[0.98] ${
                track === t.id
                  ? "border-gold bg-primary/10 text-primary"
                  : "border-transparent bg-secondary text-ink-muted hover:text-ink"
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
            {/* DishImage, not a bare next/image (audit 2026-09-17): two trio
                dishes had no -800 derivative in the photo library and rendered
                as broken images. The branded tile is the honest fallback. sizes:
                the trio sits in /trial's max-w-md (28rem) px-4 column, three
                columns with two 12px gaps — (448 − 32 − 24)/3 ≈ 131px once the
                container is capped, and (100vw − 56px)/3 below that. */}
            <DishImage
              src={dish.image}
              name={dish.name}
              className="aspect-square w-full bg-surface-raised"
              sizes="(min-width: 28rem) 131px, calc((100vw - 3.5rem) / 3)"
            />
            <div className="flex flex-1 flex-col gap-1 p-2.5 text-center">
              <p className="font-display text-sm font-semibold leading-tight text-primary">{dish.name}</p>
              {dish.macros && (
                <p className="tabular text-[0.6875rem] leading-tight text-ink-muted">
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
      {PLAN_CHECKOUT_ENABLED && (
        <p className="text-center text-xs text-ink-muted">
          Delivered {PLAN_DELIVERY_DAYS_SENTENCE}.
        </p>
      )}

      {/* T-07: the reassurance lines used to live INSIDE the fixed bar, which
          made it 141px on top of a 65px tab bar — a quarter of the viewport
          pinned. They read here, in flow, directly above where the bar sits;
          the bar keeps only the one money CTA. The trust claim is the same
          tappable sheet the checkout pay bars use (T-20). */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-center text-xs text-ink-muted">
          {PLAN_CHECKOUT_ENABLED ? TRIAL_COPY.noAutoConvert : TRIO_ORDER_COPY}
        </p>
        <KitchenSafetyChip />
      </div>

      {/* Sticky footer on the shared StickyAction chrome (the same glass bar
          the checkout pay bars use) — the ONE money-bearing CTA on this
          screen, since starting the trial IS the commitment moment, same
          treatment as CheckoutPay's Pay button. Always rendered: /trial lives
          under app/(focus)/, and FocusLayout mounts no MiniCartBar and no tab
          bar to hand the bottom edge to — so the bar anchors at bottom-0, cart
          state or not. CTA only: ~72px of pinned chrome plus the safe-area
          inset. */}
      <StickyAction className="bottom-0 z-[var(--z-bar)]">
        <div className="mx-auto max-w-md px-4 py-3">
          <Button
            type="button"
            onClick={start}
            shape="pill"
            size="fluid"
            className="w-full min-h-12 px-8 py-3.5 text-center text-base font-semibold"
          >
            Start with 3 lunches · {formatPaise(ctaPaise)}
          </Button>
        </div>
      </StickyAction>
    </section>
  );
}
