"use client";
// Client: the plan details step — track, eater profile, address, consent.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DietTrack, MemberInput } from "@/lib/api";
import { formatPaise } from "@/lib/format";
import { DPDP_CONSENT_COPY } from "@/lib/consent";
import type { PlanCheckoutAddress } from "@/lib/planCheckout";
import { MemberIntake, EMPTY_MEMBER, draftToMember, type MemberDraft } from "./MemberIntake";
import { memberDietForTrack } from "@/lib/planCheckout";
import { LocationPickerFlow } from "@/components/address/LocationPickerFlow";

const inputCls =
  "w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus-visible:border-line-strong";
const TRACK_LABEL: Record<DietTrack, string> = { veg: "Vegetarian", egg: "Egg", nonveg: "Non-veg" };

export interface PlanDetailsValue {
  member: MemberInput;
  address: PlanCheckoutAddress;
}

export function PlanDetails({
  servedTracks,
  track,
  onTrackChange,
  quoteTotalPaise,
  quoteLoading,
  quoteError,
  onRetryQuote,
  addOnLine,
  creditAppliedPaise,
  initialAddress,
  finePrint,
  busy,
  verifying,
  error,
  onSubmit,
  minimalIntake = false,
}: {
  servedTracks: DietTrack[];
  track: DietTrack;
  onTrackChange: (t: DietTrack) => void;
  quoteTotalPaise: number | null;
  quoteLoading: boolean;
  /** True when the last quote fetch failed. A silently-swallowed quote error
   *  left this screen showing an ellipsis and a permanently disabled button —
   *  a dead end with no explanation on the purchase path. */
  quoteError?: boolean;
  onRetryQuote?: () => void;
  /** The quote's billed add-on line ("Your dietitian · +₹499/mo") — the
   *  SERVER's priced items, shown so the total is never a surprise. */
  addOnLine?: string | null;
  /** Credit-ledger balance already netted OUT of quoteTotalPaise (see
   *  usePlanQuote) — shown as its own line so the discount is never silent. */
  creditAppliedPaise?: number;
  initialAddress?: { line1: string; city: string; pincode: string } | null;
  /** Offer terms stated under the total (spine copy — e.g. trial creditback +
   *  no-auto-renew). Never a price of its own. */
  finePrint?: string[];
  busy: boolean;
  /** True once Razorpay has captured the money and verify is retrying — the
   *  CTA copy must say so; "Opening payment…" after the modal already closed
   *  reads as a stuck/failed button on money the customer already paid. */
  verifying?: boolean;
  error: string | null;
  onSubmit: (value: PlanDetailsValue) => void;
  /** Law 7 — the 3-Day Taste Test asks for nothing it cannot use. See
   *  MemberIntake's `minimal` for what is dropped and why allergens are not. */
  minimalIntake?: boolean;
}) {
  const [member, setMember] = useState<MemberDraft>(EMPTY_MEMBER);
  // With the diet select hidden (minimal intake), the draft's own default must
  // not be what gets submitted: /trial already asked veg or non-veg, and that
  // answer is what picked the trio. Deriving it from the track is the Law 4
  // carry — and it also fixes the pre-existing mismatch where a non-veg buyer
  // who never touched the select submitted `diet: "veg"` beside a nonveg track.
  // `conditions` is blanked rather than trusted: nothing collects it here, so
  // nothing should be able to reach the wire from a stale draft.
  const submittedMember: MemberDraft = minimalIntake
    ? { ...member, diet: memberDietForTrack(track), conditions: "" }
    : member;
  const [line1, setLine1] = useState(initialAddress?.line1 ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [pincode, setPincode] = useState(initialAddress?.pincode ?? "");
  const [consent, setConsent] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const prefilled = useRef(false);
  const touched = useRef(false);

  // Seed the address once from a saved default (arrives async after sign-in),
  // but never once the user has touched a field — no clobber of typed input,
  // even the type-then-clear case a value-based guard would miss.
  useEffect(() => {
    if (!initialAddress || prefilled.current || touched.current) return;
    prefilled.current = true;
    setLine1(initialAddress.line1);
    setCity(initialAddress.city);
    setPincode(initialAddress.pincode);
  }, [initialAddress]);

  const pinValid = pincode.replace(/\D/g, "").length === 6;
  // Gate on a landed quote too: the CTA must never submit while a track change
  // is re-quoting (else the new track pairs with the old meals-per-delivery).
  const valid =
    quoteTotalPaise !== null &&
    member.name.trim().length > 0 && line1.trim().length > 2 && city.trim().length > 1 && pinValid && consent;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Which track?</span>
        <div className="flex flex-wrap gap-2">
          {servedTracks.map((t) => (
            <button
              key={t} type="button" onClick={() => onTrackChange(t)} aria-pressed={t === track}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors active:scale-[0.98] ${t === track ? "border-gold bg-surface-raised text-gold-text" : "border-line bg-surface text-ink-muted"}`}
            >
              {TRACK_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <MemberIntake value={member} onChange={setMember} minimal={minimalIntake} />

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-ink">Where should we deliver?</span>
        {!manualMode ? (
          <button
            type="button"
            onClick={() => setShowLocationPicker(true)}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left text-sm text-ink shadow-sm transition-colors hover:border-line-strong active:scale-[0.98]"
          >
            <svg className="h-5 w-5 shrink-0 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="flex-1 truncate font-semibold text-ink-muted">
              {line1 ? `${line1} ${city} ${pincode}` : "Select your location"}
            </span>
            <span className="shrink-0 text-xs font-bold text-gold">MAP</span>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <input aria-label="Flat / house · street" value={line1} onChange={(e) => { touched.current = true; setLine1(e.target.value); }} placeholder="Flat 3B, Sector 62" className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <input aria-label="City" value={city} onChange={(e) => { touched.current = true; setCity(e.target.value); }} placeholder="Noida" className={inputCls} />
              <input aria-label="PIN code" inputMode="numeric" value={pincode} onChange={(e) => { touched.current = true; setPincode(e.target.value); }} placeholder="201301" aria-invalid={pincode.length > 0 && !pinValid} className={inputCls} />
            </div>
            <button type="button" onClick={() => setManualMode(false)} className="self-start text-xs font-medium text-ink-muted underline hover:text-ink">
              Use map instead
            </button>
          </div>
        )}
      </div>

      {showLocationPicker && (
        <LocationPickerFlow
          onClose={() => setShowLocationPicker(false)}
          onSelectLocation={(place) => {
            setShowLocationPicker(false);
            if (place.formattedAddress) setLine1(place.formattedAddress);
            if (place.city) setCity(place.city);
            if (place.pincode) setPincode(place.pincode);
            touched.current = true;
          }}
          onManualFallback={() => {
            setShowLocationPicker(false);
            setManualMode(true);
          }}
        />
      )}

      <label className="flex items-start gap-3 text-sm text-ink-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0" />
        <span>{DPDP_CONSENT_COPY}</span>
      </label>

      <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5">
        {addOnLine && <p className="tabular text-xs font-medium text-ink-muted">{addOnLine}</p>}
        {!!creditAppliedPaise && (
          <p className="flex items-baseline justify-between gap-3 border-y border-line py-2 text-xs font-medium text-sage-text">
            <span>Credit applied:</span>
            <span className="tabular">−{formatPaise(creditAppliedPaise)}</span>
          </p>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-ink-muted">Billed each cycle (server-priced, incl. GST)</span>
          <span className="tabular text-xl font-semibold text-gold-text">
            {quoteLoading || quoteTotalPaise === null ? "…" : formatPaise(quoteTotalPaise)}
          </span>
        </div>
        {quoteError && (
          <p role="alert" className="flex items-center justify-between gap-3 text-xs font-medium text-[var(--danger)]">
            <span>Couldn&rsquo;t fetch the price.</span>
            <button
              type="button"
              onClick={onRetryQuote}
              className="shrink-0 rounded-lg border border-[var(--danger)]/40 px-2.5 py-1 font-semibold underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </p>
        )}
      </div>

      {finePrint && finePrint.length > 0 && (
        <div className="flex flex-col gap-1">
          {finePrint.map((line) => (
            <p key={line} className="text-xs leading-relaxed text-ink-muted">{line}</p>
          ))}
        </div>
      )}

      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}

      {/* Sticky quote + Continue bar (same glass pattern as the dish buy
          bar). The amount is the SERVER's quote rendered verbatim; the CTA
          keeps its existing disabled-until-quote gating (`valid` above).
          Anchored bottom-0, not the bottom-16 tab-bar band: /checkout is a
          (focus)-shell route (app/(focus)/) — the global tab bar never renders
          here. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-3xs font-bold uppercase tracking-widest text-ink-muted">Billed each cycle</span>
              <span className="tabular text-lg font-bold text-ink">
                {quoteLoading || quoteTotalPaise === null ? "…" : formatPaise(quoteTotalPaise)}
              </span>
            </div>
            <Button
              type="button" disabled={!valid || busy}
              onClick={() => onSubmit({ member: draftToMember(submittedMember), address: { line1: line1.trim(), city: city.trim(), pincode: pincode.replace(/\D/g, "") } })}
              aria-busy={verifying || busy} aria-live="polite"
              shape="pill" size="fluid" className="px-8 py-3.5 text-center font-semibold disabled:opacity-40 shadow-lg shadow-gold/20 transition-transform duration-300 hover:scale-[1.02] hover:shadow-gold/40 active:scale-95"
            >
              {/* Once the modal resolves, money is already captured — "Opening
                  payment…" would read as a hung or failed button on a charge
                  that already went through. */}
              {verifying ? "Confirming your payment…" : busy ? "Opening payment…" : "Continue to payment"}
            </Button>
          </div>
          {/* Was a THIRD flex column inside the row above — `mt-3` inside
              items-center did nothing and the trust line rendered squeezed
              beside the CTA. It belongs under the row, centred, vouching for
              the button it sits beneath (N5.10's counterpart: the trust claim
              lives at the pay action, not on the OTP step's header). */}
          <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-ink-muted">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-ink-muted" aria-hidden>
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
            </svg>
            Secure, encrypted checkout
          </div>
        </div>
      </div>
    </div>
  );
}
