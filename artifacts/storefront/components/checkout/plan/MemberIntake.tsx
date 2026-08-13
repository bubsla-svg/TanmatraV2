"use client";
// Client: presentational member-profile inputs (parent owns the draft).
import type { MemberDiet, MemberInput, SpiceLevel } from "@/lib/api";

export interface MemberDraft {
  name: string;
  diet: MemberDiet;
  allergens: string; // comma-separated in the UI, split on submit
  conditions: string; // comma-separated in the UI, split on submit
  spice: SpiceLevel;
}

export const EMPTY_MEMBER: MemberDraft = {
  name: "",
  diet: "veg",
  allergens: "",
  conditions: "",
  spice: "medium",
};

/** Split a comma-separated field into a trimmed, non-empty list. */
function list(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

/** Draft → the server's MemberInput (memberInputSchema). */
export function draftToMember(d: MemberDraft): MemberInput {
  return {
    name: d.name.trim(),
    diet: d.diet,
    allergens: list(d.allergens),
    medicalConditions: list(d.conditions),
    spiceLevel: d.spice,
  };
}

const inputCls =
  "w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus-visible:border-line-strong";
const DIETS: MemberDiet[] = ["veg", "nonveg", "any"];
const SPICES: SpiceLevel[] = ["mild", "medium", "hot"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function MemberIntake({
  value,
  onChange,
}: {
  value: MemberDraft;
  onChange: (next: MemberDraft) => void;
}) {
  const set = (patch: Partial<MemberDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-3">
      <input aria-label="Who's eating" value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Who's eating? (name)" className={inputCls} />
      <div className="grid grid-cols-2 gap-3">
        <select aria-label="Diet" value={value.diet} onChange={(e) => set({ diet: e.target.value as MemberDiet })} className={inputCls}>
          {DIETS.map((d) => (<option key={d} value={d}>{d === "any" ? "No preference" : cap(d)}</option>))}
        </select>
        <select aria-label="Spice level" value={value.spice} onChange={(e) => set({ spice: e.target.value as SpiceLevel })} className={inputCls}>
          {SPICES.map((s) => (<option key={s} value={s}>{cap(s)} spice</option>))}
        </select>
      </div>
      <input aria-label="Allergens" value={value.allergens} onChange={(e) => set({ allergens: e.target.value })} placeholder="Allergens, comma-separated (optional)" className={inputCls} />
      <input aria-label="Medical conditions" value={value.conditions} onChange={(e) => set({ conditions: e.target.value })} placeholder="Conditions, e.g. diabetes (optional)" className={inputCls} />
      <p className="text-xs text-ink-faint">
        Used only to keep unsafe dishes off your plan — stored under the consent below.
      </p>
    </div>
  );
}
