"use client";

import { useState, useEffect } from "react";
import { formatPaise } from "@/lib/format";
import { TRIAL_PRICE_PAISE } from "@/lib/trial";
import { emitLpEvent } from "@/lib/lpEvents";
import {
  ASSESSMENT_STEPS,
  INITIAL_ASSESSMENT_STATE,
  resolveAssessmentOutcome,
  type AssessmentState,
} from "./AssessmentTypes";
import { AssessmentScreen } from "./AssessmentScreen";
import { AssessmentControls } from "./AssessmentControls";

export interface AssessmentStepperProps {
  defaultOpen?: boolean;
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
}

export function AssessmentStepper({
  defaultOpen = false,
  title = "Find your personalized clinical nutrition protocol",
  subtitle = "Answer 5 quick metabolic questions to match with certified RD protocols or direct meal plans.",
  buttonLabel = "Start Assessment ➔",
}: AssessmentStepperProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<AssessmentState>(INITIAL_ASSESSMENT_STATE);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (defaultOpen) {
      emitLpEvent("assessment_start", { source: "default_open" });
    }
    const handleOpen = () => {
      setOpen(true);
      setStepIdx(0);
      setShowResult(false);
      emitLpEvent("assessment_start", { source: "custom_event" });
    };
    window.addEventListener("open_tanmatra_assessment", handleOpen);
    return () => window.removeEventListener("open_tanmatra_assessment", handleOpen);
  }, [defaultOpen]);

  function handleStart() {
    setOpen(true);
    setStepIdx(0);
    setShowResult(false);
    emitLpEvent("assessment_start", { source: "user_trigger" });
  }

  function handleNext() {
    if (stepIdx < ASSESSMENT_STEPS.length - 1) {
      const nextIdx = stepIdx + 1;
      setStepIdx(nextIdx);
      const nextStep = ASSESSMENT_STEPS[nextIdx];
      emitLpEvent("assessment_step", {
        step: nextIdx + 1,
        section: nextStep?.id ?? "unknown",
      });
    } else {
      handleComplete();
    }
  }

  function handleBack() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  function handleComplete() {
    const outcome = resolveAssessmentOutcome(state);
    emitLpEvent("assessment_complete", {
      outcome,
      goal: state.primaryGoal,
      conditions: state.conditions.join(",") || "none",
      diet: state.dietTrack,
    });
    setShowResult(true);
  }

  function handleSkip() {
    emitLpEvent("assessment_skip", { step: stepIdx + 1 });
    setOpen(false);
    setShowResult(false);
    window.location.href = "#plans";
  }

  if (!open) {
    return (
      <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gold-text">
            Precision Clinical Triage
          </span>
          <h3 className="text-xl font-semibold text-ink">{title}</h3>
          <p className="text-sm text-ink-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={handleStart}
          className="shrink-0 rounded-xl bg-gold px-6 py-3.5 text-sm font-semibold text-[var(--gold-ink)] transition-opacity hover:opacity-90"
        >
          {buttonLabel}
        </button>
      </section>
    );
  }

  const currentConfig = ASSESSMENT_STEPS[stepIdx];
  if (!currentConfig && !showResult) return null;

  const hasPcos = state.conditions.includes("pcos") || state.primaryGoal === "glucose_stability";
  const hasMuscle = state.primaryGoal === "lean_muscle";
  const recTitle = hasPcos
    ? "PCOS Hormone Balance & Low-GI Protocol"
    : hasMuscle
      ? "Lean Muscle Hypertrophy & Protein Protocol"
      : "Weight-Loss Jumpstart & Metabolic Reset Protocol";
  const recSpecs = hasPcos
    ? "1,700 kcal · 100g verified protein · Anti-inflammatory low-GI"
    : hasMuscle
      ? "2,400 kcal · 160g protein surplus · Recovery-tuned"
      : "1,500 kcal · 90g protein · 25g+ soluble fiber";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Clinical health assessment stepper"
      className="fixed inset-0 z-50 flex flex-col bg-surface overflow-y-auto p-4 sm:p-6 md:p-8"
    >
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-between gap-6">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
            Tanmatra Clinical Assessment
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-lg border border-line p-2 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
            aria-label="Close assessment"
          >
            ✕ Close
          </button>
        </div>

        {showResult ? (
          <div className="my-auto flex flex-col gap-6 py-4">
            <div className="rounded-2xl border-2 border-gold/40 bg-surface-raised p-6 shadow-md">
              <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-text">
                Recommended Clinical Plan
              </span>
              <h2 className="mt-3 text-2xl font-bold text-ink">{recTitle}</h2>
              <p className="mt-1 text-sm font-medium text-ink-muted">{recSpecs}</p>

              <div className="mt-6 rounded-xl border border-line bg-surface p-4">
                <span className="text-xs font-semibold uppercase text-gold-text">
                  Low-Friction Trial Recommendation
                </span>
                <p className="mt-1 text-xs text-ink-muted">
                  Test your protocol for 3 days before committing to full monthly billing cycles. 100% creditback towards monthly subscriptions.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <a
                    href="/trial"
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-[var(--gold-ink)] shadow-sm hover:opacity-90"
                  >
                    Start 3-Day Trial Pack — {formatPaise(TRIAL_PRICE_PAISE)} →
                  </a>
                  <a
                    href={`/plans?goal=${state.primaryGoal}`}
                    className="inline-flex items-center justify-center rounded-xl border border-line px-5 py-3.5 text-xs font-semibold text-ink hover:border-line-strong"
                  >
                    View Monthly Protocol
                  </a>
                </div>
              </div>
            </div>

            {state.conditions.some((c: string) => ["t2d", "pcos", "ckd", "cardiac"].includes(c)) && (
              <div className="rounded-xl border border-sage/30 bg-sage-soft p-4 flex items-center justify-between gap-4 text-xs text-sage-text">
                <span>Clinical condition flagged: Free 15-minute consultation available with Dr. Anjali Nair, RD.</span>
                <a href="/rd" className="shrink-0 font-bold underline">Book RD Consult &rarr;</a>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="my-auto py-2">
              <AssessmentScreen step={currentConfig!} state={state} onUpdateState={setState} />
            </div>

            <AssessmentControls
              currentStep={stepIdx}
              totalSteps={ASSESSMENT_STEPS.length}
              onBack={handleBack}
              onNext={handleNext}
              onSkip={handleSkip}
              isLastStep={stepIdx === ASSESSMENT_STEPS.length - 1}
            />
          </>
        )}
      </div>
    </div>
  );
}
