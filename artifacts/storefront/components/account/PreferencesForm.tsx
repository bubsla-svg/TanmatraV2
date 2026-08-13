"use client";
// Client: controlled food-preferences editor (taste/goal core). The server
// (routes/preferences.ts) owns validation and lowercases the free-text lists,
// so this only gathers input; the parent re-seeds it from the saved response.
import { useState } from "react";
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

/** route-11 brief: each control sits on its own raised card, gold caps label
 *  above, the value itself set large and unchromed. */
const CARD = "rounded-3xl border border-line bg-surface p-6 transition-colors hover:bg-surface-raised";
const CAPS = "mb-3 block text-xs font-bold uppercase tracking-wider text-gold-text";
const SELECT = "w-full border-none bg-transparent p-0 text-lg text-ink focus-visible:ring-0";

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
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={CARD}>
          <label className={CAPS} htmlFor="pref-dietary">Dietary style</label>
          <select
            id="pref-dietary"
            value={dietaryStyle}
            onChange={(e) => setDietaryStyle(e.target.value as DietaryStyle)}
            className={SELECT}
          >
            {DIETARY.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div className={CARD}>
          <label className={CAPS} htmlFor="pref-goal">Primary goal</label>
          <select
            id="pref-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value as WellnessGoal)}
            className={SELECT}
          >
            {GOAL.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div className={CARD}>
          <label className={CAPS} htmlFor="pref-activity">Activity level</label>
          <select
            id="pref-activity"
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
            className={`${SELECT} tabular`}
          >
            {ACTIVITY.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div className={CARD}>
          <label className={CAPS} htmlFor="pref-spice">Spice tolerance</label>
          <select
            id="pref-spice"
            value={spiceLevel}
            onChange={(e) => setSpiceLevel(e.target.value as SpiceLevel)}
            className={SELECT}
          >
            {SPICE.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-6">
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
          onClick={() => onSubmit({ dietaryStyle, goal, activityLevel, spiceLevel, allergens, dislikedIngredients: disliked, cuisines })}
          shape="pill" size="fluid" className="w-full py-5 text-xs font-bold uppercase tracking-wider disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save preferences"}
        </Button>
        {saved && <span className="text-xs font-medium text-sage-text">Saved</span>}
      </div>
    </div>
  );
}
