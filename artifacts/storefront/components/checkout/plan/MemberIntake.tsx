"use client";
// Client: presentational member-profile inputs (parent owns the draft).
import { useId } from "react";
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
const labelCls = "text-xs font-semibold text-ink-muted";

/** A visible label above its control. These were aria-label + placeholder
 *  only — the label vanished on the first keystroke, on the fields the
 *  kitchen screens against (2026-09-06 audit). */
function Labelled({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

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
  const uid = useId();
  return (
    <div className="flex flex-col gap-3">
      <Labelled id={`${uid}-name`} label="Who's eating?">
        <input id={`${uid}-name`} autoComplete="name" autoCapitalize="words" value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name" className={inputCls} required />
      </Labelled>
      <div className={minimal ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
        {!minimal && (
          <Labelled id={`${uid}-diet`} label="Diet">
          <select id={`${uid}-diet`} value={value.diet} onChange={(e) => set({ diet: e.target.value as MemberDiet })} className={inputCls}>
            {DIETS.map((d) => (<option key={d} value={d}>{d === "any" ? "No preference" : cap(d)}</option>))}
          </select>
          </Labelled>
        )}
        <Labelled id={`${uid}-spice`} label="Spice level">
        <select id={`${uid}-spice`} value={value.spice} onChange={(e) => set({ spice: e.target.value as SpiceLevel })} className={inputCls}>
          {SPICES.map((s) => (<option key={s} value={s}>{cap(s)} spice</option>))}
        </select>
        </Labelled>
      </div>
      {/* Main's placeholder wins over this branch's "Any allergies?" — the
          Law 6 sweep gave it worked examples, which is the better prompt. */}
      <Labelled id={`${uid}-allergens`} label="Allergies (optional) — separate with commas">
        <input id={`${uid}-allergens`} autoComplete="off" value={value.allergens} onChange={(e) => set({ allergens: e.target.value })} placeholder="e.g. peanuts, shellfish" className={inputCls} />
      </Labelled>
      {!minimal && (
        <Labelled id={`${uid}-conditions`} label="Medical conditions (optional) — separate with commas">
          <input id={`${uid}-conditions`} autoComplete="off" value={value.conditions} onChange={(e) => set({ conditions: e.target.value })} placeholder="e.g. diabetes" className={inputCls} />
        </Labelled>
      )}
      <p className="text-xs text-ink-faint">
        Used only to keep unsafe dishes off your plan — stored under the consent below.
      </p>
    </div>
  );
}
