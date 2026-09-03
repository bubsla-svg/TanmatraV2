"use client";
// Client: controlled food-preferences editor (taste/goal core). The server
// (routes/preferences.ts) owns validation and lowercases the free-text lists,
// so this only gathers input; the parent re-seeds it from the saved response.
import { useState } from "react";
import { Grid } from "@astryxdesign/core/Grid";
import { Selector } from "@astryxdesign/core/Selector";
import { Button } from "@/components/ui/button";
import { ChipInput } from "./ChipInput";
import type {
  ActivityLevel,
  DietaryStyle,
  PreferencesPatch,
  SpiceLevel,
  UserPreferences,
  WellnessGoal,
} from "@/lib/preferencesApi";

const DIETARY: { id: DietaryStyle; label: string }[] = [
  { id: "omnivore", label: "Omnivore" }, { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" }, { id: "pescatarian", label: "Pescatarian" }, { id: "keto", label: "Keto" },
];
const GOAL: { id: WellnessGoal; label: string }[] = [
  { id: "lose_weight", label: "Lose weight" }, { id: "maintain", label: "Maintain" },
  { id: "gain_muscle", label: "Gain muscle" }, { id: "general_wellness", label: "General wellness" },
];
const ACTIVITY: { id: ActivityLevel; label: string }[] = [
  { id: "sedentary", label: "Sedentary" }, { id: "light", label: "Light" }, { id: "moderate", label: "Moderate" },
  { id: "active", label: "Active" }, { id: "very_active", label: "Very active" },
];
const SPICE: { id: SpiceLevel; label: string }[] = [
  { id: "none", label: "None" }, { id: "mild", label: "Mild" }, { id: "medium", label: "Medium" }, { id: "hot", label: "Hot" },
];

/* Stage-4 Astryx adoption: field chrome only. The four raised-card native
 * <select>s (route-11 gold caps label + large unchromed value) became Astryx
 * Selector, each still sitting on its raised card so the surface rhythm with
 * the chip cards holds; the hand-rolled `grid md:grid-cols-2` became Astryx
 * Grid columns={{minWidth}}. Selector renders its own label + Field shell, so
 * the CAPS/SELECT class strings are gone. DELIBERATELY KEPT: the three
 * ChipInput cards stay hand-rolled as-is — ChipInput renders its own <label>
 * wrapper with an internal gold-caps label span, so wrapping it in Astryx
 * Field (isGroupLabel) from this file would double the visible label and the
 * chip group can't receive aria-labelledby without editing ChipInput itself.
 * State shape, PreferencesPatch payload, role="alert" error line, saved sage
 * indicator and the Save pill button are untouched. */
const CARD = "rounded-2xl border border-line bg-surface p-5";

export function PreferencesForm({
  initial,
  busy,
  error,
  saved,
  onSubmit,
}: {
  initial: UserPreferences | null;
  busy: boolean;
  error: string | null;
  saved: boolean;
  onSubmit: (patch: PreferencesPatch) => void;
}) {
  const [dietaryStyle, setDietaryStyle] = useState<DietaryStyle>(initial?.dietaryStyle ?? "omnivore");
  const [goal, setGoal] = useState<WellnessGoal>(initial?.goal ?? "general_wellness");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(initial?.activityLevel ?? "moderate");
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>(initial?.spiceLevel ?? "medium");
  const [allergens, setAllergens] = useState<string[]>(initial?.allergens ?? []);
  const [disliked, setDisliked] = useState<string[]>(initial?.dislikedIngredients ?? []);
  const [cuisines, setCuisines] = useState<string[]>(initial?.cuisines ?? []);

  return (
    <div className="flex flex-col gap-5">
      <Grid gap={4} columns={{ minWidth: 260 }}>
        <div className={CARD}>
          <Selector
            label="Dietary style"
            value={dietaryStyle}
            onChange={(v) => setDietaryStyle(v as DietaryStyle)}
            options={DIETARY.map((o) => ({ value: o.id, label: o.label }))}
          />
        </div>
        <div className={CARD}>
          <Selector
            label="Primary goal"
            value={goal}
            onChange={(v) => setGoal(v as WellnessGoal)}
            options={GOAL.map((o) => ({ value: o.id, label: o.label }))}
          />
        </div>
        <div className={CARD}>
          <Selector
            label="Activity level"
            value={activityLevel}
            onChange={(v) => setActivityLevel(v as ActivityLevel)}
            options={ACTIVITY.map((o) => ({ value: o.id, label: o.label }))}
          />
        </div>
        <div className={CARD}>
          <Selector
            label="Spice tolerance"
            value={spiceLevel}
            onChange={(v) => setSpiceLevel(v as SpiceLevel)}
            options={SPICE.map((o) => ({ value: o.id, label: o.label }))}
          />
        </div>
      </Grid>

      <div className="flex flex-col gap-4">
        <div className={CARD}>
          <ChipInput label="Allergens" tone="signal" values={allergens} placeholder="Add an allergen…" onChange={setAllergens} />
        </div>
        <div className={CARD}>
          <ChipInput label="Ingredients you dislike" values={disliked} placeholder="Add an ingredient…" onChange={setDisliked} />
        </div>
        <div className={CARD}>
          <ChipInput label="Preferred cuisines" values={cuisines} placeholder="Add a cuisine…" onChange={setCuisines} />
        </div>
      </div>

      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}

      <div className="flex flex-col items-center gap-3">
        <Button
          type="button"
          disabled={busy}
          aria-busy={busy}
          aria-live="polite"
          onClick={() => onSubmit({ dietaryStyle, goal, activityLevel, spiceLevel, allergens, dislikedIngredients: disliked, cuisines })}
          shape="pill" size="fluid" className="min-h-12 w-full px-8 py-3.5 text-center font-semibold disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save preferences"}
        </Button>
        {saved && <span className="text-xs font-medium text-sage-text">Saved</span>}
      </div>
    </div>
  );
}
