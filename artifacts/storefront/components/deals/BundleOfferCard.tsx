"use client";
// Combo card for `/meal-deals` (Stitch brief 18 + repo law).
//
// REPO LAW: a combo is ONE clickable card that opens a Dialog listing its
// constituent dishes, each linking to /dish/:slug, with an "Add Combo" CTA. It
// is never flattened into separately-tappable dish tiles — the previous version
// was a flat card linking to /plan/<slug> for three slugs that are not real
// PlanIds, so every CTA was a dead route.
//
// MONEY: the total is the sum of the constituents' server catalog prices,
// computed in lib/mealBundles and passed in. Nothing is priced here, no discount
// is claimed, and the cart lines carry the server price snapshot exactly as
// AddToCart does — the server still re-prices at order.
import { useState } from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { formatPaise } from "@/lib/format";
import { addLine } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import type { BundleView } from "@/lib/mealBundles";

export function BundleOfferCard({ bundle }: { bundle: BundleView }) {
  const { cart, setCart } = useCart();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);

  function addCombo() {
    let next = cart;
    for (const d of bundle.dishes) {
      next = addLine(next, {
        dishId: d.id,
        kind: "dish",
        slug: d.slug,
        name: d.name,
        pricePaise: d.pricePaise,
      });
    }
    setCart(next);
    setAdded(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex h-full flex-col justify-between gap-5 rounded-3xl border border-line bg-surface p-6 text-left transition-colors hover:border-line-strong"
      >
        <div className="flex flex-col gap-3">
          <span className="w-fit rounded-full bg-sage-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sage-text">
            {bundle.badge}
          </span>
          <h3 className="text-lg font-semibold leading-snug text-ink">{bundle.title}</h3>
          <p className="text-sm leading-relaxed text-ink-muted">{bundle.desc}</p>
        </div>

        <div className="flex items-end justify-between gap-3 border-t border-line pt-4">
          <span className="flex flex-col">
            <span className="tabular text-lg font-semibold text-ink">{formatPaise(bundle.totalPaise)}</span>
            <span className="tabular text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
              {bundle.dishes.length} meals
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-gold-text">View combo &rarr;</span>
        </div>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--ink)]/40 backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-16 z-50 flex max-h-[80vh] w-[92vw] max-w-md -translate-x-1/2 flex-col overflow-hidden rounded-3xl border border-line bg-surface"
          >
            <div className="border-b border-line px-5 py-4">
              <Dialog.Title className="text-base font-semibold text-ink">{bundle.title}</Dialog.Title>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{bundle.desc}</p>
            </div>

            <ul className="flex-1 overflow-y-auto p-2">
              {bundle.dishes.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/dish/${d.slug}`}
                    className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-subtle"
                  >
                    <span className="min-w-0 truncate text-sm text-ink">{d.name}</span>
                    <span className="tabular shrink-0 text-sm text-ink-muted">
                      {formatPaise(d.pricePaise)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 border-t border-line p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
                  Combo total
                </span>
                <span className="tabular text-lg font-semibold text-ink">
                  {formatPaise(bundle.totalPaise)}
                </span>
              </div>
              {added ? (
                <Link
                  href="/cart"
                  className="inline-flex w-full items-center justify-center rounded-full border border-line-strong px-6 py-3.5 text-sm font-semibold text-ink"
                >
                  Added &mdash; view cart &rarr;
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={addCombo}
                  className="inline-flex w-full items-center justify-center rounded-full bg-gold px-6 py-3.5 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
                >
                  Add combo
                </button>
              )}
              <Dialog.Close className="text-xs text-ink-muted transition-colors hover:text-ink">
                Close
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
