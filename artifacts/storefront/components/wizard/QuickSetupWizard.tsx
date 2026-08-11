"use client";
// Client: interactive 3-step assessment (D-04B / TNM-CRO-01 owner ruling
// 2026-08-11 — "/quick-setup is the approved canonical assessment only if it
// fulfills the quiz contract"). Exactly three one-question, tap-first
// viewports (goal → dietary style → allergens); finishing routes
// DETERMINISTICALLY to /trial or /plan/[planId] — never to an in-page
// results screen. goal/allergens/dietary style are best-effort persisted to
// the real preferences surface (lib/preferencesApi) in the background: it
// never gates the exit, so a signed-out visitor routes exactly as fast as a
// signed-in one (the old "Sign in to save your profile" gate is the thing
// this contract disapproves of). Clinical conditions are no longer a wizard
// question — a condition signal arrives only via the incoming `?condition=`
// param from /care, carried through to the exit, never asked for here.
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SquircleOptionCard } from "@/components/primitives/OptionCards";
import { StepDots } from "@/components/checkout/StepDots";
import { Button } from "@/components/ui/button";
import { readQuickSetupDraft, stashQuickSetupDraft, clearQuickSetupDraft } from "@/lib/quickSetupDraft";
import { createAcquisitionContext } from "@/lib/acquisitionContext";
import { savePreferences, type DietaryStyle, type WellnessGoal } from "@/lib/preferencesApi";
import { planForCondition } from "@workspace/subscription-rules";

const GOALS = [
  { id: "lose_weight", label: "Fat Loss & Metabolic Reset", desc: "Calorie-controlled volume density" },
  { id: "gain_muscle", label: "Lean Muscle Hypertrophy", desc: "High bioavailable protein (>30g)" },
  { id: "maintenance", label: "Holistic Longevity Care", desc: "Balanced daily macronutrients" },
];

const STYLES = [
  { id: "vegetarian", label: "Strictly Vegetarian" },
  { id: "omnivore", label: "Omnivore" },
];

const ALLERGIES = [
  { id: "dairy", label: "Dairy" },
  { id: "gluten", label: "Gluten / Wheat" },
  { id: "nuts", label: "Peanuts & Tree Nuts" },
  { id: "soy", label: "Soy" },
];

const STEP_LABELS: Record<1 | 2 | 3, string> = { 1: "Goal", 2: "Dietary Style", 3: "Allergens" };

/** Local goal ids match the wire WellnessGoal verbatim except "maintenance",
 *  whose wire value is "maintain". */
function toWireGoal(id: string): WellnessGoal {
  return id === "maintenance" ? "maintain" : (id as WellnessGoal);
}

/** The D-04B exit mapping, verbatim: a mapped `?condition=` routes to that
 *  condition's plan; anything else (no condition, or a condition with no
 *  mapped plan) routes to the trial — never a dead end. */
function resolveExitPath(condition: string | null): string {
  const planId = condition ? planForCondition(condition) : null;
  return planId ? `/plan/${planId}` : "/trial";
}

export function QuickSetupWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const condition = searchParams.get("condition");

  // Lazy initializer — reads sessionStorage once, at mount, never again. A
  // dropped-off wizard (refresh, accidental back-swipe, tab switch) used to
  // silently discard every answer with no way back; the in-progress survey
  // rides out a reload.
  const [draft] = useState(() => readQuickSetupDraft());
  const [step, setStep] = useState<1 | 2 | 3>(draft?.step ?? 1);
  const [goal, setGoal] = useState(draft?.goal ?? "maintenance");
  const [dietaryStyle, setDietaryStyle] = useState(draft?.dietaryStyle ?? "omnivore");
  const [allergens, setAllergens] = useState<string[]>(draft?.allergens ?? []);

  useEffect(() => {
    stashQuickSetupDraft({ step, goal, dietaryStyle, allergens });
  }, [step, goal, dietaryStyle, allergens]);

  const toggleAllergen = (id: string) =>
    setAllergens((p) => (p.includes(id) ? p.filter((i) => i !== id) : [...p, id]));

  function finish() {
    clearQuickSetupDraft();
    const wireGoal = toWireGoal(goal);
    const recommendedPlanId = condition ? (planForCondition(condition) ?? undefined) : undefined;

    // Best-effort background save — never gates the exit. A 401 (signed-out
    // visitor) is swallowed exactly like every other auth-gated island in
    // this app; the old "Sign in to save your profile" wall is the thing
    // this contract disapproves of.
    void savePreferences({ goal: wireGoal, dietaryStyle: dietaryStyle as DietaryStyle, allergens }).catch(() => {
      // Signed out / offline — the assessment still routes; nothing to save yet.
    });

    const acquisitionContextId = createAcquisitionContext({
      intendedGoal: wireGoal,
      recommendedPlanId,
      returnRoute: "/quick-setup",
    });

    const params = new URLSearchParams();
    if (condition) params.set("condition", condition);
    params.set("goal", wireGoal);
    params.set("acquisitionContextId", acquisitionContextId);
    router.push(`${resolveExitPath(condition)}?${params.toString()}`);
  }

  function handleContinue() {
    if (step === 3) {
      finish();
      return;
    }
    setStep((step + 1) as 1 | 2 | 3);
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
        <div data-ui-generation="stitch-74" data-screen-id="6.9.1" data-screen-state="step-1-goal" className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold leading-snug text-ink">What&rsquo;s your goal?</h2>
          {GOALS.map((g) => (
            <SquircleOptionCard
              key={g.id}
              title={g.label}
              description={g.desc}
              isSelected={goal === g.id}
              onClick={() => setGoal(g.id)}
            />
          ))}
        </div>
      )}

      {step === 2 && (
        <div data-ui-generation="stitch-74" data-screen-id="6.9.2" data-screen-state="step-2-dietary-style" className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold leading-snug text-ink">What&rsquo;s your kitchen dietary style?</h2>
          {STYLES.map((s) => (
            <SquircleOptionCard
              key={s.id}
              title={s.label}
              isSelected={dietaryStyle === s.id}
              onClick={() => setDietaryStyle(s.id)}
            />
          ))}
        </div>
      )}

      {step === 3 && (
        <div data-ui-generation="stitch-74" data-screen-id="6.9.3" data-screen-state="step-3-allergens" className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold leading-snug text-ink">
            Select dietary allergens our kitchen must strictly omit
          </h2>
          {ALLERGIES.map((a) => (
            <SquircleOptionCard
              key={a.id}
              title={a.label}
              isSelected={allergens.includes(a.id)}
              onClick={() => toggleAllergen(a.id)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-3 border-t border-line">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button
              type="button"
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
              variant="outline"
              shape="pill"
              size="fluid"
              className="flex-1 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-center"
            >
              Back
            </Button>
          )}
          <Button
            type="button"
            onClick={handleContinue}
            shape="pill"
            size="fluid"
            className="flex-[2] px-6 py-3 text-xs font-semibold uppercase tracking-wide shadow-sm text-center"
          >
            {step === 3 ? "See my plan" : "Continue →"}
          </Button>
        </div>
        {/* Tertiary escape hatch (D-04B): the menu-matching outcome survives
            only as a low-emphasis text link, never the primary exit. */}
        <Link
          href="/menu"
          className="text-center text-[11px] font-medium text-ink-faint hover:text-ink-muted hover:underline"
        >
          Skip &mdash; just browse matching dishes
        </Link>
      </div>
    </div>
  );
}
