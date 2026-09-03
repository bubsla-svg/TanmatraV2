/**
 * The methods a buyer can pay with, said BEFORE the Razorpay handoff (T-12).
 *
 * Indian mobile buyers decide on UPI-intent availability before they tap
 * pay; the only cue used to be an 11px "SECURE UPI CHECKOUT" eyebrow. Text
 * marks, not vendor logos: no brand asset is bundled and the sheet itself
 * shows the real apps (lib/razorpayAdapter.ts orders UPI first inside it).
 * Server-safe — no state, no client directive.
 */
const METHODS = ["UPI", "GPay", "PhonePe", "Paytm", "Cards"] as const;

export function PaymentMethodsRow({ className = "" }: { className?: string }) {
  return (
    <ul aria-label="Accepted payment methods" className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {METHODS.map((m) => (
        <li
          key={m}
          className="inline-flex h-6 items-center rounded-md border border-line bg-surface px-2 text-2xs font-bold uppercase tracking-wide text-ink-muted"
        >
          {m}
        </li>
      ))}
    </ul>
  );
}
