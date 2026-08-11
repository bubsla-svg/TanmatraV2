import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/format";
import type { QuoteSnapshot } from "@/lib/quoteApi";
import type { QuoteUiState } from "./AlacarteCheckout";

/**
 * Server-owned totals. Never client arithmetic: the QuoteSnapshot is priced
 * by the exact code POST /orders bills from.
 */
export function QuoteBreakdown({
  quote,
  quoteState,
  quoteError,
  onRefreshQuote,
}: {
  quote: QuoteSnapshot | null;
  quoteState: QuoteUiState;
  quoteError: string | null;
  onRefreshQuote: () => void;
}) {
  return (
    <div className="mt-2 border-t border-line pt-3">
      {quoteState === "loading" && (
        <p role="status" className="py-1 text-sm text-ink-muted">Pricing your order…</p>
      )}
      {quoteState === "error" && (
        <div role="status" className="flex flex-col gap-2 py-1">
          <p className="text-sm text-ink-muted">{quoteError ?? "We couldn't price your order just now."}</p>
          <Button type="button" variant="outline" shape="pill" size="fluid" onClick={onRefreshQuote} className="self-start bg-surface px-4 py-2 text-sm font-semibold">
            Retry pricing
          </Button>
        </div>
      )}
      {quoteState === "expired" && (
        <div role="status" className="flex flex-col gap-2 py-1">
          <p className="text-sm text-ink-muted">This price snapshot has expired — prices may have changed.</p>
          <Button type="button" variant="outline" shape="pill" size="fluid" onClick={onRefreshQuote} className="self-start bg-surface px-4 py-2 text-sm font-semibold">
            Refresh quote
          </Button>
        </div>
      )}
      {quoteState === "active" && quote && (
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Item subtotal</dt>
            <dd className="tabular text-ink">{formatPaise(quote.subtotalPaise)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Delivery</dt>
            <dd className="tabular text-ink">
              {quote.deliveryFeePaise === 0 ? "Free" : formatPaise(quote.deliveryFeePaise)}
            </dd>
          </div>
          {quote.deliveryFeePaise > 0 && quote.amountToFreeDeliveryPaise > 0 && (
            <p className="text-xs text-ink-faint">
              Add {formatPaise(quote.amountToFreeDeliveryPaise)} more for free delivery.
            </p>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Packaging</dt>
            <dd className="tabular text-ink">{quote.packagingPaise === 0 ? "Included" : formatPaise(quote.packagingPaise)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Discount</dt>
            <dd className="tabular text-ink">{quote.discountPaise === 0 ? "—" : `−${formatPaise(quote.discountPaise)}`}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">GST (5% food · 18% delivery)</dt>
            <dd className="tabular text-ink">{formatPaise(quote.taxPaise)}</dd>
          </div>
          <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2">
            <dt className="font-semibold text-ink">Amount payable now</dt>
            <dd className="tabular font-semibold text-gold-text">{formatPaise(quote.payableNowPaise)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
