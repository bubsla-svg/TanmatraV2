"use client";
// Client: the pay CTA's click handler lives in the parent; this is the bar.
import { Button } from "@/components/ui/button";
import { PaymentMethodsRow } from "./PaymentMethodsRow";

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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto flex max-w-md flex-col gap-1.5 px-4 py-3">
        {blockedReason !== null && !busy && (
          <p role="status" className="text-xs font-medium text-ink-muted">{blockedReason}</p>
        )}
        <PaymentMethodsRow />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-2xs font-bold uppercase tracking-widest text-ink-muted">Payable now</span>
            <span className="tabular text-lg font-bold text-ink">
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
            // min-w-64: sized to the longest CTA state so the button never
            // resizes as the label changes under a thumb.
            className="min-h-12 min-w-64 px-8 py-3.5 text-center font-semibold disabled:opacity-40"
          >
            {ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
