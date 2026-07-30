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
import { StepDots } from "@/components/checkout/StepDots";

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

const STEP_LABELS: Record<1 | 2 | 3, string> = { 1: "Goal", 2: "Allergens", 3: "Diet Profile" };

function headingTone(state: SaveState): string {
  if (state === "saved") return "text-sage-text";
  if (state === "error") return "text-[var(--danger)]";
  if (state === "needsAuth") return "text-gold-text";
  return "text-ink-muted";
}

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
        <div className="rounded-3xl border border-line bg-surface p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className={`text-[11px] font-semibold uppercase tracking-widest ${headingTone(saveState)}`}>
                {heading}
              </span>
              <p className="text-sm font-medium text-ink">
                Goal: {goal.replace("_", " ").toUpperCase()} &bull; Style: {dietaryStyle}
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-gold-text hover:underline uppercase shrink-0 transition-transform active:scale-[0.95]"
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
                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink shrink-0 transition-transform active:scale-[0.95]"
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
    <div className="rounded-3xl border border-line bg-surface p-5 flex flex-col gap-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-line pb-5">
        <StepDots current={step} total={3} />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
          Step {step} of 3 &mdash; {STEP_LABELS[step]}
        </span>
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-3">
          {GOALS.map((g) => (
            <button
              key={g.id}
              onClick={() => setGoal(g.id)}
              className={`rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                goal === g.id ? "border-gold bg-gold/10 font-medium shadow-sm" : "border-line hover:border-line-strong"
              }`}
            >
              <div className="text-sm font-semibold text-ink">{g.label}</div>
              <div className="text-xs text-ink-muted mt-0.5">{g.desc}</div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold leading-snug text-ink">
            Select dietary allergens our kitchen must strictly omit
          </h2>
          <div className="flex flex-col gap-3">
            {ALLERGIES.map((a) => {
              const active = allergens.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAllergen(a.id)}
                  className={`rounded-2xl border p-4 flex items-center justify-between text-sm transition-all active:scale-[0.98] ${
                    active ? "border-gold bg-gold/10 font-medium text-ink" : "border-line text-ink hover:border-line-strong"
                  }`}
                >
                  <span>{a.label}</span>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wide ${active ? "text-gold-text" : "text-ink-muted"}`}
                  >
                    {active ? "Excluding ✓" : "+ Add"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Kitchen dietary style</p>
            {STYLES.filter((c) => c.type === "style").map((c) => {
              const active = dietaryStyle === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setDietaryStyle(c.id)}
                  className={`rounded-2xl border p-4 flex items-center justify-between text-sm transition-all active:scale-[0.98] ${
                    active ? "border-gold bg-gold/10 font-medium text-ink" : "border-line text-ink hover:border-line-strong"
                  }`}
                >
                  <span>{c.label}</span>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wide ${active ? "text-gold-text" : "text-ink-muted"}`}
                  >
                    {active ? "Active ✓" : "+ Select"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line bg-bg p-4">
            <p className="text-xs leading-relaxed text-ink-faint">
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
                  className={`rounded-xl border border-dashed p-3 flex items-center justify-between text-xs transition-all active:scale-[0.98] ${
                    active ? "border-gold text-ink" : "border-line-strong text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  <span>{c.label}</span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide ${active ? "text-gold-text" : "text-ink-faint"}`}
                  >
                    {active ? "Active ✓" : "+ Select"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-3 border-t border-line">
        {step > 1 && (
          <button
            onClick={() => setStep((step - 1) as any)}
            className="flex-1 rounded-full border border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink text-center transition-all active:scale-[0.98]"
          >
            Back
          </button>
        )}
        <button
          onClick={handleContinue}
          className="flex-[2] rounded-full bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--gold-ink)] shadow-sm text-center transition-all hover:bg-gold/90 active:scale-[0.98]"
        >
          {step === 3 ? "See Customized Menu" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
