"use client";
// Client: interactive 3-step preference wizard with instant plan previews.
// On step 3 -> step 4, goal/allergens/dietary style are persisted to the real
// preferences surface (lib/preferencesApi). Auth-gated like every other island
// in this app: a 401 on save renders <PhoneAuth> inline and retries the same
// save — it never redirects, and steps 1-3 stay usable with zero auth
// friction. Clinical conditions (step 3's PCOS / Type 2 Diabetes checkboxes)
// stay LOCAL-ONLY: they still drive the live preview below, but conditions
// are clinical/PHI data that belongs to the separate consent-gated
// /account/health-information surface, never this PATCH.
import { useState } from "react";
import Link from "next/link";
import type { DishData } from "@workspace/menu-catalog";
import { InstantPlanPreview } from "./InstantPlanPreview";
import { ApiError } from "@/lib/apiClient";
import { savePreferences, type DietaryStyle, type WellnessGoal } from "@/lib/preferencesApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

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

/** Local goal ids match the wire WellnessGoal verbatim except "maintenance",
 *  whose wire value is "maintain". */
function toWireGoal(id: string): WellnessGoal {
  return id === "maintenance" ? "maintain" : (id as WellnessGoal);
}

type SaveState = "idle" | "busy" | "saved" | "needsAuth" | "error";

export function QuickSetupWizard({ dishes }: { dishes: DishData[] }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [goal, setGoal] = useState("maintenance");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [dietaryStyle, setDietaryStyle] = useState("omnivore");
  const [conditions, setConditions] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggleAllergen = (id: string) =>
    setAllergens((p) => (p.includes(id) ? p.filter((i) => i !== id) : [...p, id]));
  const toggleCondition = (id: string) =>
    setConditions((p) => (p.includes(id) ? p.filter((i) => i !== id) : [...p, id]));

  async function attemptSave() {
    setSaveState("busy");
    setSaveError(null);
    try {
      await savePreferences({
        goal: toWireGoal(goal),
        allergens,
        dietaryStyle: dietaryStyle as DietaryStyle,
      });
      setSaveState("saved");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setSaveState("needsAuth");
        return;
      }
      setSaveState("error");
      setSaveError(
        e instanceof ApiError ? e.message : "Couldn't save your profile — you can still see your matches below.",
      );
    }
  }

  function handleContinue() {
    if (step === 3) {
      setStep(4);
      void attemptSave();
      return;
    }
    setStep((step + 1) as 1 | 2 | 3 | 4);
  }

  if (step === 4) {
    const heading =
      saveState === "saved"
        ? "Profile Saved"
        : saveState === "needsAuth"
          ? "Sign In to Save Your Profile"
          : saveState === "error"
            ? "Profile Not Saved"
            : "Saving your profile…";

    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">{heading}</span>
              <p className="text-sm font-medium text-ink mt-1">
                Goal: {goal.replace("_", " ").toUpperCase()} &bull; Style: {dietaryStyle}
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-gold-text hover:underline uppercase shrink-0"
            >
              Edit &rarr;
            </button>
          </div>
          {saveState === "needsAuth" && (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-xs text-ink-muted">Sign in to save these preferences to your account.</p>
              <PhoneAuth onVerified={() => void attemptSave()} />
            </div>
          )}
          {saveState === "error" && (
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <p className="text-xs text-ink-muted">
                {saveError ?? "Couldn't save your profile — you can still see your matches below."}
              </p>
              <button
                onClick={() => void attemptSave()}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink shrink-0"
              >
                Retry
              </button>
            </div>
          )}
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
            <div key={s} className={`h-1.5 w-6 rounded-full ${s <= step ? "bg-gold" : "bg-line-strong"}`} />
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
                <span className="text-xs font-bold text-gold-text">{active ? "Excluding ✓" : "+ Add"}</span>
              </button>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-muted">Select kitchen dietary style and clinical conditions:</p>
          {STYLES.filter((c) => c.type === "style").map((c) => {
            const active = dietaryStyle === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setDietaryStyle(c.id)}
                className={`rounded-xl border p-3.5 flex items-center justify-between text-sm ${
                  active ? "border-gold bg-gold/5 font-medium" : "border-line text-ink-muted hover:border-ink/20"
                }`}
              >
                <span className="text-ink">{c.label}</span>
                <span className="text-xs font-bold text-gold-text">{active ? "Active ✓" : "+ Select"}</span>
              </button>
            );
          })}
          <p className="text-xs text-ink-muted">
            These conditions shape today’s preview only — they are not saved to your account. For a real,
            consent-gated clinical record, visit{" "}
            <Link href="/account/health-information" className="font-semibold text-gold-text hover:underline">
              Health Information
            </Link>
            .
          </p>
          {STYLES.filter((c) => c.type === "condition").map((c) => {
            const active = conditions.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCondition(c.id)}
                className={`rounded-xl border p-3.5 flex items-center justify-between text-sm ${
                  active ? "border-gold bg-gold/5 font-medium" : "border-line text-ink-muted hover:border-ink/20"
                }`}
              >
                <span className="text-ink">{c.label}</span>
                <span className="text-xs font-bold text-gold-text">{active ? "Active ✓" : "+ Select"}</span>
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
        <button
          onClick={handleContinue}
          className="rounded-xl bg-gold px-6 py-2.5 text-xs font-semibold text-[var(--gold-ink)] shadow-sm hover:bg-gold/90"
        >
          {step === 3 ? "See Customized Menu" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
