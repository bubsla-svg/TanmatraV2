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
  "w-full min-h-[50px] rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:border-primary";
const DIETS: MemberDiet[] = ["veg", "nonveg", "any"];
const SPICES: SpiceLevel[] = ["mild", "medium", "hot"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function MemberIntake({
  value,
  onChange,
  minimal = false,
}: {
  value: MemberDraft;
  onChange: (next: MemberDraft) => void;
  /**
   * Law 7, for the 3-Day Taste Test: ask for nothing this purchase cannot use.
   *
   * A trial is three FIXED dishes (TRIAL_TRIO), bought one-off, with no day
   * plan and no swaps — so `medicalConditions` reaches nothing that could act
   * on it. Every consumer of that field is a screening path a trial never
   * takes: validateDishForSubscription runs on day-plan submission and on
   * swap, and the storefront's create payload carries no day plan. It was
   * being collected, encrypted as clinical data at rest, and never read.
   *
   * The diet select goes for a different reason (Law 4): /trial already asked
   * veg or non-veg, and that answer is what picks the trio.
   *
   * Allergens STAY. The plan item said to drop them too; that is the one
   * bullet worth refusing. They are safety information about food someone is
   * about to eat, they are the field the kitchen and the later screening paths
   * both key on, and the cost of not having them is borne by the customer, not
   * by us.
   */
  minimal?: boolean;
}) {
  const set = (patch: Partial<MemberDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-3">
      <input aria-label="Who's eating" value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Who's eating? (name)" className={inputCls} />
      <div className={minimal ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
        {!minimal && (
          <select aria-label="Diet" value={value.diet} onChange={(e) => set({ diet: e.target.value as MemberDiet })} className={inputCls}>
            {DIETS.map((d) => (<option key={d} value={d}>{d === "any" ? "No preference" : cap(d)}</option>))}
          </select>
        )}
        <select aria-label="Spice level" value={value.spice} onChange={(e) => set({ spice: e.target.value as SpiceLevel })} className={inputCls}>
          {SPICES.map((s) => (<option key={s} value={s}>{cap(s)} spice</option>))}
        </select>
      </div>
      {/* Main's placeholder wins over this branch's "Any allergies?" — the
          Law 6 sweep gave it worked examples, which is the better prompt. */}
      <input aria-label="Allergens" value={value.allergens} onChange={(e) => set({ allergens: e.target.value })} placeholder="Allergies, e.g. peanuts, shellfish (optional)" className={inputCls} />
      {!minimal && (
        <input aria-label="Medical conditions" value={value.conditions} onChange={(e) => set({ conditions: e.target.value })} placeholder="Conditions, e.g. diabetes (optional)" className={inputCls} />
      )}
      <p className="text-xs text-ink-faint">
        Used only to keep unsafe dishes off your plan — stored under the consent below.
      </p>
    </div>
  );
}
