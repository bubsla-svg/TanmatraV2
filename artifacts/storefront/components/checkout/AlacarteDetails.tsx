"use client";
// Client: controlled address/consent inputs for the guest money path.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/format";
import { qtyOf, setQty, subtotalPaise, type CartState } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { DPDP_CONSENT_COPY, DPDP_SCOPE_NOTE } from "@/lib/consent";
import type { QuoteSnapshot } from "@/lib/quoteApi";
import type { QuoteUiState } from "./AlacarteCheckout";
import { ADDRESS_DRAFT_KEY } from "./AlacarteCheckout";

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
 * consent the server requires. Every total on this screen renders from the
 * server QuoteSnapshot — the same arithmetic POST /orders bills from — so the
 * amount beside the CTA, the breakdown, and the Razorpay charge can never
 * disagree. The CTA itself stays amount-free.
 */
export function AlacarteDetails({
  cart,
  phone,
  onPhoneChange,
  phoneLocked,
  initialAddress,
  busy,
  verifying,
  error,
  onSubmit,
  quote,
  quoteState,
  quoteError,
  onRefreshQuote,
  onPincodeChange,
}: {
  cart: CartState;
  phone: string;
  onPhoneChange: (v: string) => void;
  phoneLocked: boolean;
  /** SF-04: a saved default address to seed the fields (parent remounts this
   *  component via `key` when it arrives, so plain useState seeds are correct). */
  initialAddress?: { line1: string; city: string; pincode: string } | null;
  busy: boolean;
  /** True once Razorpay has captured the money and verify is retrying — the
   *  CTA copy must say so; "Opening payment…" after the modal already closed
   *  reads as a stuck/failed button on money the customer already paid. */
  verifying?: boolean;
  error: string | null;
  onSubmit: (address: AlacarteAddress) => void;
  /** Server QuoteSnapshot + lifecycle (parent owns fetching). */
  quote: QuoteSnapshot | null;
  quoteState: QuoteUiState;
  quoteError: string | null;
  onRefreshQuote: () => void;
  onPincodeChange: (pin: string) => void;
}) {
  const [line1, setLine1] = useState(initialAddress?.line1 ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [pincode, setPincode] = useState(initialAddress?.pincode ?? "");
  const [consent, setConsent] = useState(false);
  const prefilled = useRef(false);

  const { setCart } = useCart();

  // Draft restore: back/forward navigation must not eat a typed address.
  // Runs once, only into still-empty fields (a saved-address prefill or the
  // customer's own typing always wins).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ADDRESS_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { line1?: string; city?: string; pincode?: string };
      setLine1((v) => (v === "" && d.line1 ? d.line1 : v));
      setCity((v) => (v === "" && d.city ? d.city : v));
      setPincode((v) => {
        const next = v === "" && d.pincode ? d.pincode : v;
        if (next !== v) onPincodeChange(next);
        return next;
      });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (line1 || city || pincode) {
        sessionStorage.setItem(ADDRESS_DRAFT_KEY, JSON.stringify({ line1, city, pincode }));
      }
    } catch {}
  }, [line1, city, pincode]);

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
      onPincodeChange(initialAddress.pincode);
    }
  }, [initialAddress, line1, city, pincode, onPincodeChange]);

  const phoneValid = phone.replace(/\D/g, "").length >= 10;
  const pinDigits = pincode.replace(/\D/g, "");
  const pinValid = pinDigits.length === 6;
  const hasItems = cart.lines.length > 0;
  const unserviceable = quote?.serviceability != null && quote.serviceability.serviceable === false;

  // PR-09 / sweep rule: a disabled money CTA must say WHY, in order of what
  // the customer should fix first. Null = payable.
  const blockedReason = !hasItems
    ? "Your order is empty"
    : !phoneValid
      ? "Enter your 10-digit mobile number"
      : line1.trim().length <= 2 || city.trim().length <= 1
        ? "Complete the delivery address"
        : !pinValid
          ? "Enter a 6-digit PIN code"
          : unserviceable
            ? "We don't deliver to this PIN code yet"
            : quoteState === "loading"
              ? "Pricing your order…"
              : quoteState === "expired"
                ? "Prices need a refresh — tap Refresh quote above"
                : quoteState === "error"
                  ? "We couldn't price your order — retry above"
                  : !consent
                    ? "Accept the order-processing consent to continue"
                    : null;
  const valid = blockedReason === null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-line bg-surface p-5">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">Current order</p>
        <ul className="divide-y divide-line">
          {cart.lines.map((l) => (
            <li key={`${l.kind}-${l.dishId}-${(l.customizations ?? []).join("|")}`} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{l.name}</p>
                {l.customizations && l.customizations.length > 0 && (
                  <p className="truncate text-xs text-ink-muted">{l.customizations.join(", ")}</p>
                )}
                <p className="tabular text-xs text-ink-muted">{formatPaise(l.pricePaise)}</p>
                {/* D-14: the last look before money shows more than name +
                    price — same figures the menu card already showed. */}
                {l.macros && (
                  <p className="tabular text-xs text-ink-faint">
                    {l.macros.estimated ? "~" : ""}{l.macros.calories} kcal · {l.macros.estimated ? "~" : ""}{l.macros.protein}g P
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* .touch-target-critical (48px): globals.css reserves the
                    stricter tier for exactly this control — "Money-path
                    controls (Pay, quantity steppers)... a mis-tap here costs
                    an order". */}
                <div className="flex items-center rounded-full border border-line-strong" role="group" aria-label={`${l.name} quantity`}>
                  <button type="button" aria-label="Decrease" onClick={() => setCart(setQty(cart, l.dishId, l.kind, qtyOf(cart, l.dishId, l.kind, l.customizations) - 1, l.customizations))} className="touch-target-critical text-ink transition-transform active:scale-[0.98]">−</button>
                  <span aria-live="polite" className="tabular min-w-6 text-center text-sm font-semibold text-ink">{l.qty}</span>
                  <button type="button" aria-label="Increase" onClick={() => setCart(setQty(cart, l.dishId, l.kind, qtyOf(cart, l.dishId, l.kind, l.customizations) + 1, l.customizations))} className="touch-target-critical text-ink transition-transform active:scale-[0.98]">+</button>
                </div>
                <span className="tabular w-16 text-right text-sm font-semibold text-ink">
                  {formatPaise(l.pricePaise * l.qty)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* Server-owned totals. Never client arithmetic: the QuoteSnapshot is
            priced by the exact code POST /orders bills from. */}
        <div className="mt-2 border-t border-line pt-3">
          {quoteState === "loading" && (
            <p role="status" className="py-1 text-sm text-ink-muted">Pricing your order…</p>
          )}
          {quoteState === "error" && (
            <div role="status" className="flex flex-col gap-2 py-1">
              <p className="text-sm text-ink-muted">{quoteError ?? "We couldn't price your order just now."}</p>
              <Button type="button" variant="outline" shape="pill" size="fluid" onClick={onRefreshQuote} className="self-start bg-surface px-4 py-2 text-sm font-semibold">
                Retry pricing
              </Button>
            </div>
          )}
          {quoteState === "expired" && (
            <div role="status" className="flex flex-col gap-2 py-1">
              <p className="text-sm text-ink-muted">This price snapshot has expired — prices may have changed.</p>
              <Button type="button" variant="outline" shape="pill" size="fluid" onClick={onRefreshQuote} className="self-start bg-surface px-4 py-2 text-sm font-semibold">
                Refresh quote
              </Button>
            </div>
          )}
          {quoteState === "active" && quote && (
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Item subtotal</dt>
                <dd className="tabular text-ink">{formatPaise(quote.subtotalPaise)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Delivery</dt>
                <dd className="tabular text-ink">
                  {quote.deliveryFeePaise === 0 ? "Free" : formatPaise(quote.deliveryFeePaise)}
                </dd>
              </div>
              {quote.deliveryFeePaise > 0 && quote.amountToFreeDeliveryPaise > 0 && (
                <p className="text-xs text-ink-faint">
                  Add {formatPaise(quote.amountToFreeDeliveryPaise)} more for free delivery.
                </p>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Packaging</dt>
                <dd className="tabular text-ink">{quote.packagingPaise === 0 ? "Included" : formatPaise(quote.packagingPaise)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Discount</dt>
                <dd className="tabular text-ink">{quote.discountPaise === 0 ? "—" : `−${formatPaise(quote.discountPaise)}`}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">GST (5% food · 18% delivery)</dt>
                <dd className="tabular text-ink">{formatPaise(quote.taxPaise)}</dd>
              </div>
              <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2">
                <dt className="font-semibold text-ink">Amount payable now</dt>
                <dd className="tabular font-semibold text-gold-text">{formatPaise(quote.payableNowPaise)}</dd>
              </div>
            </dl>
          )}
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
            onChange={(e) => { setPincode(e.target.value); onPincodeChange(e.target.value); }} placeholder="201301"
            aria-invalid={pincode.length > 0 && !pinValid} className={inputCls}
          />
        </div>
      </div>

      {/* Serviceability + timing, from the quote (server-validated — the same
          pincode list POST /orders enforces, the same ETA it promises). */}
      {pinValid && quote?.serviceability && (
        <p role="status" className={`text-xs font-medium ${unserviceable ? "text-[var(--danger)]" : "text-ink-muted"}`}>
          {unserviceable
            ? `We don't deliver to ${quote.serviceability.pincode} yet — currently serving Noida sectors only.`
            : `Delivering to ${quote.serviceability.pincode} · estimated ${quote.etaMinutes} min after payment.`}
        </p>
      )}

      <label className="flex items-start gap-3 text-sm text-ink-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0" />
        <span>
          {DPDP_CONSENT_COPY}
          <span className="mt-1 block text-xs text-ink-faint">{DPDP_SCOPE_NOTE}</span>
        </span>
      </label>

      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}

      <p className="text-center text-[11px] text-ink-faint">
        UPI · FSSAI licensed · RD-reviewed kitchen · you won&rsquo;t be charged until you confirm in the payment step.
      </p>

      {/* Sticky pay bar. The amount is the quote's payable-now — the figure
          the server will bill — never a client-side sum. Anchored bottom-0:
          /checkout lives in the (focus) shell, no global tab bar here. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex max-w-md flex-col gap-1 px-4 py-3">
          {!valid && blockedReason !== null && !busy && (
            <p role="status" className="text-xs font-medium text-ink-muted">{blockedReason}</p>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Payable now</span>
              <span className="tabular text-lg font-bold text-ink">
                {quoteState === "active" && quote ? formatPaise(quote.payableNowPaise) : formatPaise(subtotalPaise(cart))}
                {quoteState !== "active" && <span className="ml-1 text-xs font-medium text-ink-faint">est.</span>}
              </span>
            </div>
            <Button
              type="button" disabled={!valid || busy}
              onClick={() => onSubmit({ line1: line1.trim(), city: city.trim(), pincode: pinDigits })}
              shape="pill" size="fluid" className="px-8 py-3.5 text-center font-semibold disabled:opacity-40"
            >
              {/* Once the modal resolves, money is already captured — "Opening
                  payment…" would read as a hung or failed button on a charge
                  that already went through. */}
              {verifying ? "Confirming your payment…" : busy ? "Opening payment…" : "Continue to payment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
