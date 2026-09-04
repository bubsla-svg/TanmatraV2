"use client";
// Team diet-profile survey (admin). Captures headcount + dietary splits +
// allergens/cuisines/calorie band → the server derives vegPct and stores this as
// the constraint set the planner generates against. Gather-only; server validates.
import { useState } from "react";
import { Field } from "@astryxdesign/core/Field";
import { Grid } from "@astryxdesign/core/Grid";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { ChipInput } from "@/components/account/ChipInput";
import { Button } from "@/components/ui/button";
import { ALLERGEN_OPTIONS, type DietSurveyInput, type TeamDietProfile } from "@/lib/b2bPlannerApi";

type CountKey = "vegCount" | "veganCount" | "glutenFreeCount" | "jainCount" | "halalCount";
const COUNTS: { key: CountKey; label: string }[] = [
  { key: "vegCount", label: "Vegetarian" }, { key: "veganCount", label: "Vegan" },
  { key: "glutenFreeCount", label: "Gluten-free" }, { key: "jainCount", label: "Jain" }, { key: "halalCount", label: "Halal" },
];
const allergenLabel = (a: string) => a.replace(/_/g, " ");

/* Stage-4 Astryx adoption: field chrome only. The hand-rolled −/+ Stepper rows
 * became NumberInput (isIntegerOnly, min/max mirroring the previous clamps —
 * the setter-side clamp logic is kept verbatim as belt-and-braces), the
 * digit-filtered calorie inputs became NumberInput with units="kcal" and
 * hasClear (cleared → null, matching the old empty-string→null semantics —
 * state stays a string so the payload path is untouched), and the notes
 * textarea became TextArea (Astryx maxLength renders a counter but does not
 * enforce, so onChange slices to 1000 to preserve the native cap). KEPT
 * hand-rolled: the allergen aria-pressed toggle pills (designed pill UI —
 * now labelled via Field isGroupLabel + aria-labelledby), the ChipInput
 * cuisines, the derived non-veg readout, the role="alert" error line and the
 * gold Save footer. Payload and submit logic are untouched. */
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
  const asNum = (s: string) => (s.trim() === "" ? null : Number(s));
  const fromNum = (n: number | null) => (n == null ? "" : String(n));

  function submit() {
    onSubmit({
      headcount, vegCount: counts.vegCount, veganCount: counts.veganCount, glutenFreeCount: counts.glutenFreeCount,
      jainCount: counts.jainCount, halalCount: counts.halalCount, allergens, cuisinePrefs: cuisines,
      calorieFloor: num(floor), calorieCeiling: num(ceiling), notes,
    });
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6">
      <NumberInput label="Headcount" value={headcount} isIntegerOnly min={1} max={5000}
        onChange={(n) => setHeadcount(Math.max(1, Math.min(5000, n)))} isRequired />
      <Grid gap={4} columns={{ minWidth: 260 }}>
        {COUNTS.map((f) => (
          <NumberInput key={f.key} label={f.label} value={counts[f.key]} isIntegerOnly min={0} max={headcount}
            onChange={(n) => setCount(f.key, n)} />
        ))}
      </Grid>
      <p className="text-xs text-ink-faint">Non-vegetarian (derived): <span className="font-data font-bold text-primary">{nonVeg}</span></p>

      <Field label="Allergens to avoid" inputID="dp-allergens" labelID="dp-allergens-label" isGroupLabel>
        <ul id="dp-allergens" aria-labelledby="dp-allergens-label" className="flex flex-wrap gap-2">
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
      </Field>

      <ChipInput label="Cuisine preferences" values={cuisines} placeholder="Add a cuisine…" onChange={setCuisines} />

      <Grid gap={4} columns={{ minWidth: 200 }}>
        <NumberInput label="Calorie floor" value={asNum(floor)} isIntegerOnly min={0} units="kcal"
          placeholder="e.g. 400" hasClear onChange={(n) => setFloor(fromNum(n))} isOptional />
        <NumberInput label="Calorie ceiling" value={asNum(ceiling)} isIntegerOnly min={0} units="kcal"
          placeholder="e.g. 800" hasClear onChange={(n) => setCeiling(fromNum(n))} isOptional />
      </Grid>

      <TextArea label="Notes for the kitchen" value={notes} rows={3} maxLength={1000}
        placeholder="Anything else the planner should respect…"
        onChange={(v) => setNotes(v.slice(0, 1000))} isOptional />

      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <Button type="button" disabled={busy} aria-busy={busy} aria-live="polite" onClick={submit} shape="pill" size="fluid" className="w-full px-5 py-3.5 font-semibold disabled:opacity-40">
          {busy ? "Saving…" : "Save team profile"}
        </Button>
        {saved && <span className="text-xs font-medium text-sage-text">Saved</span>}
      </div>
    </div>
  );
}
