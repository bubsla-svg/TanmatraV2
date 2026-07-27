"use client";
// Client: the plan details step — track, eater profile, address, consent.
import { useEffect, useRef, useState } from "react";
import type { DietTrack, MemberInput } from "@/lib/api";
import { formatPaise } from "@/lib/format";
import { DPDP_CONSENT_COPY } from "@/lib/consent";
import type { PlanCheckoutAddress } from "@/lib/planCheckout";
import { MemberIntake, EMPTY_MEMBER, draftToMember, type MemberDraft } from "./MemberIntake";
import { LocationPickerFlow } from "@/components/address/LocationPickerFlow";

const inputCls =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus:border-line-strong";
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
  addOnLine,
  creditAppliedPaise,
  initialAddress,
  finePrint,
  busy,
  error,
  onSubmit,
}: {
  servedTracks: DietTrack[];
  track: DietTrack;
  onTrackChange: (t: DietTrack) => void;
  quoteTotalPaise: number | null;
  quoteLoading: boolean;
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
  error: string | null;
  onSubmit: (value: PlanDetailsValue) => void;
}) {
  const [member, setMember] = useState<MemberDraft>(EMPTY_MEMBER);
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
              className={`rounded-xl border px-4 py-2 text-sm font-medium ${t === track ? "border-gold bg-gold text-[var(--gold-ink)]" : "border-line text-ink-muted"}`}
            >
              {TRACK_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <MemberIntake value={member} onChange={setMember} />

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-ink">Where should we deliver?</span>
        {!manualMode ? (
          <button
            type="button"
            onClick={() => setShowLocationPicker(true)}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm text-ink shadow-sm transition-colors hover:border-line-strong"
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

      <div className="flex flex-col gap-1 rounded-xl bg-surface px-4 py-3">
        {addOnLine && <p className="text-xs font-medium text-ink-muted">{addOnLine}</p>}
        {!!creditAppliedPaise && (
          <p className="text-xs font-medium text-sage-text">
            Credit applied: −{formatPaise(creditAppliedPaise)}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Billed each cycle (server-priced, incl. GST)</span>
          <span className="tabular text-lg font-semibold text-ink">
            {quoteLoading || quoteTotalPaise === null ? "…" : formatPaise(quoteTotalPaise)}
          </span>
        </div>
      </div>

      {finePrint && finePrint.length > 0 && (
        <div className="flex flex-col gap-1">
          {finePrint.map((line) => (
            <p key={line} className="text-xs leading-relaxed text-ink-muted">{line}</p>
          ))}
        </div>
      )}

      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}

      <button
        type="button" disabled={!valid || busy}
        onClick={() => onSubmit({ member: draftToMember(member), address: { line1: line1.trim(), city: city.trim(), pincode: pincode.replace(/\D/g, "") } })}
        className="rounded-xl bg-gold px-5 py-4 text-center text-base font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "Opening payment…" : "Continue to payment"}
      </button>
    </div>
  );
}
