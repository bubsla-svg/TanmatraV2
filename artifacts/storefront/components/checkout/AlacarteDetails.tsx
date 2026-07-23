"use client";
// Client: controlled address/consent inputs for the guest money path.
import { useState } from "react";
import { formatPaise } from "@/lib/format";
import { subtotalPaise, type CartState } from "@/lib/cartStore";
import { DPDP_CONSENT_COPY } from "@/lib/consent";

export interface AlacarteAddress {
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
}

const inputCls =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus:border-line-strong";

/**
 * À-la-carte details (SF-05). One screen: contact phone (controlled by the
 * parent so a verified sign-in can prefill it), delivery address, and the DPDP
 * consent the server requires. The summary shows the DISPLAY subtotal only; the
 * CTA is deliberately amount-free — the server prices the order and the Razorpay
 * modal shows the authoritative total. No client number is ever charged.
 */
export function AlacarteDetails({
  cart,
  phone,
  onPhoneChange,
  phoneLocked,
  busy,
  error,
  onSubmit,
}: {
  cart: CartState;
  phone: string;
  onPhoneChange: (v: string) => void;
  phoneLocked: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (address: AlacarteAddress) => void;
}) {
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [consent, setConsent] = useState(false);

  const phoneValid = phone.replace(/\D/g, "").length >= 10;
  const pinValid = pincode.replace(/\D/g, "").length === 6;
  const hasItems = cart.lines.length > 0;
  const valid = hasItems && phoneValid && line1.trim().length > 2 && city.trim().length > 1 && pinValid && consent;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-surface p-4">
        <ul className="divide-y divide-line">
          {cart.lines.map((l) => (
            <li key={l.dishId} className="flex justify-between py-1.5 text-sm">
              <span className="text-ink-muted">{l.qty}× {l.name}</span>
              <span className="tabular text-ink">{formatPaise(l.pricePaise * l.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm">
          <span className="text-ink-muted">Subtotal · server bills the final total (incl. GST)</span>
          <span className="tabular font-semibold text-ink">{formatPaise(subtotalPaise(cart))}</span>
        </div>
      </div>

      <div>
        <label htmlFor="alc-phone" className="mb-1.5 block text-sm font-medium text-ink">Mobile number</label>
        <input
          id="alc-phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone}
          onChange={(e) => onPhoneChange(e.target.value)} readOnly={phoneLocked} placeholder="98765 43210"
          className={phoneLocked ? `${inputCls} opacity-70` : inputCls}
        />
      </div>
      <div>
        <label htmlFor="alc-line1" className="mb-1.5 block text-sm font-medium text-ink">Flat / house · street</label>
        <input id="alc-line1" autoComplete="street-address" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Flat 3B, Sector 62" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="alc-city" className="mb-1.5 block text-sm font-medium text-ink">City</label>
          <input id="alc-city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Noida" className={inputCls} />
        </div>
        <div>
          <label htmlFor="alc-pin" className="mb-1.5 block text-sm font-medium text-ink">PIN code</label>
          <input
            id="alc-pin" inputMode="numeric" autoComplete="postal-code" value={pincode}
            onChange={(e) => setPincode(e.target.value)} placeholder="201301"
            aria-invalid={pincode.length > 0 && !pinValid} className={inputCls}
          />
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0" />
        <span>{DPDP_CONSENT_COPY}</span>
      </label>

      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}

      <button
        type="button" disabled={!valid || busy}
        onClick={() => onSubmit({ line1: line1.trim(), city: city.trim(), pincode: pincode.replace(/\D/g, "") })}
        className="rounded-xl bg-gold px-5 py-4 text-center text-base font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "Opening payment…" : "Continue to payment"}
      </button>
      <p className="text-center text-[11px] text-ink-faint">
        UPI · FSSAI licensed · RD-reviewed kitchen · you won&rsquo;t be charged until you confirm in the payment step.
      </p>
    </div>
  );
}
