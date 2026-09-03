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
import { StepDots } from "@/components/checkout/StepDots";
import { Button } from "@/components/ui/button";
import { readQuickSetupDraft, stashQuickSetupDraft, clearQuickSetupDraft } from "@/lib/quickSetupDraft";
import { createAcquisitionContext } from "@/lib/acquisitionContext";
import { savePreferences, type DietaryStyle, type WellnessGoal } from "@/lib/preferencesApi";
import { chipForStyle, recalledDietaryStyle, rememberDiet } from "@/lib/dietMemory";
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

/** Tap-to-select row grammar (the same border + tint the checkout track chips
 *  use): selection is carried by the gold border, never a solid gold fill. */
const OPTION_ROW =
  "flex min-h-12 w-full flex-col items-start justify-center rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors active:scale-[0.98]";
const OPTION_SELECTED = "border-gold bg-primary/10 text-primary";
const OPTION_IDLE = "border-transparent bg-secondary text-ink-muted hover:text-ink";

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

  // Law 4: re-seed from an answer they already gave this question — the
  // wizard's own, carried locally because `savePreferences` below swallows the
  // 401 a signed-out visitor gets, so the server has nothing to hand back.
  // Only a DECLARED style; a Veg chip tapped on the menu is a request to narrow
  // a list, and pre-selecting "Strictly Vegetarian" from it would answer this
  // question on their behalf. An in-progress draft still wins.
  //
  // In an effect rather than the initializer above: localStorage is invisible
  // to the server render, so seeding at init would hydrate to a different value.
  useEffect(() => {
    if (draft?.dietaryStyle) return;
    const recalled = recalledDietaryStyle();
    if (recalled) setDietaryStyle(recalled);
    // Mount only — a later change is the customer editing their answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stashQuickSetupDraft({ step, goal, dietaryStyle, allergens });
  }, [step, goal, dietaryStyle, allergens]);

  const toggleAllergen = (id: string) =>
    setAllergens((p) => (p.includes(id) ? p.filter((i) => i !== id) : [...p, id]));

  function finish() {
    clearQuickSetupDraft();
    const wireGoal = toWireGoal(goal);
    const recommendedPlanId = condition ? (planForCondition(condition) ?? undefined) : undefined;

    // Law 4: keep the answer locally BEFORE the server attempt, because that
    // attempt is where it used to be lost. The save below swallows a
    // signed-out visitor's 401 by design, so their declared dietary style
    // reached nothing that survived the navigation — and /menu, which gates on
    // getAuthUser, then showed a self-declared vegetarian chicken. Recorded as
    // "declared": the strong fact, which a later chip tap must not overwrite.
    const chip = chipForStyle(dietaryStyle as DietaryStyle);
    // Pescatarian/keto narrow to neither chip; no memory at all beats a wrong
    // one, and the wizard offers neither today.
    if (chip) rememberDiet({ chip, source: "declared", style: dietaryStyle as DietaryStyle });

    // Best-effort background save — never gates the exit. A 401 (signed-out
    // visitor) is swallowed exactly like every other auth-gated island in
    // this app; the old "Sign in to save your profile" wall is the thing
    // this contract disapproves of.
    void savePreferences({ goal: wireGoal, dietaryStyle: dietaryStyle as DietaryStyle, allergens }).catch(() => {
      // Signed out / offline — the assessment still routes; the answer is kept
      // locally above, so it is not lost with the request.
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
    <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-col gap-4 border-b border-line pb-5">
        <StepDots current={step} total={3} />
        <span className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">
          Step {step} of 3 &mdash; {STEP_LABELS[step]}
        </span>
      </div>

      {step === 1 && (
        <div data-ui-generation="stitch-74" data-screen-id="6.9.1" data-screen-state="step-1-goal" className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold leading-tight text-primary">What&rsquo;s your goal?</h2>
          {GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGoal(g.id)}
              className={`${OPTION_ROW} ${goal === g.id ? OPTION_SELECTED : OPTION_IDLE}`}
            >
              <span className="block font-semibold">{g.label}</span>
              <span className="mt-0.5 block text-xs font-normal text-ink-muted">{g.desc}</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div data-ui-generation="stitch-74" data-screen-id="6.9.2" data-screen-state="step-2-dietary-style" className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold leading-tight text-primary">What&rsquo;s your kitchen dietary style?</h2>
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setDietaryStyle(s.id)}
              className={`${OPTION_ROW} ${dietaryStyle === s.id ? OPTION_SELECTED : OPTION_IDLE}`}
            >
              <span className="block font-semibold">{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div data-ui-generation="stitch-74" data-screen-id="6.9.3" data-screen-state="step-3-allergens" className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold leading-tight text-primary">
            Select dietary allergens our kitchen must strictly omit
          </h2>
          {ALLERGIES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAllergen(a.id)}
              className={`${OPTION_ROW} ${allergens.includes(a.id) ? OPTION_SELECTED : OPTION_IDLE}`}
            >
              <span className="block font-semibold">{a.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button
              type="button"
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
              variant="outline"
              shape="pill"
              size="fluid"
              className="min-h-12 flex-1 px-4 py-3 text-center text-sm font-semibold"
            >
              Back
            </Button>
          )}
          <Button
            type="button"
            onClick={handleContinue}
            shape="pill"
            size="fluid"
            className="min-h-12 flex-[2] px-6 py-3 text-center text-sm font-semibold"
          >
            {step === 3 ? "See my plan" : "Continue →"}
          </Button>
        </div>
        {/* Tertiary escape hatch (D-04B): the menu-matching outcome survives
            only as a low-emphasis text link, never the primary exit. */}
        <Link
          href="/menu"
          className="text-center text-xs font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Skip &mdash; just browse matching dishes
        </Link>
      </div>
    </div>
  );
}
