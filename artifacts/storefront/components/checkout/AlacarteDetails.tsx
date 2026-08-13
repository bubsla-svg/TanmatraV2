"use client";
// Client: controlled address/consent inputs for the guest money path.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DishData } from "@workspace/menu-catalog";
import { Card } from "@astryxdesign/core/Card";
import { Field } from "@astryxdesign/core/Field";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/format";
import { qtyOf, setQty, subtotalPaise, type CartState } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { DPDP_CONSENT_COPY, DPDP_SCOPE_NOTE } from "@/lib/consent";
import { apiGet } from "@/lib/apiClient";
import { flagCartAllergens } from "@/lib/allergenAck";
import type { QuoteSnapshot } from "@/lib/quoteApi";
import type { QuoteUiState } from "./AlacarteCheckout";
import { ADDRESS_DRAFT_KEY } from "./AlacarteCheckout";
import { AllergenAckControl } from "./AllergenAckControl";
import { QuoteBreakdown } from "./QuoteBreakdown";

export interface AlacarteAddress {
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
}

const inputCls =
  "w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus-visible:border-line-strong";

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
  quoteRetryable,
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
  /** `allergenAck` is true only when the guest explicitly checked the ack
   *  control below — see the allergen-flagged-cart branch under `blockedReason`. */
  onSubmit: (address: AlacarteAddress, allergenAck?: boolean) => void;
  /** Server QuoteSnapshot + lifecycle (parent owns fetching). */
  quote: QuoteSnapshot | null;
  quoteState: QuoteUiState;
  quoteError: string | null;
  /** See QuoteBreakdown — withholds "Retry pricing" on deterministic refusals. */
  quoteRetryable?: boolean;
  onRefreshQuote: () => void;
  onPincodeChange: (pin: string) => void;
}) {
  const [line1, setLine1] = useState(initialAddress?.line1 ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [pincode, setPincode] = useState(initialAddress?.pincode ?? "");
  const [consent, setConsent] = useState(false);
  // A2 / D-19 audit G1: an explicit pre-submit ack for allergen-flagged carts.
  // `touched` gates the inline error — it only appears after a submit attempt
  // finds the box unchecked, never on first render (§16.1 error-focus: show
  // the error at the moment of the failed action, not proactively).
  const [allergenAck, setAllergenAck] = useState(false);
  const [allergenAckTouched, setAllergenAckTouched] = useState(false);
  const allergenAckRef = useRef<HTMLInputElement>(null);
  const prefilled = useRef(false);

  // D-22: a synchronous, non-React-state guard against multi-tap. `busy`
  // (a prop, driven by React state in the parent) already disables the
  // button — but a fast double-tap can fire twice before React commits that
  // disabled attribute to the real DOM node, since the state update is
  // batched and the second click event can land in the same task. A ref
  // mutation is visible to the very next synchronous call, batching or not,
  // so this closes the race `disabled={busy}` alone doesn't. It EXTENDS the
  // existing guard (busy still drives the visible/disabled state) rather
  // than replacing it — the server's own idempotency-key dedup on
  // POST /orders (idempotencyMiddleware, mounted in app.ts) is the actual
  // money-safety backstop either way; this only stops the wasted duplicate
  // requests the audit observed reaching it.
  const submitLockRef = useRef(false);
  useEffect(() => {
    if (!busy) submitLockRef.current = false;
  }, [busy]);

  const { setCart } = useCart();

  // Same public menu the rest of the app reads client-side (ReorderButton,
  // ManageDeliverySheet — shared cache key). Read-only lookup: this never
  // gates the order, only what the ack control shows before submit.
  const menuQuery = useQuery({
    queryKey: ["menu", "public"],
    queryFn: () => apiGet<{ dishes: DishData[] }>("/menu/public"),
  });
  const flaggedAllergens = useMemo(
    () => flagCartAllergens(cart.lines.map((l) => l.dishId), menuQuery.data?.dishes ?? []),
    [cart.lines, menuQuery.data],
  );
  const allergenAckRequired = flaggedAllergens.dishes.length > 0;

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
    // Stitch 14.6 payment-processing, à-la-carte leg — parity with
    // PlanCheckout.tsx:214, which already marks the same state on the plan leg.
    // `verifying` is set the instant Razorpay captures and cleared only when
    // verify resolves, so this marks exactly the window in which the pack
    // requires no active payment control (the CTA is disabled on `busy`).
    <div
      className="flex flex-col gap-4"
      data-ui-generation={verifying ? "stitch-74" : undefined}
      data-screen-id={verifying ? "14.6" : undefined}
      data-screen-state={verifying ? "payment-processing" : undefined}
      data-testid={verifying ? "checkout-payment-processing" : undefined}
    >
      {/* Stage-5 Astryx adoption (payment-form donor, chrome only): the order
          summary is a genuinely discrete unit, so it becomes Card; the address
          fields get Field shells around the SAME native inputs (every one
          carries autoComplete/inputMode/readOnly the Astryx TextInput cannot —
          and alc-* ids + the "Mobile number" label are e2e contracts). Money
          figures, qty steppers, consent, sticky pay bar: untouched. */}
      <Card padding={5} className="rounded-3xl">
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

        <QuoteBreakdown quote={quote} quoteState={quoteState} quoteError={quoteError} quoteRetryable={quoteRetryable} onRefreshQuote={onRefreshQuote} />
      </Card>

      <Field label="Mobile number" inputID="alc-phone">
        <input
          id="alc-phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone}
          onChange={(e) => onPhoneChange(e.target.value)} readOnly={phoneLocked} placeholder="98765 43210"
          className={phoneLocked ? `${inputCls} opacity-70` : inputCls}
        />
      </Field>
      <Field label="Flat / house · street" inputID="alc-line1">
        <input id="alc-line1" autoComplete="street-address" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Flat 3B, Sector 62" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City" inputID="alc-city">
          <input id="alc-city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Noida" className={inputCls} />
        </Field>
        <Field label="PIN code" inputID="alc-pin">
          <input
            id="alc-pin" inputMode="numeric" autoComplete="postal-code" value={pincode}
            onChange={(e) => { setPincode(e.target.value); onPincodeChange(e.target.value); }} placeholder="201301"
            aria-invalid={pincode.length > 0 && !pinValid} className={inputCls}
          />
        </Field>
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

      {/* Consent block — DPDP first (unchanged), the allergen ack beside it
          when the cart actually needs one. Both sit above the sticky ledger. */}
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3 text-sm text-ink-muted">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0" />
          <span>
            {DPDP_CONSENT_COPY}
            <span className="mt-1 block text-xs text-ink-faint">{DPDP_SCOPE_NOTE}</span>
          </span>
        </label>

        {allergenAckRequired && (
          <AllergenAckControl
            flagged={flaggedAllergens}
            checked={allergenAck}
            onCheckedChange={(checked) => {
              setAllergenAck(checked);
              if (checked) setAllergenAckTouched(false);
            }}
            touched={allergenAckTouched}
            inputRef={allergenAckRef}
          />
        )}
      </div>

      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}

      <p className="text-center text-2xs text-ink-faint">
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
              <span className="text-3xs font-bold uppercase tracking-widest text-ink-muted">Payable now</span>
              <span className="tabular text-lg font-bold text-ink">
                {quoteState === "active" && quote ? formatPaise(quote.payableNowPaise) : formatPaise(subtotalPaise(cart))}
                {quoteState !== "active" && <span className="ml-1 text-xs font-medium text-ink-faint">est.</span>}
              </span>
            </div>
            <Button
              type="button" disabled={!valid || busy}
              onClick={() => {
                // Client-side catch for the allergen ack — deliberately NOT
                // folded into `blockedReason`/`valid` above: those disable
                // the button outright, which would make "attempt to submit"
                // unobservable. This stays clickable so a genuine attempt
                // produces the inline error and moves focus to the control
                // that needs it (§16.1 error-focus), instead of the customer
                // discovering it only after the server's 422. Checked before
                // the submit lock below — a blocked-on-ack tap is not a
                // submit attempt and must not consume the one-shot lock.
                if (allergenAckRequired && !allergenAck) {
                  setAllergenAckTouched(true);
                  allergenAckRef.current?.focus();
                  return;
                }
                // Synchronous first — see submitLockRef's comment above.
                if (submitLockRef.current) return;
                submitLockRef.current = true;
                onSubmit({ line1: line1.trim(), city: city.trim(), pincode: pinDigits }, allergenAck);
              }}
              shape="pill" size="fluid"
              // min-w-64: sized to the longest of the three CTA states
              // ("Confirming your payment…") so the button never resizes as
              // the label changes across them — "stable dimensions during
              // loading" (the run of Continue to payment → Opening payment…
              // → Confirming your payment… would otherwise shrink then grow
              // the button, a visible shift right where a customer's thumb
              // already is).
              className="min-w-64 px-8 py-3.5 text-center font-semibold disabled:opacity-40"
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
