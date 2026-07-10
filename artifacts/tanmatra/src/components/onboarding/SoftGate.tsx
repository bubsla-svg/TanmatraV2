import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { usePreferences } from "@/lib/preferencesContext";
import { track } from "@/lib/analytics";
import type { WellnessGoal } from "@/lib/preferencesApi";

/**
 * Phase 1 — the 15-second Soft Gate.
 *
 * A fast, tactile first-touch onboarding gate shown to brand-new visitors
 * before they dig into the menu. It captures just TWO things in <=3 taps:
 *   1. Primary health goal  → written to the real `goal` field (+ a
 *      `medicalConditions` hint for the condition-flavoured goals), so the
 *      menu re-ranker (`evaluateDishForPreferences`) immediately personalises.
 *   2. Fatal/critical allergies → written to the real `allergens` field, the
 *      canonical hard-block signal the same evaluator consumes.
 *
 * It does NOT mark the full metabolic quiz complete — the heavier IntakeQuiz
 * can still nudge later. To avoid double-popping, `OnboardingQuizGate`
 * suppresses its banner until this gate is resolved (see `isSoftGateResolved`).
 *
 * CLS: the overlay is `position: fixed; inset: 0`, so mounting/unmounting it
 * never shifts document layout — Cumulative Layout Shift stays 0.
 */

export const SOFTGATE_KEY = "tanmatra:softgate:v1";

export function isSoftGateResolved(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SOFTGATE_KEY) != null;
  } catch {
    return false;
  }
}

function markResolved(value: "completed" | "skipped") {
  try {
    window.localStorage.setItem(
      SOFTGATE_KEY,
      JSON.stringify({ v: 1, at: Date.now(), outcome: value }),
    );
  } catch {
    // Ignore storage quota / privacy-mode exceptions — worst case the gate
    // re-shows on next load; never let it throw.
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// Goal cards — mapped onto the REAL `WellnessGoal` enum. The two
// condition-flavoured goals (blood sugar, heart) additionally seed a
// `medicalConditions` entry, which the evaluator uses for contraindication
// warnings. No invented fields.
// ---------------------------------------------------------------------------
interface GoalCard {
  key: string;
  label: string;
  hint: string;
  icon: string; // phosphor class
  goal: WellnessGoal;
  condition?: string;
}

const GOAL_CARDS: GoalCard[] = [
  {
    key: "blood_sugar",
    label: "Blood Sugar Stability",
    hint: "Low-glycaemic, steady energy",
    icon: "ph-drop",
    goal: "maintain",
    condition: "diabetes",
  },
  {
    key: "fat_loss",
    label: "Weight / Fat Loss",
    hint: "Satiety-first, calorie-aware",
    icon: "ph-trend-down",
    goal: "lose_weight",
  },
  {
    key: "muscle",
    label: "Muscle / Performance",
    hint: "High-protein, training-timed",
    icon: "ph-barbell",
    goal: "gain_muscle",
  },
  {
    key: "heart",
    label: "Heart Health",
    hint: "Sodium-aware, heart-smart",
    icon: "ph-heartbeat",
    goal: "maintain",
    condition: "hypertension",
  },
  {
    key: "wellness",
    label: "General Wellness",
    hint: "Everyday balanced eating",
    icon: "ph-leaf",
    goal: "general_wellness",
  },
];

// Allergy cards — mapped onto the canonical `ALLERGEN_OPTIONS` string tokens
// the evaluator normalises + hard-blocks on. "Nuts" covers both peanut and
// tree-nut tokens so nothing critical slips through.
interface AllergyCard {
  key: string;
  label: string;
  icon: string;
  allergens: string[];
}

const ALLERGY_CARDS: AllergyCard[] = [
  { key: "gluten", label: "Gluten-free", icon: "ph-grains", allergens: ["gluten"] },
  { key: "nuts", label: "Nuts", icon: "ph-tree", allergens: ["tree nuts", "peanuts"] },
  { key: "dairy", label: "Dairy", icon: "ph-cow", allergens: ["dairy"] },
  { key: "shellfish", label: "Shellfish", icon: "ph-shrimp", allergens: ["shellfish"] },
  { key: "soy", label: "Soy", icon: "ph-plant", allergens: ["soy"] },
  { key: "egg", label: "Egg", icon: "ph-egg", allergens: ["eggs"] },
];

type Phase = "goal" | "allergy" | "confirm";

/** One-line privacy fine print shown wherever health data is collected. */
function PrivacyNote() {
  return (
    <p className="fine" style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 12 }}>
      Stored to personalise your menu. Delete anytime in Preferences. See{" "}
      <Link to="/privacy" style={{ color: "var(--safb)", textDecoration: "underline" }}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}

export default function SoftGate() {
  const { update } = usePreferences();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [phase, setPhase] = useState<Phase>("goal");
  const [goalKey, setGoalKey] = useState<string | null>(null);
  const [allergyKeys, setAllergyKeys] = useState<string[]>([]);
  const [noneSelected, setNoneSelected] = useState(false);
  const startedRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decide visibility on the client only — avoids an SSR/hydration mismatch,
  // and because the overlay is fixed-position it introduces no layout shift.
  useEffect(() => {
    if (!isSoftGateResolved()) {
      setVisible(true);
      if (!startedRef.current) {
        startedRef.current = true;
        track("softgate_start");
      }
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  if (!visible) return null;

  const chosenGoal = GOAL_CARDS.find((g) => g.key === goalKey) ?? null;

  const selectGoal = (key: string) => {
    setGoalKey(key);
    // Auto-advance so the whole flow is <=3 taps: goal → allergy → confirm.
    setPhase("allergy");
  };

  const toggleAllergy = (key: string) => {
    setNoneSelected(false);
    setAllergyKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const selectNone = () => {
    setNoneSelected(true);
    setAllergyKeys([]);
  };

  const finishAndClose = (outcome: "completed" | "skipped") => {
    markResolved(outcome);
    const reduce = prefersReducedMotion();
    if (reduce) {
      setVisible(false);
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => setVisible(false), 320);
  };

  const handleSkip = () => {
    track("softgate_skip", { phase });
    finishAndClose("skipped");
  };

  const handleConfirm = async () => {
    if (!chosenGoal) return;
    const allergens = Array.from(
      new Set(
        noneSelected
          ? []
          : allergyKeys.flatMap(
              (k) => ALLERGY_CARDS.find((a) => a.key === k)?.allergens ?? [],
            ),
      ),
    );

    // Map onto REAL preference fields so this immediately drives the
    // re-ranker. markQuizComplete stays false — this is the light first
    // touch, not the full metabolic assessment.
    void update({
      goal: chosenGoal.goal,
      allergens,
      ...(chosenGoal.condition
        ? { medicalConditions: [chosenGoal.condition] }
        : {}),
      markQuizComplete: false,
    });

    track("softgate_complete", {
      goal: chosenGoal.goal,
      goal_card: chosenGoal.key,
      allergen_count: allergens.length,
      none: noneSelected,
    });

    // Satisfying confirmation, then slide into the app.
    setPhase("confirm");
    const reduce = prefersReducedMotion();
    closeTimer.current = setTimeout(
      () => finishAndClose("completed"),
      reduce ? 0 : 1100,
    );
  };

  const canConfirm = noneSelected || allergyKeys.length > 0;
  const stepIndex = phase === "goal" ? 0 : phase === "allergy" ? 1 : 2;

  return (
    <div
      className="tnm2 tnm-softgate"
      role="dialog"
      aria-modal="true"
      aria-label="Quick personalisation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        opacity: closing ? 0 : 1,
        transform: closing ? "translateY(-8px)" : "none",
        transition: "opacity 300ms var(--e), transform 300ms var(--e)",
        overscrollBehavior: "contain",
      }}
    >
      {/* Reduced-motion + entrance styles scoped to this overlay. */}
      <style
        dangerouslySetInnerHTML={{
          __html: SOFTGATE_CSS,
        }}
      />

      {/* Header: progress + skip. Skip always available — never trap. */}
      <div
        className="fx ac jb"
        style={{ padding: "max(env(safe-area-inset-top),18px) 20px 10px" }}
      >
        <div className="segs" style={{ width: 88 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`seg ${i <= stepIndex ? "on" : ""}`}
            />
          ))}
        </div>
        {phase !== "confirm" && (
          <button
            type="button"
            onClick={handleSkip}
            className="fine"
            style={{ padding: "8px 4px", color: "var(--mut)" }}
          >
            Skip
          </button>
        )}
      </div>

      <div
        className="f1"
        style={{
          overflowY: "auto",
          padding: "8px 20px 20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {phase === "goal" && (
          <div className="sg-fade">
            <div className="lab mb6">Step 1 of 2</div>
            <div className="disp mb4">What matters most right now?</div>
            <div className="fine mb20">
              Pick one — we'll instantly re-rank the menu for it.
            </div>
            <div role="radiogroup" aria-label="Primary health goal">
              {GOAL_CARDS.map((g) => {
                const on = goalKey === g.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => selectGoal(g.key)}
                    className={`opt sg-opt ${on ? "on" : ""}`}
                  >
                    <i className={`ph-fill ${g.icon}`} aria-hidden="true" />
                    <span className="f1" style={{ minWidth: 0 }}>
                      <span style={{ display: "block" }}>{g.label}</span>
                      <span
                        className="fine"
                        style={{ display: "block", marginTop: 2 }}
                      >
                        {g.hint}
                      </span>
                    </span>
                    {on && (
                      <i
                        className="ph-bold ph-check safc"
                        aria-hidden="true"
                        style={{ fontSize: 18 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <PrivacyNote />
          </div>
        )}

        {phase === "allergy" && (
          <div className="sg-fade">
            <div className="lab mb6">Step 2 of 2</div>
            <div className="disp mb4">Anything we must never serve you?</div>
            <div className="fine mb20">
              Tap all that apply — we'll hard-block these from your menu.
            </div>
            <div
              role="group"
              aria-label="Critical allergies"
              className="grid"
              style={{
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {ALLERGY_CARDS.map((a) => {
                const on = !noneSelected && allergyKeys.includes(a.key);
                return (
                  <button
                    key={a.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleAllergy(a.key)}
                    className={`opt sg-opt sg-opt-grid ${on ? "on" : ""}`}
                    style={{ marginBottom: 0 }}
                  >
                    <i className={`ph-fill ${a.icon}`} aria-hidden="true" />
                    <span className="f1" style={{ minWidth: 0 }}>
                      {a.label}
                    </span>
                    {on && (
                      <i
                        className="ph-bold ph-check safc"
                        aria-hidden="true"
                        style={{ fontSize: 16, flex: "none" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-pressed={noneSelected}
              onClick={selectNone}
              className={`opt sg-opt ${noneSelected ? "selrow" : ""}`}
              style={{ marginTop: 10 }}
            >
              <i className="ph-bold ph-check-circle" aria-hidden="true" />
              <span className="f1">None — I have no allergies</span>
              {noneSelected && (
                <i
                  className="ph-bold ph-check sagec"
                  aria-hidden="true"
                  style={{ fontSize: 18, flex: "none" }}
                />
              )}
            </button>

            <PrivacyNote />

            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setPhase("goal")}
                className="btn btn-g"
                style={{ flex: "none" }}
                aria-label="Back to goal"
              >
                <i className="ph-bold ph-arrow-left" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={`btn btn-p btn-lg f1 ${canConfirm ? "" : "dis"}`}
              >
                Personalise my menu
                <i className="ph-bold ph-arrow-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {phase === "confirm" && (
          <div
            className="col ac jc f1 sg-fade"
            style={{ textAlign: "center", gap: 4, padding: "40px 0" }}
          >
            <div className="checkpop sg-pop mb20" aria-hidden="true">
              <i className="ph-bold ph-check" />
            </div>
            <div className="h2">You're set.</div>
            <div className="fine" style={{ maxWidth: 260, marginTop: 6 }}>
              {chosenGoal
                ? `Menu re-ranked for ${chosenGoal.label.toLowerCase()}${
                    noneSelected || allergyKeys.length === 0
                      ? ""
                      : ", allergens blocked"
                  }.`
                : "Your menu is personalised."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Entrance / confirmation motion, disabled under reduced-motion.
const SOFTGATE_CSS = `
.tnm-softgate .sg-fade{animation:sgfade 260ms var(--e)}
.tnm-softgate .sg-opt{min-height:72px}
.tnm-softgate .sg-opt-grid{min-height:72px;flex-direction:column;align-items:flex-start;justify-content:center;gap:8px;padding:14px}
.tnm-softgate .sg-opt:active{transform:scale(.985)}
@keyframes sgfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){
  .tnm-softgate{transition:none !important}
  .tnm-softgate .sg-fade{animation:none !important}
  .tnm-softgate .sg-pop{animation:none !important}
  .tnm-softgate .sg-opt:active{transform:none !important}
}
`.trim();
