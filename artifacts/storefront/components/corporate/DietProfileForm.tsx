"use client";
// Team diet-profile survey (admin). Captures headcount + dietary splits +
// allergens/cuisines/calorie band → the server derives vegPct and stores this as
// the constraint set the planner generates against. Gather-only; server validates.
import { useState } from "react";
import { ChipInput } from "@/components/account/ChipInput";
import { Button } from "@/components/ui/button";
import { ALLERGEN_OPTIONS, type DietSurveyInput, type TeamDietProfile } from "@/lib/b2bPlannerApi";

type CountKey = "vegCount" | "veganCount" | "glutenFreeCount" | "jainCount" | "halalCount";
const COUNTS: { key: CountKey; label: string }[] = [
  { key: "vegCount", label: "Vegetarian" }, { key: "veganCount", label: "Vegan" },
  { key: "glutenFreeCount", label: "Gluten-free" }, { key: "jainCount", label: "Jain" }, { key: "halalCount", label: "Halal" },
];
const allergenLabel = (a: string) => a.replace(/_/g, " ");
const numInput = "rounded-lg border border-line bg-surface px-4 py-3 text-sm font-normal text-ink focus-visible:border-[var(--gold)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold)]";

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex items-center gap-4">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(value - 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-muted hover:border-line-strong hover:text-ink">&minus;</button>
        <span className="tabular w-6 text-center text-sm text-ink">{value}</span>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-muted hover:border-line-strong hover:text-ink">+</button>
      </div>
    </div>
  );
}

export function DietProfileForm({ initial, busy, saved, error, onSubmit }: {
  initial: TeamDietProfile | null; busy: boolean; saved: boolean; error: string | null;
  onSubmit: (input: DietSurveyInput) => void;
}) {
  const c = initial?.constraints;
  const [headcount, setHeadcount] = useState(c?.headcount ?? 10);
  const [counts, setCounts] = useState<Record<CountKey, number>>({
    vegCount: c?.vegCount ?? 0, veganCount: c?.veganCount ?? 0, glutenFreeCount: c?.glutenFreeCount ?? 0,
    jainCount: c?.jainCount ?? 0, halalCount: c?.halalCount ?? 0,
  });
  const [allergens, setAllergens] = useState<string[]>(c?.allergens ?? []);
  const [cuisines, setCuisines] = useState<string[]>(c?.cuisinePrefs ?? []);
  const [floor, setFloor] = useState(c?.calorieFloor != null ? String(c.calorieFloor) : "");
  const [ceiling, setCeiling] = useState(c?.calorieCeiling != null ? String(c.calorieCeiling) : "");
  const [notes, setNotes] = useState(c?.notes ?? "");

  const nonVeg = Math.max(0, headcount - counts.vegCount);
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const setCount = (k: CountKey, n: number) => setCounts((p) => ({ ...p, [k]: Math.max(0, Math.min(headcount, n)) }));
  const digits = (s: string) => s.replace(/[^0-9]/g, "");

  function submit() {
    onSubmit({
      headcount, vegCount: counts.vegCount, veganCount: counts.veganCount, glutenFreeCount: counts.glutenFreeCount,
      jainCount: counts.jainCount, halalCount: counts.halalCount, allergens, cuisinePrefs: cuisines,
      calorieFloor: num(floor), calorieCeiling: num(ceiling), notes,
    });
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-col">
        <Stepper label="Headcount" value={headcount} onChange={(n) => setHeadcount(Math.max(1, Math.min(5000, n)))} />
        {COUNTS.map((f) => <Stepper key={f.key} label={f.label} value={counts[f.key]} onChange={(n) => setCount(f.key, n)} />)}
      </div>
      <p className="text-xs text-ink-faint">Non-vegetarian (derived): <span className="tabular text-ink-muted">{nonVeg}</span></p>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink">Allergens to avoid</p>
        <ul className="flex flex-wrap gap-2">
          {ALLERGEN_OPTIONS.map((a) => {
            const on = allergens.includes(a);
            return (
              <li key={a}>
                <button type="button" aria-pressed={on}
                  onClick={() => setAllergens((p) => (on ? p.filter((x) => x !== a) : [...p, a]))}
                  className={`rounded-full px-4 py-2 text-xs font-medium capitalize transition-colors ${on ? "bg-gold text-[var(--gold-ink)]" : "border border-line text-ink-muted hover:border-line-strong hover:text-ink"}`}>
                  {allergenLabel(a)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <ChipInput label="Cuisine preferences" values={cuisines} placeholder="Add a cuisine…" onChange={setCuisines} />

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-2 text-sm font-semibold text-ink">Calorie floor
          <input inputMode="numeric" value={floor} onChange={(e) => setFloor(digits(e.target.value))} placeholder="e.g. 400" className={numInput} /></label>
        <label className="flex flex-col gap-2 text-sm font-semibold text-ink">Calorie ceiling
          <input inputMode="numeric" value={ceiling} onChange={(e) => setCeiling(digits(e.target.value))} placeholder="e.g. 800" className={numInput} /></label>
      </div>

      <label className="flex flex-col gap-2 text-sm font-semibold text-ink">Notes for the kitchen
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} placeholder="Anything else the planner should respect…" className={`${numInput} resize-none`} /></label>

      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <Button type="button" disabled={busy} onClick={submit} shape="xl" size="fluid" className="w-full px-5 py-3.5 font-semibold disabled:opacity-40">
          {busy ? "Saving…" : "Save team profile"}
        </Button>
        {saved && <span className="text-xs font-medium text-sage-text">Saved</span>}
      </div>
    </div>
  );
}
