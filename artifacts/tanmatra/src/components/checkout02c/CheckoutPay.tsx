import { useState } from "react";
import { cn } from "@/lib/utils";
import { Price, StepDots } from "@/components/primitives";

interface CheckoutPayProps {
  /** One-line plan summary, e.g. "Desk Fuel · 22 lunches". */
  planSummary: string;
  /** Server-quoted, GST-inclusive total — the exact number charged (02c §10.2). */
  totalPaise: number;
  /** Applied credit (e.g. the ₹399 trial creditback), rendered as one sage line. */
  creditPaise?: number;
  /** e.g. "Next billing 21 Aug · pause or cancel anytime". */
  futureStateLabel: string;
  onPayUpi: () => void;
  className?: string;
}

/**
 * `<CheckoutPay>` — 02c §3 S3. Element inventory is exhaustive: step dots, the
 * plan one-liner + server-quoted total, an optional sage credit line, ONE
 * dominant "Pay … with UPI" button (fires the OS UPI intent), a collapsed
 * "More ways to pay", one future-state line, and the trust row. No coupon
 * field. No COD. One decision: pay.
 */
export function CheckoutPay({
  planSummary,
  totalPaise,
  creditPaise,
  futureStateLabel,
  onPayUpi,
  className,
}: CheckoutPayProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <section className={cn("flex flex-col gap-4 p-4", className)} aria-label="Pay">
      <StepDots current={3} total={3} />

      <div className="flex items-baseline justify-between">
        <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>{planSummary}</span>
        <Price paise={totalPaise} size="lg" aria-label="Total payable" />
      </div>

      {creditPaise != null && creditPaise > 0 && (
        <p className="text-sm" style={{ color: "var(--color-clinical-sage)", margin: 0 }}>
          <Price paise={creditPaise} size="sm" /> credit applied
        </p>
      )}

      <button
        type="button"
        onClick={onPayUpi}
        className="rounded-xl px-4 py-3.5 text-center font-semibold transition-transform active:scale-[0.98]"
        style={{ backgroundColor: "var(--color-saffron-500)", color: "var(--color-saffron-on)" }}
      >
        Pay <Price paise={totalPaise} size="md" /> with UPI
      </button>

      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
        className="text-sm underline-offset-2 hover:underline"
        style={{ color: "var(--color-ink-500)", background: "none", border: "none" }}
      >
        More ways to pay
      </button>
      {moreOpen && (
        <div className="flex flex-col gap-2 text-sm" style={{ color: "var(--color-ink-500)" }}>
          <span>Cards</span>
          <span>Meal card</span>
          <span>Net banking</span>
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--color-ink-500)", margin: 0 }}>
        {futureStateLabel}
      </p>

      <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--color-ink-500)" }}>
        <span>UPI</span>
        <span>FSSAI licensed</span>
        <span>RD-reviewed kitchen</span>
      </div>
    </section>
  );
}
