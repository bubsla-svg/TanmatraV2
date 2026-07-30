"use client";
// Client: controlled add/edit form for a saved address.
import { useState } from "react";
import type { Address, AddressInput, AddressType } from "@/lib/api";

const inputCls =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus:border-line-strong";
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
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Address>;
  busy: boolean;
  error: string | null;
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

  const pinValid = /^[0-9]{4,10}$/.test(pincode.trim());
  const phoneValid = phone.replace(/\D/g, "").length >= 10;
  const valid =
    label.trim().length > 0 && line1.trim().length > 2 && city.trim().length > 0 && pinValid && phoneValid;

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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <input aria-label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home, Office…" className={inputCls} />
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as AddressType)} className={inputCls}>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>
      <input aria-label="Flat / house · street" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Flat 3B, Sector 62" className={inputCls} />
      <input aria-label="Landmark / area (optional)" value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Near the park (optional)" className={inputCls} />
      <div className="grid grid-cols-2 gap-3">
        <input aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Noida" className={inputCls} />
        <input aria-label="PIN code" inputMode="numeric" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="201301" aria-invalid={pincode.length > 0 && !pinValid} className={inputCls} />
      </div>
      <input aria-label="Phone" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" className={inputCls} />
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      <div className="mt-1 flex items-center gap-3 border-t border-line pt-3">
        <button type="button" disabled={!valid || busy} onClick={submit} className="rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-40">
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="-m-2 p-2 text-sm font-medium text-ink-muted hover:underline">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
