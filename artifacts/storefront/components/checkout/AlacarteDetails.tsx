"use client";
// Client: controlled address/consent inputs for the guest money path.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DishData } from "@workspace/menu-catalog";
import { Field } from "@astryxdesign/core/Field";
import { formatPaise } from "@/lib/format";
import { subtotalPaise, type CartState } from "@/lib/cartStore";
import { DPDP_CONSENT_COPY, DPDP_SCOPE_NOTE } from "@/lib/consent";
import { apiGet } from "@/lib/apiClient";
import { flagCartAllergens } from "@/lib/allergenAck";
import { carriedPincode } from "@/lib/serviceabilityApi";
import { readAddressDraft, seedAddressFields } from "@/lib/addressSeed";
import { fetchDeliverySlots } from "@/lib/deliverySlotsApi";
import { isSlotBookable, slotSummary, type DeliverySlot } from "@/lib/deliverySlots";
import type { QuoteSnapshot } from "@/lib/quoteApi";
import type { QuoteUiState } from "./AlacarteCheckout";
import { ADDRESS_DRAFT_KEY } from "./AlacarteCheckout";
import { AllergenAckControl } from "./AllergenAckControl";
import { AlacarteOrderSummary } from "./AlacarteOrderSummary";
import { AlacartePayBar } from "./AlacartePayBar";
import { DeliverySlotPicker } from "./DeliverySlotPicker";
import { KitchenSafetyChip } from "@/components/trust/KitchenSafetySheet";

export interface AlacarteAddress {
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
}

/** What the details step knows beyond the address — a window id the server
 *  offered and a note for the rider. Never a price. */
export interface AlacarteExtras {
  deliverySlotId?: number;
  deliveryInstructions?: string;
}

const inputCls =
  "w-full min-h-[50px] rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:border-primary";
const errCls = "mt-1 block text-xs font-medium text-[var(--danger)]";

/**
 * À-la-carte details (SF-05). Form FIRST, order summary as a disclosure above
 * it (T-09); a "When" step from the server's delivery windows (T-08); every
 * total renders from the server QuoteSnapshot so the amount beside the CTA,
 * the breakdown and the Razorpay charge can never disagree.
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
  initialAddress?: { line1: string; city: string; pincode: string } | null;
  busy: boolean;
  verifying?: boolean;
  error: string | null;
  onSubmit: (address: AlacarteAddress, allergenAck: boolean | undefined, extras: AlacarteExtras) => void;
  quote: QuoteSnapshot | null;
  quoteState: QuoteUiState;
  quoteError: string | null;
  quoteRetryable?: boolean;
  onRefreshQuote: () => void;
  onPincodeChange: (pin: string) => void;
}) {
  const [line1, setLine1] = useState(initialAddress?.line1 ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [pincode, setPincode] = useState(initialAddress?.pincode ?? "");
  const [riderNote, setRiderNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [slot, setSlot] = useState<DeliverySlot | null>(null);
  // T-09: inline field errors appear only after a real attempt (§16.1 —
  // show the error at the moment of the failed action, never proactively).
  const [attempted, setAttempted] = useState(false);
  const [allergenAck, setAllergenAck] = useState(false);
  const [allergenAckTouched, setAllergenAckTouched] = useState(false);
  const allergenAckRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const line1Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<HTMLSelectElement | HTMLDivElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const prefilled = useRef(false);
  const carriedPinRef = useRef("");

  // D-22: a synchronous, non-React-state guard against a fast double-tap
  // landing twice before React commits `disabled`. The server's idempotency
  // key is the money backstop; this stops the wasted duplicate request.
  const submitLockRef = useRef(false);
  useEffect(() => {
    if (!busy) submitLockRef.current = false;
  }, [busy]);

  const menuQuery = useQuery({
    queryKey: ["menu", "public"],
    queryFn: () => apiGet<{ dishes: DishData[] }>("/menu/public"),
  });
  const flaggedAllergens = useMemo(
    () => flagCartAllergens(cart.lines.map((l) => l.dishId), menuQuery.data?.dishes ?? []),
    [cart.lines, menuQuery.data],
  );
  const allergenAckRequired = flaggedAllergens.dishes.length > 0;

  // T-08: the windows the KITCHEN offers. A failed or empty answer means no
  // picker and no gate — the server then books the next open window, as it
  // always has. The client never invents a window.
  const slotsQuery = useQuery({
    queryKey: ["delivery", "slots"],
    queryFn: () => fetchDeliverySlots(),
    staleTime: 60_000,
    retry: 1,
  });
  const openSlots = useMemo(() => {
    const now = new Date();
    return (slotsQuery.data ?? []).filter((s) => isSlotBookable(s, now));
  }, [slotsQuery.data]);
  const slotRequired = openSlots.length > 0;
  // A chosen window that has since closed/filled must not ride into the order.
  useEffect(() => {
    if (slot && !openSlots.some((s) => s.id === slot.id)) setSlot(null);
  }, [openSlots, slot]);
  useEffect(() => {
    if (!slot && openSlots[0]) setSlot(openSlots[0]);
  }, [openSlots, slot]);

  useEffect(() => {
    const carried = carriedPincode();
    carriedPinRef.current = carried;
    const next = seedAddressFields({ line1, city, pincode }, readAddressDraft(ADDRESS_DRAFT_KEY), carried);
    setLine1(next.line1);
    setCity(next.city);
    if (next.pincode !== pincode) {
      setPincode(next.pincode);
      onPincodeChange(next.pincode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (line1 || city || pincode) {
        sessionStorage.setItem(ADDRESS_DRAFT_KEY, JSON.stringify({ line1, city, pincode }));
      }
    } catch {}
  }, [line1, city, pincode]);

  // A saved address may arrive after mount (async sign-in). Seed once, only
  // while the fields are untouched; a carried PIN does not count as typing.
  useEffect(() => {
    if (!initialAddress || prefilled.current) return;
    if (line1 === "" && city === "" && (pincode === "" || pincode === carriedPinRef.current)) {
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
  const line1Valid = line1.trim().length > 2;
  const cityValid = city.trim().length > 1;
  const hasItems = cart.lines.length > 0;
  const unserviceable = quote?.serviceability != null && quote.serviceability.serviceable === false;

  // PR-09 / sweep rule: a blocked money CTA must say WHY, in the order the
  // customer should fix things. `field` names the control the CTA will take
  // them to (T-09); null = a state only the server/quote can change.
  type Blocker = { reason: string; field: React.RefObject<HTMLElement | null> | null };
  const blocker: Blocker | null = !hasItems
    ? { reason: "Your order is empty", field: null }
    : !phoneValid
      ? { reason: "Enter your 10-digit mobile number", field: phoneRef }
      : !line1Valid
        ? { reason: "Complete the delivery address", field: line1Ref }
        : !cityValid
          ? { reason: "Complete the delivery address", field: cityRef }
          : !pinValid
            ? { reason: "Enter a 6-digit PIN code", field: pinRef }
            : slotRequired && !slot
              ? { reason: "Pick a delivery window", field: slotRef }
              : unserviceable
                ? { reason: "We don't deliver to this PIN code yet", field: null }
                : quoteState === "loading"
                  ? { reason: "Pricing your order…", field: null }
                  : quoteState === "expired"
                    ? { reason: "Prices need a refresh — tap Refresh quote above", field: null }
                    : quoteState === "error"
                      ? { reason: "We couldn't price your order — retry above", field: null }
                      : !consent
                        ? { reason: "Accept the order-processing consent to continue", field: consentRef }
                        : null;
  const valid = blocker === null;
  // T-09: the CTA stays tappable whenever the fix is a field the customer
  // can reach — a tap then takes them to it. Only server-side states disable it.
  const ctaEnabled = valid || blocker.field !== null;

  function goTo(ref: React.RefObject<HTMLElement | null>) {
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }

  function handleContinue() {
    if (!valid) {
      setAttempted(true);
      if (blocker.field) goTo(blocker.field);
      return;
    }
    // Click-time allergen gate — kept OUT of `blocker` so a real attempt
    // produces the inline error and moves focus (§16.1), not a dead button.
    if (allergenAckRequired && !allergenAck) {
      setAllergenAckTouched(true);
      goTo(allergenAckRef);
      return;
    }
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    const note = riderNote.trim();
    onSubmit({ line1: line1.trim(), city: city.trim(), pincode: pinDigits }, allergenAck, {
      ...(slot ? { deliverySlotId: slot.id } : {}),
      ...(note ? { deliveryInstructions: note.slice(0, 200) } : {}),
    });
  }

  const amountActive = quoteState === "active" && quote;
  const amountLabel = amountActive ? formatPaise(quote.payableNowPaise) : formatPaise(subtotalPaise(cart));
  const ctaLabel = verifying
    ? "Confirming your payment…"
    : busy
      ? "Opening payment…"
      : amountActive
        ? `Pay ${amountLabel} · UPI / cards`
        : "Continue to payment";
  const now = new Date();

  return (
    <div
      className="flex flex-col gap-4"
      data-ui-generation={verifying ? "stitch-74" : undefined}
      data-screen-id={verifying ? "14.6" : undefined}
      data-screen-state={verifying ? "payment-processing" : undefined}
      data-testid={verifying ? "checkout-payment-processing" : undefined}
    >
      <AlacarteOrderSummary cart={cart} quote={quote} quoteState={quoteState} quoteError={quoteError} quoteRetryable={quoteRetryable} onRefreshQuote={onRefreshQuote} />

      <Field label="Mobile number" inputID="alc-phone">
        <input
          ref={phoneRef}
          id="alc-phone" name="tel" type="tel" inputMode="numeric" autoComplete="tel" enterKeyHint="next" maxLength={14}
          value={phone} onChange={(e) => onPhoneChange(e.target.value)} readOnly={phoneLocked} placeholder="98765 43210"
          aria-invalid={attempted && !phoneValid}
          className={phoneLocked ? `${inputCls} opacity-70` : inputCls}
        />
        {attempted && !phoneValid && <span role="alert" className={errCls}>Enter your 10-digit mobile number.</span>}
      </Field>

      {slotRequired && (
        <div ref={slotRef as React.RefObject<HTMLDivElement | null>} tabIndex={-1} className="outline-none">
          <DeliverySlotPicker slots={openSlots} value={slot} onChange={setSlot} now={now} />
          {attempted && !slot && <span role="alert" className={errCls}>Pick a delivery window.</span>}
        </div>
      )}

      <Field label="Flat / house · street" inputID="alc-line1">
        <input
          ref={line1Ref}
          id="alc-line1" name="street-address" autoComplete="street-address" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next"
          value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Flat 3B, Sector 62"
          aria-invalid={attempted && !line1Valid} className={inputCls}
        />
        {attempted && !line1Valid && <span role="alert" className={errCls}>Add your flat or house and street.</span>}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City" inputID="alc-city">
          <input
            ref={cityRef}
            id="alc-city" name="address-level2" autoComplete="address-level2" autoCapitalize="words" autoCorrect="off" enterKeyHint="next"
            value={city} onChange={(e) => setCity(e.target.value)} placeholder="Noida"
            aria-invalid={attempted && !cityValid} className={inputCls}
          />
          {attempted && !cityValid && <span role="alert" className={errCls}>Add the city.</span>}
        </Field>
        <Field label="PIN code" inputID="alc-pin">
          <input
            ref={pinRef}
            id="alc-pin" name="postal-code" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]*" maxLength={6} enterKeyHint="done"
            value={pincode} onChange={(e) => { setPincode(e.target.value); onPincodeChange(e.target.value); }} placeholder="201301"
            aria-invalid={(pincode.length > 0 || attempted) && !pinValid} className={inputCls}
          />
          {attempted && !pinValid && <span role="alert" className={errCls}>6 digits.</span>}
        </Field>
      </div>
      <Field label="Name or landmark for the rider (optional)" inputID="alc-rider-note">
        <input
          id="alc-rider-note" name="name" autoComplete="name" autoCapitalize="words" enterKeyHint="done" maxLength={200}
          value={riderNote} onChange={(e) => setRiderNote(e.target.value)} placeholder="Priya · gate 2, blue door"
          className={inputCls}
        />
      </Field>

      {pinValid && quote?.serviceability && (
        <p role="status" className={`text-xs font-medium ${unserviceable ? "text-[var(--danger)]" : "text-ink-muted"}`}>
          {unserviceable
            ? `We don't deliver to ${quote.serviceability.pincode} yet — currently serving Noida sectors only.`
            : slot
              ? `Delivering to ${quote.serviceability.pincode} · ${slotSummary(slot, now)}.`
              : `Delivering to ${quote.serviceability.pincode} · estimated ${quote.etaMinutes} min after payment.`}
        </p>
      )}

      {/* Consent block — T-10: a 48px row where the whole label toggles and
          the box is 24px. DPDP first; the allergen ack beside it when the
          cart needs one. */}
      <div className="flex flex-col gap-3">
        <label className="flex min-h-12 w-full cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3 text-sm text-ink-muted">
          <input
            ref={consentRef}
            type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
            aria-invalid={attempted && !consent}
            className="mt-0.5 size-6 shrink-0 cursor-pointer accent-[var(--gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          />
          <span>
            {DPDP_CONSENT_COPY}
            <span className="mt-1 block text-xs text-ink-faint">{DPDP_SCOPE_NOTE}</span>
            {attempted && !consent && <span role="alert" className={errCls}>Tick this to continue — we can&rsquo;t cook without it.</span>}
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

      {/* T-20: the kitchen's credentials one tap away at the money moment —
          replaces an 11px "UPI · FSSAI registered" line nobody could tap. */}
      <div className="flex flex-col items-center gap-1">
        <KitchenSafetyChip />
        <p className="text-center text-xs text-ink-faint">You won&rsquo;t be charged until you confirm in the payment step.</p>
      </div>

      <AlacartePayBar
        amount={amountLabel}
        amountEstimated={!amountActive}
        ctaLabel={ctaLabel}
        blockedReason={blocker?.reason ?? null}
        ctaEnabled={ctaEnabled}
        busy={busy}
        verifying={verifying}
        slotLabel={slot ? slotSummary(slot, now) : null}
        onContinue={handleContinue}
      />
    </div>
  );
}
