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
  const valid = pincode.replace(/\D/g, "").length === 6 && line.trim().length > 3;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <StepDots current={step} total={total} />
        <span className="tabular text-sm font-semibold text-ink">{formatPaise(total)}</span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <input
          type="text"
          inputMode="numeric"
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          placeholder="PIN code"
          aria-label="PIN code"
          className="rounded-xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus:border-line-strong"
        />
        <input
          type="text"
          value={line}
          onChange={(e) => setLine(e.target.value)}
          placeholder="Flat / house · street"
          aria-label="Street address"
          className="rounded-xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus:border-line-strong"
        />
      </div>
      <p className="text-xs text-ink-muted">Delivered 12:30&ndash;1:30, weekdays.</p>
      <p className="text-xs font-medium text-sage">{CERTAINTY.address}</p>
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
