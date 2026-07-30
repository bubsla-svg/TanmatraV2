import { useState } from "react";
import { StepDots } from "./StepDots";
import { formatPaise } from "@/lib/format";
import { MEALCARD_RAIL_ENABLED } from "@/lib/flags";

/**
 * Screen 3 — Pay (02c §3). One decision: pay. One dominant UPI button (the OS
 * UPI intent is the live-env seam — stubbed to confirm here). Server-quoted,
 * GST-inclusive total; a future-state line; a trust row. No coupon field, no
 * COD. "More ways to pay" stays collapsed until tapped.
 */
export function CheckoutPay({
  step,
  stepCount,
  totalPaise,
  planSummary,
  futureLine,
  creditPaise = 0,
  onPay,
}: {
  step: number;
  /** How many screens this user's flow has (for the step dots). */
  stepCount: number;
  /** The amount charged, in paise — server-quoted, GST-inclusive. */
  totalPaise: number;
  planSummary: string;
  futureLine: string;
  creditPaise?: number;
  onPay: () => void;
}) {
  const [more, setMore] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <StepDots current={step} total={stepCount} />
        <span className="tabular text-sm font-semibold text-ink">{formatPaise(totalPaise)}</span>
      </div>
      <h1 className="text-lg font-semibold text-ink">Review &amp; pay</h1>

      <div className="rounded-3xl border border-line bg-surface p-5">
        <p className="text-sm text-ink-muted">{planSummary}</p>
        {creditPaise > 0 && (
          <p className="mt-1 text-sm font-medium text-sage-text">
            {formatPaise(creditPaise)} credit applied
          </p>
        )}
        <p className="tabular mt-1 text-2xl font-semibold text-ink">{formatPaise(totalPaise)}</p>
      </div>

      {/* Sticky pay bar — the screen's single gold pill, above the 4rem
          bottom-nav band on mobile. Amount is the server-quoted total verbatim. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:bottom-0">
        <div className="mx-auto max-w-md px-4 py-3">
          <button
            type="button"
            onClick={onPay}
            className="w-full rounded-full bg-gold px-8 py-4 text-center text-base font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
          >
            Pay {formatPaise(totalPaise)} with UPI
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        className="-m-2 self-center p-2 text-xs font-medium text-ink-muted underline-offset-4 hover:underline"
        aria-expanded={more}
      >
        More ways to pay
      </button>
      {more && (
        <p className="text-center text-xs text-ink-faint">
          {MEALCARD_RAIL_ENABLED
            ? "Cards · meal card (Pluxee / Sodexo) · netbanking."
            : "Cards · meal card (Pluxee / Sodexo) · netbanking — added when merchant credentials are live."}
        </p>
      )}

      <p className="text-center text-xs text-ink-muted">{futureLine}</p>
      <p className="text-center text-[11px] text-ink-faint">
        UPI · FSSAI licensed · RD-reviewed kitchen
      </p>
    </div>
  );
}
