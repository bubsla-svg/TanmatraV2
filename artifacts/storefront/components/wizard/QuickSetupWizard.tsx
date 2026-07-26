"use client";
// Client: interactive 3-step preference wizard with instant plan previews.
import { useState } from "react";
import type { DishData } from "@workspace/menu-catalog";
import { InstantPlanPreview } from "./InstantPlanPreview";

const GOALS = [
  { id: "lose_weight", label: "Fat Loss & Metabolic Reset", desc: "Calorie-controlled volume density" },
  { id: "gain_muscle", label: "Lean Muscle Hypertrophy", desc: "High bioavailable protein (>30g)" },
  { id: "maintenance", label: "Holistic Longevity Care", desc: "Balanced daily macronutrients" },
];

const ALLERGIES = [
  { id: "dairy", label: "Dairy" },
  { id: "gluten", label: "Gluten / Wheat" },
  { id: "nuts", label: "Peanuts & Tree Nuts" },
  { id: "soy", label: "Soy" },
];

const STYLES = [
  { id: "vegetarian", label: "Strictly Vegetarian", type: "style" },
  { id: "omnivore", label: "Omnivore", type: "style" },
  { id: "pcos", label: "PCOS / Insulin Resistance", type: "condition" },
  { id: "diabetes", label: "Type 2 Diabetes / Prediabetes", type: "condition" },
];

export function QuickSetupWizard({ dishes }: { dishes: DishData[] }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [goal, setGoal] = useState("maintenance");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [dietaryStyle, setDietaryStyle] = useState("omnivore");
  const [conditions, setConditions] = useState<string[]>([]);

  const toggleAllergen = (id: string) =>
    setAllergens((p) => (p.includes(id) ? p.filter((i) => i !== id) : [...p, id]));
  const toggleCondition = (id: string) =>
    setConditions((p) => (p.includes(id) ? p.filter((i) => i !== id) : [...p, id]));

  if (step === 4) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-line bg-surface p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Profile Saved</span>
            <p className="text-sm font-medium text-ink mt-1">
              Goal: {goal.replace("_", " ").toUpperCase()} &bull; Style: {dietaryStyle}
            </p>
          </div>
          <button onClick={() => setStep(1)} className="text-xs font-semibold text-gold-text hover:underline uppercase">
            Edit &rarr;
          </button>
        </div>
        <InstantPlanPreview
          dishes={dishes}
          goal={goal}
          allergens={allergens}
          dietaryStyle={dietaryStyle}
          medicalConditions={conditions}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col gap-5 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold uppercase text-ink-muted border-b border-line pb-3">
        <span>Step {step} of 3 &mdash; {step === 1 ? "Goal" : step === 2 ? "Allergens" : "Diet Profile"}</span>
        <div className="flex gap-1">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 w-6 rounded-full ${s <= step ? "bg-gold" : "bg-sage-100"}`} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-3">
          {GOALS.map((g) => (
            <button
              key={g.id}
              onClick={() => setGoal(g.id)}
              className={`rounded-xl border p-4 text-left transition-all ${
                goal === g.id ? "border-gold bg-gold/5 font-medium shadow-sm" : "border-line hover:border-ink/20"
              }`}
            >
              <div className="text-sm font-semibold text-ink">{g.label}</div>
              <div className="text-xs text-ink-muted mt-0.5">{g.desc}</div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-muted">Select dietary allergens our kitchen must strictly omit:</p>
          {ALLERGIES.map((a) => {
            const active = allergens.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggleAllergen(a.id)}
                className={`rounded-xl border p-3.5 flex items-center justify-between text-sm ${
                  active ? "border-gold bg-gold/5 font-medium" : "border-line text-ink-muted hover:border-ink/20"
                }`}
              >
                <span>{a.label}</span>
                <span className="text-xs font-bold text-gold-text">{active ? "Excluding &check;" : "+ Add"}</span>
              </button>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-muted">Select kitchen dietary style and clinical conditions:</p>
          {STYLES.map((c) => {
            const active = c.type === "style" ? dietaryStyle === c.id : conditions.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => (c.type === "style" ? setDietaryStyle(c.id) : toggleCondition(c.id))}
                className={`rounded-xl border p-3.5 flex items-center justify-between text-sm ${
                  active ? "border-gold bg-gold/5 font-medium" : "border-line text-ink-muted hover:border-ink/20"
                }`}
              >
                <span className="text-ink">{c.label}</span>
                <span className="text-xs font-bold text-gold-text">{active ? "Active &check;" : "+ Select"}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
        {step > 1 && (
          <button onClick={() => setStep((step - 1) as any)} className="rounded-xl border border-line px-4 py-2 text-xs text-ink">
            Back
          </button>
        )}
        <button onClick={() => setStep((step + 1) as any)} className="rounded-xl bg-gold px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-gold/90">
          {step === 3 ? "See Customized Menu" : "Continue &rarr;"}
        </button>
      </div>
    </div>
  );
}
