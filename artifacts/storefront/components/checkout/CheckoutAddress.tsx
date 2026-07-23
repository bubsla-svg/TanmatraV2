import { useState } from "react";
import { StepDots } from "./StepDots";
import { formatPaise } from "@/lib/format";
import { CERTAINTY } from "@/lib/checkout";

/**
 * Screen 2 — Address (02c §3). One decision: where. PIN pre-fills from the
 * serviceability gate (that gate is the live-env seam); two fields max for a
 * new address, zero for a returning user (this screen is skipped for them).
 * No slot picker — the delivery window is stated, not chosen.
 */
export function CheckoutAddress({
  step,
  total,
  onDeliver,
}: {
  step: number;
  total: number;
  onDeliver: () => void;
}) {
  const [pincode, setPincode] = useState("");
  const [line, setLine] = useState("");
  const pinValid = pincode.replace(/\D/g, "").length === 6;
  const lineValid = line.trim().length > 3;
  const valid = pinValid && lineValid;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <StepDots current={step} total={total} />
        <span className="tabular text-sm font-semibold text-ink">{formatPaise(total)}</span>
      </div>
      <h1 className="text-lg font-semibold text-ink">Delivery address</h1>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label htmlFor="co-pin" className="mb-1.5 block text-sm font-medium text-ink">
            PIN code
          </label>
          <input
            id="co-pin"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            placeholder="201301"
            aria-describedby="co-pin-hint"
            aria-invalid={pincode.length > 0 && !pinValid}
            className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-ink focus:border-line-strong"
          />
          <p id="co-pin-hint" className="mt-1.5 text-xs text-ink-faint">
            6-digit PIN code &mdash; we check delivery to your area.
          </p>
        </div>
        <div>
          <label htmlFor="co-street" className="mb-1.5 block text-sm font-medium text-ink">
            Flat / house &middot; street
          </label>
          <input
            id="co-street"
            type="text"
            autoComplete="street-address"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder="Flat 3B, Sector 62"
            aria-invalid={line.length > 0 && !lineValid}
            className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-ink focus:border-line-strong"
          />
        </div>
      </div>
      <p className="text-xs text-ink-muted">Delivered 12:30&ndash;1:30, weekdays.</p>
      <p className="text-xs font-medium text-sage-text">{CERTAINTY.address}</p>
      <button
        type="button"
        disabled={!valid}
        onClick={onDeliver}
        className="rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        Deliver here
      </button>
    </div>
  );
}
