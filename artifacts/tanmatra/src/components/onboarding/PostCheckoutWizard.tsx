import { useEffect, useMemo, useState } from "react";
import { usePreferences } from "@/lib/preferencesContext";
import {
  ACTIVITY_LABEL,
  DIETARY_STYLE_LABEL,
  GOAL_LABEL,
  MEDICAL_CONDITION_LABEL,
  MEDICAL_CONDITION_OPTIONS,
  type ActivityLevel,
  type DietaryStyle,
  type PreferencesPatch,
  type WellnessGoal,
} from "@/lib/preferencesApi";
import { track } from "@/lib/analytics";

/**
 * Phase 3 — Post-Purchase Ingestion.
 *
 * A short, fully-optional post-checkout wizard shown on FIRST arrival to the
 * order-tracking page right after a successful payment, when purchase intent /
 * trust is at its peak. It captures deeper (optional) health-profile details
 * that map to REAL existing UserPreferences fields, to improve future
 * personalization.
 *
 * Design contract:
 *  - Zero coupling to payment/Razorpay logic. It only reads the arrival
 *    `orderId` (passed in) + a sessionStorage "already shown" flag.
 *  - Never blocks the order status: dismissable via "Maybe later", the close
 *    button, and backdrop click.
 *  - CLS 0.0: rendered as a `position:fixed` overlay — it never participates in
 *    the tracking page's document flow, so it cannot shift layout.
 *  - Respects prefers-reduced-motion.
 *  - Honest copy only — no unearned dietitian/verification claims.
 */

const SHOWN_KEY_PREFIX = "tanmatra:postcheckout-wizard-shown:";

const GOALS: WellnessGoal[] = [
  "lose_weight",
  "maintain",
  "gain_muscle",
  "general_wellness",
];
const ACTIVITY: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];
const DIETS: DietaryStyle[] = [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "keto",
];

const TOTAL_STEPS = 3;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PostCheckoutWizard({ orderId }: { orderId: string | undefined }) {
  const { preferences, loading, update } = usePreferences();

  // The profile is "incomplete" when we have not yet captured the deeper
  // personalization signals. If the user already gave us these, we never nag.
  const profileIncomplete = useMemo(() => {
    if (!preferences) return true;
    const hasGoalSignal =
      !!preferences.goal && preferences.goal !== "general_wellness";
    const hasActivitySignal =
      !!preferences.activityLevel && preferences.activityLevel !== "moderate";
    const hasTargets =
      preferences.calorieTarget != null ||
      preferences.proteinTargetGrams != null;
    return !(hasGoalSignal || hasActivitySignal || hasTargets);
  }, [preferences]);

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const reduce = prefersReducedMotion();

  // Draft state — every field optional; only touched fields are persisted.
  const [goal, setGoal] = useState<WellnessGoal | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [dietaryStyle, setDietaryStyle] = useState<DietaryStyle | null>(null);
  const [conditions, setConditions] = useState<string[]>([]);
  const [calorieTarget, setCalorieTarget] = useState("");
  const [proteinTarget, setProteinTarget] = useState("");

  // Decide once whether to surface the wizard for THIS order arrival.
  useEffect(() => {
    if (!orderId || loading || dismissed) return;
    if (typeof window === "undefined") return;
    const shownKey = SHOWN_KEY_PREFIX + orderId;
    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(shownKey) === "1";
    } catch {
      alreadyShown = false;
    }
    if (alreadyShown) return;
    if (!profileIncomplete) return;

    // Mark shown immediately so a re-render / back-forward nav won't re-trigger.
    try {
      window.sessionStorage.setItem(shownKey, "1");
    } catch {
      /* private mode — worst case it shows once more next mount */
    }
    setOpen(true);
    track("post_checkout_wizard_shown", { orderId });
  }, [orderId, loading, dismissed, profileIncomplete]);

  if (!open) return null;

  const close = (reason: "skip" | "complete") => {
    setOpen(false);
    setDismissed(true);
    if (reason === "skip") {
      track("post_checkout_wizard_skipped", { orderId, step });
    }
  };

  const toggleCondition = (c: string) =>
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  const buildPatch = (): PreferencesPatch => {
    const patch: PreferencesPatch = {};
    if (goal) patch.goal = goal;
    if (activityLevel) patch.activityLevel = activityLevel;
    if (dietaryStyle) patch.dietaryStyle = dietaryStyle;
    if (conditions.length > 0) patch.medicalConditions = conditions;
    const cal = Number(calorieTarget);
    if (calorieTarget.trim() && Number.isFinite(cal) && cal > 0)
      patch.calorieTarget = Math.round(cal);
    const pro = Number(proteinTarget);
    if (proteinTarget.trim() && Number.isFinite(pro) && pro > 0)
      patch.proteinTargetGrams = Math.round(pro);
    return patch;
  };

  const finish = async () => {
    const patch = buildPatch();
    const fieldCount = Object.keys(patch).length;
    if (fieldCount === 0) {
      // Nothing captured — treat as a skip rather than an empty write.
      close("skip");
      return;
    }
    setSaving(true);
    try {
      await update(patch);
      track("post_checkout_wizard_completed", { orderId, fields: fieldCount });
    } catch {
      /* update() already degrades to guest localStorage; never block the user */
    } finally {
      setSaving(false);
      close("complete");
    }
  };

  const next = () => {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else void finish();
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.6)",
    zIndex: 120,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: 0,
    animation: reduce ? undefined : "pcwFade 200ms ease",
  };
  const sheetStyle: React.CSSProperties = {
    maxWidth: 480,
    width: "100%",
    background: "var(--s1)",
    borderRadius: "20px 20px 0 0",
    borderTop: "1px solid var(--ln2)",
    padding: 16,
    maxHeight: "88vh",
    overflowY: "auto",
    animation: reduce ? undefined : "pcwSlideUp 240ms var(--e)",
  };

  return (
    <div
      className="tnm2"
      style={overlayStyle}
      onClick={() => close("skip")}
      role="dialog"
      aria-modal="true"
      aria-label="Tailor your future plates"
    >
      <style>{`
        @keyframes pcwFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pcwSlideUp { from { transform: translateY(16px) } to { transform: translateY(0) } }
        @media (prefers-reduced-motion: reduce) {
          [data-pcw-overlay], [data-pcw-sheet] { animation: none !important }
        }
      `}</style>
      <div
        data-pcw-sheet
        className="col"
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="fx ac jb">
          <div className="lab safc">
            <i className="ph-bold ph-sparkle" /> Step {step} of {TOTAL_STEPS} ·
            optional
          </div>
          <button
            className="iconbtn"
            onClick={() => close("skip")}
            aria-label="Close"
          >
            <i className="ph-bold ph-x" />
          </button>
        </div>

        <div className="segs mt10" aria-hidden="true">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span key={i} className={i < step ? "seg on" : "seg"} />
          ))}
        </div>

        <div className="h2 mt14" style={{ fontSize: 19 }}>
          Order confirmed — while it&apos;s prepped, help us tailor your plates
        </div>
        <div className="fine mt6">
          A few optional details let us personalize future recommendations to
          your body and goals. Skip anytime.
        </div>

        <div className="mt16" style={{ minHeight: 220 }}>
          {step === 1 && (
            <>
              <div className="lab mb8">What are you working toward?</div>
              <div className="fx wrap g6 mb16">
                {GOALS.map((g) => (
                  <button
                    key={g}
                    className={goal === g ? "chip on" : "chip"}
                    onClick={() => setGoal(goal === g ? null : g)}
                  >
                    {GOAL_LABEL[g]}
                  </button>
                ))}
              </div>
              <div className="lab mb8">How active are you day to day?</div>
              <div className="fx wrap g6">
                {ACTIVITY.map((a) => (
                  <button
                    key={a}
                    className={activityLevel === a ? "chip on" : "chip"}
                    onClick={() =>
                      setActivityLevel(activityLevel === a ? null : a)
                    }
                  >
                    {ACTIVITY_LABEL[a]}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="lab mb8">Your eating style</div>
              <div className="fx wrap g6 mb16">
                {DIETS.map((d) => (
                  <button
                    key={d}
                    className={dietaryStyle === d ? "chip on" : "chip"}
                    onClick={() =>
                      setDietaryStyle(dietaryStyle === d ? null : d)
                    }
                  >
                    {DIETARY_STYLE_LABEL[d]}
                  </button>
                ))}
              </div>
              <div className="lab mb8">
                Anything we should cook around? (optional)
              </div>
              <div className="fx wrap g6">
                {MEDICAL_CONDITION_OPTIONS.map((c) => (
                  <button
                    key={c}
                    className={conditions.includes(c) ? "chip on" : "chip"}
                    onClick={() => toggleCondition(c)}
                  >
                    {MEDICAL_CONDITION_LABEL[c]}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="fine mb14">
                Have daily targets in mind? Leave blank and we&apos;ll estimate
                them from your goal.
              </div>
              <div className="lab mb6">Daily calorie target (kcal)</div>
              <div className="inp mb16">
                <i className="ph-bold ph-flame" />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="e.g. 2000"
                  value={calorieTarget}
                  onChange={(e) => setCalorieTarget(e.target.value)}
                />
              </div>
              <div className="lab mb6">Daily protein target (g)</div>
              <div className="inp">
                <i className="ph-bold ph-barbell" />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="e.g. 120"
                  value={proteinTarget}
                  onChange={(e) => setProteinTarget(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="fx ac gap8 mt16">
          <button
            className="btn btn-g f1"
            onClick={() => close("skip")}
            disabled={saving}
          >
            Maybe later
          </button>
          <button
            className="btn btn-p f1"
            onClick={next}
            disabled={saving}
          >
            {step < TOTAL_STEPS
              ? "Continue"
              : saving
                ? "Saving…"
                : "Save & finish"}
          </button>
        </div>
        <div className="fine tc mt10" style={{ fontSize: 11 }}>
          Fully optional. This never delays your order — track it anytime behind
          this card.
        </div>
      </div>
    </div>
  );
}

export default PostCheckoutWizard;
