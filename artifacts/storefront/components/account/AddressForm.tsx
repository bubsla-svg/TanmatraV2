"use client";
// Client: controlled add/edit form for a saved address.
import { useId, useState } from "react";
import { Grid } from "@astryxdesign/core/Grid";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Field } from "@astryxdesign/core/Field";
import { Button } from "@/components/ui/button";
import { NotifyMeForm } from "@/components/onboarding/NotifyMeForm";
import type { Address, AddressInput, AddressType } from "@/lib/api";

/* Stage-4 Astryx adoption: field chrome only. The aria-label'd raw inputs
 * became TextInput/Selector with VISIBLE labels (a strict a11y upgrade over
 * the aria-label hack), and the two `grid-cols-2` pair rows became Grid
 * columns={{minWidth}} which collapses responsively for free. PIN and PHONE
 * stay native <input>s inside Astryx Field: TextInput's BaseProps deliberately
 * omit inputMode (and type is text|password|email only), so a swap would cost
 * the numeric keyboard. The PIN keeps its existing aria-invalid signalling —
 * no message box existed before and none is added. Submission payload, the
 * client-side valid gate, busy label, Cancel link, the role="alert" error
 * line, and the unserviceable-pincode panel (with its data-ui-generation /
 * data-screen-* attributes) are untouched. */
const nativeInputCls =
  "w-full min-h-[50px] rounded-2xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:border-primary";
const TYPES: AddressType[] = ["home", "work", "other"];

/**
 * SF-04 add/edit form. Reused for create (no `initial`) and edit (seeded from
 * the row). Mirrors the server contract (userAddresses.ts): label, type,
 * line1/line2, city, pincode, phone, default. The server re-validates and owns
 * serviceability (422) — this only blocks obviously-incomplete input.
 */
export function AddressForm({
  initial,
  busy,
  error,
  unserviceablePincode,
  onDismissUnserviceable,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Address>;
  busy: boolean;
  error: string | null;
  /** Set when the server just rejected this exact form's submission with
   *  422 unserviceable_pincode. Distinct from `error` (a generic failure
   *  string) because this is a FACT about the address, not something that
   *  went wrong — it gets its own why/next-step panel instead of a plain
   *  red-text line (Invariant 18: unavailable actions explain why and what
   *  the customer can do next). */
  unserviceablePincode?: string | null;
  /** Return from the unserviceable panel to the editable form fields
   *  (which stayed populated — the component never unmounted). */
  onDismissUnserviceable?: () => void;
  submitLabel: string;
  onSubmit: (value: AddressInput) => void;
  onCancel?: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [type, setType] = useState<AddressType>(initial?.type ?? "home");
  const [line1, setLine1] = useState(initial?.line1 ?? "");
  const [line2, setLine2] = useState(initial?.line2 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [pincode, setPincode] = useState(initial?.pincode ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const pincodeID = useId();
  const phoneID = useId();

  const pinValid = /^[0-9]{4,10}$/.test(pincode.trim());
  const phoneValid = phone.replace(/\D/g, "").length >= 10;
  // Fix-first status line (AlacarteDetails.tsx's blockedReason idiom) — the
  // PIN field already carries aria-invalid, but nothing explained why the
  // save button stayed dead. Order matches field order.
  const blockedReason =
    label.trim().length === 0
      ? "Add a label for this address"
      : line1.trim().length <= 2
        ? "Enter your flat / house and street"
        : city.trim().length === 0
          ? "Enter your city"
          : !pinValid
            ? "Enter a valid PIN code"
            : !phoneValid
              ? "Enter a valid 10-digit phone number"
              : null;
  const valid = blockedReason === null;

  function submit() {
    onSubmit({
      label: label.trim(),
      type,
      line1: line1.trim(),
      line2: line2.trim() || null,
      city: city.trim(),
      pincode: pincode.trim(),
      phone: phone.trim(),
    });
  }

  if (unserviceablePincode) {
    return (
      <div data-ui-generation="stitch-74" data-screen-id="14.5" data-screen-state="unserviceable-address" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <div>
          <p className="font-display text-lg font-semibold leading-tight text-primary">
            We don&rsquo;t deliver to {unserviceablePincode} yet
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Tanmatra currently cooks and delivers across Noida only (including Greater Noida
            sectors) — Ghaziabad, Delhi and Gurgaon aren&rsquo;t served yet.
          </p>
        </div>
        <NotifyMeForm pincode={unserviceablePincode} onReset={() => onDismissUnserviceable?.()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <Grid gap={4} columns={{ minWidth: 200 }}>
        <TextInput
          label="Label"
          value={label}
          onChange={setLabel}
          placeholder="Home, Office…"
        />
        <Selector
          label="Type"
          value={type}
          onChange={(v) => setType(v as AddressType)}
          options={TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
        />
      </Grid>
      <TextInput
        label="Flat / house · street"
        value={line1}
        onChange={setLine1}
        placeholder="Flat 3B, Sector 62"
        htmlName="address-line1"
      />
      <TextInput
        label="Landmark / area"
        value={line2}
        onChange={setLine2}
        placeholder="Near the park (optional)"
        htmlName="address-line2"
        isOptional
      />
      <Grid gap={4} columns={{ minWidth: 200 }}>
        <TextInput
          label="City"
          value={city}
          onChange={setCity}
          placeholder="Noida"
          htmlName="address-level2"
        />
        <Field label="PIN code" inputID={pincodeID}>
          <input
            id={pincodeID}
            inputMode="numeric"
            autoComplete="postal-code"
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            placeholder="201301"
            aria-invalid={pincode.length > 0 && !pinValid}
            className={nativeInputCls}
          />
        </Field>
      </Grid>
      <Field label="Phone" inputID={phoneID}>
        <input
          id={phoneID}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="98765 43210"
          className={nativeInputCls}
        />
      </Field>
      {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
      {blockedReason !== null && !busy && (
        <p role="status" className="text-xs font-medium text-ink-muted">{blockedReason}</p>
      )}
      <div className="mt-1 flex items-center gap-3 border-t border-line pt-3">
        <Button type="button" disabled={!valid || busy} aria-busy={busy} aria-live="polite" onClick={submit} shape="pill" size="fluid" className="min-h-12 px-6 py-3 font-semibold disabled:opacity-40">
          {busy ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-ink-muted underline-offset-4 hover:underline">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
