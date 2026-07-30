"use client";
// Client: controlled address/consent inputs for the guest money path.
import { useEffect, useRef, useState } from "react";
import { formatPaise } from "@/lib/format";
import { qtyOf, setQty, subtotalPaise, type CartState } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { DPDP_CONSENT_COPY } from "@/lib/consent";

export interface AlacarteAddress {
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
}

const inputCls =
  "w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus:border-line-strong";

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
  initialAddress,
  busy,
  error,
  onSubmit,
}: {
  cart: CartState;
  phone: string;
  onPhoneChange: (v: string) => void;
  phoneLocked: boolean;
  /** SF-04: a saved default address to seed the fields (parent remounts this
   *  component via `key` when it arrives, so plain useState seeds are correct). */
  initialAddress?: { line1: string; city: string; pincode: string } | null;
  busy: boolean;
  error: string | null;
  onSubmit: (address: AlacarteAddress) => void;
}) {
  const [line1, setLine1] = useState(initialAddress?.line1 ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [pincode, setPincode] = useState(initialAddress?.pincode ?? "");
  const [consent, setConsent] = useState(false);
  const prefilled = useRef(false);
  const { setCart } = useCart();

  // A saved address may arrive AFTER mount (async sign-in fetch). Seed the
  // fields once — but only while they're still untouched, so a customer who
  // started typing before it resolved never has their input clobbered.
  useEffect(() => {
    if (!initialAddress || prefilled.current) return;
    if (line1 === "" && city === "" && pincode === "") {
      prefilled.current = true;
      setLine1(initialAddress.line1);
      setCity(initialAddress.city);
      setPincode(initialAddress.pincode);
    }
  }, [initialAddress, line1, city, pincode]);

  const phoneValid = phone.replace(/\D/g, "").length >= 10;
  const pinValid = pincode.replace(/\D/g, "").length === 6;
  const hasItems = cart.lines.length > 0;
  const valid = hasItems && phoneValid && line1.trim().length > 2 && city.trim().length > 1 && pinValid && consent;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-line bg-surface p-5">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">Current order</p>
        <ul className="divide-y divide-line">
          {cart.lines.map((l) => (
            <li key={`${l.kind}-${l.dishId}`} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{l.name}</p>
                <p className="font-mono tabular text-xs text-ink-muted">{formatPaise(l.pricePaise)}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-full border border-line-strong" role="group" aria-label={`${l.name} quantity`}>
                  <button type="button" aria-label="Decrease" onClick={() => setCart(setQty(cart, l.dishId, l.kind, qtyOf(cart, l.dishId, l.kind) - 1))} className="min-h-8 min-w-8 text-ink transition-transform active:scale-[0.98]">−</button>
                  <span aria-live="polite" className="font-mono tabular min-w-6 text-center text-sm font-semibold text-ink">{l.qty}</span>
                  <button type="button" aria-label="Increase" onClick={() => setCart(setQty(cart, l.dishId, l.kind, qtyOf(cart, l.dishId, l.kind) + 1))} className="min-h-8 min-w-8 text-ink transition-transform active:scale-[0.98]">+</button>
                </div>
                <span className="font-mono tabular w-16 text-right text-sm font-semibold text-ink">
                  {formatPaise(l.pricePaise * l.qty)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between gap-3 border-t border-line pt-3 text-sm">
          <span className="text-ink-muted">Subtotal · server bills the final total (incl. GST)</span>
          <span className="font-mono tabular font-semibold text-gold-text">{formatPaise(subtotalPaise(cart))}</span>
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

      <p className="text-center text-[11px] text-ink-faint">
        UPI · FSSAI licensed · RD-reviewed kitchen · you won&rsquo;t be charged until you confirm in the payment step.
      </p>

      {/* Sticky pay bar — sits above the 4rem bottom-nav band on mobile. The
          amount shown is the same DISPLAY subtotal as the summary card; the
          CTA itself stays amount-free (server prices the order). */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:bottom-0">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Est. total</span>
            <span className="font-mono tabular text-lg font-bold text-ink">{formatPaise(subtotalPaise(cart))}</span>
          </div>
          <button
            type="button" disabled={!valid || busy}
            onClick={() => onSubmit({ line1: line1.trim(), city: city.trim(), pincode: pincode.replace(/\D/g, "") })}
            className="rounded-full bg-gold px-8 py-3.5 text-center text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? "Opening payment…" : "Continue to payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
