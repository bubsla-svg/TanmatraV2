"use client";
// Client: controlled food-preferences editor (taste/goal core). The server
// (routes/preferences.ts) owns validation and lowercases the free-text lists,
// so this only gathers input; the parent re-seeds it from the saved response.
import { useState } from "react";
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
const selectCls = "rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink";

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
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Dietary style
        <select value={dietaryStyle} onChange={(e) => setDietaryStyle(e.target.value as DietaryStyle)} className={selectCls}>
          {DIETARY.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Goal
        <select value={goal} onChange={(e) => setGoal(e.target.value as WellnessGoal)} className={selectCls}>
          {GOAL.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Activity level
        <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)} className={selectCls}>
          {ACTIVITY.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Spice level
        <select value={spiceLevel} onChange={(e) => setSpiceLevel(e.target.value as SpiceLevel)} className={selectCls}>
          {SPICE.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <ChipInput label="Allergens" values={allergens} placeholder="Add an allergen…" onChange={setAllergens} />
      <ChipInput label="Ingredients you dislike" values={disliked} placeholder="Add an ingredient…" onChange={setDisliked} />
      <ChipInput label="Preferred cuisines" values={cuisines} placeholder="Add a cuisine…" onChange={setCuisines} />
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button" disabled={busy}
          onClick={() => onSubmit({ dietaryStyle, goal, activityLevel, spiceLevel, allergens, dislikedIngredients: disliked, cuisines })}
          className="self-start rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save preferences"}
        </button>
        {saved && <span className="text-xs font-medium text-sage-text">Saved</span>}
      </div>
    </div>
  );
}
