"use client";
// Client: the in-summary quantity steppers write to the cart store.
import { Card } from "@astryxdesign/core/Card";
import { formatMacroLine, formatPaise } from "@/lib/format";
import { itemCount, qtyOf, setQty, subtotalPaise, type CartState } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import type { QuoteSnapshot } from "@/lib/quoteApi";
import type { QuoteUiState } from "./AlacarteCheckout";
import { QuoteBreakdown } from "./QuoteBreakdown";
import { QuantityStepper } from "@/components/primitives/QuantityStepper";

/**
 * The order summary as a DISCLOSURE at the top of the form (T-09). It used to
 * be a fully open card that pushed the first form field ~900px below the fold
 * on a phone; the sticky bar already carries the total, so the card's job is
 * to be one tap away, not to be read first. Every figure inside is the
 * server quote's or the line's own price — nothing is summed here.
 */
export function AlacarteOrderSummary({
  cart,
  quote,
  quoteState,
  quoteError,
  quoteRetryable,
  onRefreshQuote,
}: {
  cart: CartState;
  quote: QuoteSnapshot | null;
  quoteState: QuoteUiState;
  quoteError: string | null;
  quoteRetryable?: boolean;
  onRefreshQuote: () => void;
}) {
  const { setCart } = useCart();
  const count = itemCount(cart);
  const headline =
    quoteState === "active" && quote ? formatPaise(quote.payableNowPaise) : `${formatPaise(subtotalPaise(cart))} est.`;

  return (
    <details className="group rounded-3xl border border-line bg-surface" data-testid="alc-order-summary">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold text-ink">
          <span className="tabular">{count}</span> {count === 1 ? "item" : "items"}{" "}
          <span aria-hidden className="text-ink-faint">·</span>{" "}
          <span className="tabular">{headline}</span>
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-ink-muted">
          <span className="group-open:hidden">Show order</span>
          <span className="hidden group-open:inline">Hide order</span>
          <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>
      <Card padding={5} className="rounded-b-3xl rounded-t-none border-0 border-t border-line">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">Current order</p>
        <ul className="divide-y divide-line">
          {cart.lines.map((l) => (
            <li key={`${l.kind}-${l.dishId}-${(l.customizations ?? []).join("|")}`} className="py-3">
              <p className="line-clamp-2 text-sm font-medium text-ink">{l.name}</p>
              {l.customizations && l.customizations.length > 0 && (
                <p className="line-clamp-2 text-xs text-ink-muted">{l.customizations.join(", ")}</p>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="tabular text-xs text-ink-muted">{formatPaise(l.pricePaise)}</p>
                  {l.macros && (
                    <p className="tabular text-xs text-ink-faint">
                      {formatMacroLine(l.macros, l.macros.estimated, l.macros.provisional)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <QuantityStepper
                    value={l.qty}
                    label={`${l.name} quantity`}
                    decreaseLabel="Decrease"
                    increaseLabel="Increase"
                    onDecrease={() => setCart(setQty(cart, l.dishId, l.kind, qtyOf(cart, l.dishId, l.kind, l.customizations) - 1, l.customizations))}
                    onIncrease={() => setCart(setQty(cart, l.dishId, l.kind, qtyOf(cart, l.dishId, l.kind, l.customizations) + 1, l.customizations))}
                  />
                  <span className="tabular w-16 text-right text-sm font-semibold text-ink">
                    {formatPaise(l.pricePaise * l.qty)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <QuoteBreakdown quote={quote} quoteState={quoteState} quoteError={quoteError} quoteRetryable={quoteRetryable} onRefreshQuote={onRefreshQuote} />
      </Card>
    </details>
  );
}
