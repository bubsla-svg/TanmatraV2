import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StepDots } from "./StepDots";
import { formatPaise } from "@/lib/format";
import { CERTAINTY } from "@/lib/checkout";
import { PLAN_DELIVERY_WINDOW_LABEL } from "@/lib/planCheckout";
import { LocationPickerFlow } from "@/components/address/LocationPickerFlow";

/**
 * Screen 2 — Address (02c §3). One decision: where. PIN pre-fills from the
 * serviceability gate (that gate is the live-env seam); two fields max for a
 * new address, zero for a returning user (this screen is skipped for them).
 * No slot picker — the delivery window is stated, not chosen.
 */
export function CheckoutAddress({
  step,
  total,
  totalPaise,
  onDeliver,
}: {
  step: number;
  /** Step COUNT for the dots — not an amount. */
  total: number;
  /** Server-quoted order amount, rendered verbatim. Optional so the header
   *  simply omits it rather than inventing a number when it is absent. */
  totalPaise?: number;
  onDeliver: () => void;
}) {
  const [pincode, setPincode] = useState("");
  const [line, setLine] = useState("");
  const [pickingLocation, setPickingLocation] = useState(false);
  const pinValid = pincode.replace(/\D/g, "").length === 6;
  const lineValid = line.trim().length > 3;
  const valid = pinValid && lineValid;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <StepDots current={step} total={total} />
        {/* Was formatPaise(total) — i.e. the STEP COUNT formatted as money, so a
            3-screen flow displayed 3 paise as the order amount (shipped in
            4be36f56, found during the Stitch restyle). Renders the server's
            quoted amount now, and nothing at all when it is absent. */}
        {typeof totalPaise === "number" && (
          <span className="tabular text-sm font-semibold text-ink">{formatPaise(totalPaise)}</span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">Delivery address</h1>
        <button
          type="button"
          onClick={() => setPickingLocation(true)}
          className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-bold text-ink transition-transform hover:bg-surface-raised active:scale-[0.98]"
        >
          <span>⌖</span>
          <span>Pick on map</span>
        </button>
      </div>
      {pickingLocation && (
        <LocationPickerFlow
          onClose={() => setPickingLocation(false)}
          onSelectLocation={(place) => {
            setPickingLocation(false);
            if (place.pincode) setPincode(place.pincode);
            if (place.formattedAddress) setLine(place.formattedAddress);
          }}
          onManualFallback={() => setPickingLocation(false)}
        />
      )}
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
            className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base text-ink focus-visible:border-line-strong"
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
            className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base text-ink focus-visible:border-line-strong"
          />
        </div>
      </div>
      <p className="text-xs text-ink-muted">Delivered {PLAN_DELIVERY_WINDOW_LABEL}, weekdays.</p>
      <p className="text-xs font-medium text-sage-text">{CERTAINTY.address}</p>
      <Button
        type="button"
        disabled={!valid}
        onClick={onDeliver}
        shape="pill" size="fluid" className="px-6 py-3 font-semibold disabled:opacity-40"
      >
        Deliver here
      </Button>
    </div>
  );
}
