"use client";
// Client: the pay CTA's click handler lives in the parent; this is the bar.
import { Button } from "@/components/ui/button";
import { PaymentMethodsRow } from "./PaymentMethodsRow";
import { StickyAction } from "@/components/primitives/StickyAction";

/**
 * Sticky pay bar for the à-la-carte checkout. Anchored bottom-0: /checkout
 * lives in the (focus) shell, no global tab bar here. The amount is the
 * server quote's payable-now, rendered by the parent — never a client sum.
 *
 * T-12: the accepted methods sit in the bar, above the CTA, and the CTA
 * names the amount once a quote has landed.
 */
export function AlacartePayBar({
  amount,
  amountEstimated,
  ctaLabel,
  blockedReason,
  ctaEnabled,
  busy,
  verifying,
  slotLabel,
  onContinue,
}: {
  amount: string;
  amountEstimated: boolean;
  ctaLabel: string;
  blockedReason: string | null;
  ctaEnabled: boolean;
  busy: boolean;
  verifying?: boolean;
  /** "Tomorrow · <window>" once a delivery window is chosen (T-08). */
  slotLabel: string | null;
  onContinue: () => void;
}) {
  return (
    <StickyAction className="bottom-0 z-30">
      <div className="mx-auto flex max-w-md flex-col gap-1.5 px-4 py-3">
        {blockedReason !== null && !busy && (
          <p role="status" className="text-xs font-medium text-ink-muted">{blockedReason}</p>
        )}
        <PaymentMethodsRow />
        {/* The amount column is the part that must never lose: it is
            shrink-0 with a nowrap label, and the CTA takes whatever width is
            left (flex-1). The CTA used to carry min-w-64 at every width, so on
            a 375px iPhone the column was squeezed to 75px ("PAYABLE NOW"
            wrapped to three lines) and at 320px to 20px — the payable amount
            itself clipped behind the button. From sm up the CTA keeps its
            fixed 16rem so the label changing under a thumb never resizes it;
            below sm the flex layout fixes its width the same way. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 shrink-0 flex-col">
            <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Payable now</span>
            <span className="font-data text-xl font-bold leading-none text-primary">
              {amount}
              {amountEstimated && <span className="ml-1 text-xs font-medium text-ink-faint">est.</span>}
            </span>
            {slotLabel && (
              <span className="truncate text-xs font-medium text-ink-muted" data-testid="alc-slot-summary">
                {slotLabel}
              </span>
            )}
          </div>
          <Button
            type="button"
            disabled={!ctaEnabled || busy}
            aria-busy={verifying || busy}
            aria-live="polite"
            onClick={onContinue}
            shape="pill"
            size="fluid"
            className="min-h-12 min-w-0 flex-1 px-4 py-3.5 text-center font-semibold disabled:opacity-40 sm:flex-none sm:min-w-64 sm:px-8"
          >
            {ctaLabel}
          </Button>
        </div>
      </div>
    </StickyAction>
  );
}
