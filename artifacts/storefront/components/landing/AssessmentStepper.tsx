"use client"; // Interactive full-screen assessment modal and step state management
// Full-screen clinical & wellness triage stepper routing to RD consult or plan checkout
import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (defaultOpen) {
      emitLpEvent("assessment_start", { source: "default_open" });
    }
    const handleOpen = () => {
      setOpen(true);
      setStepIdx(0);
      emitLpEvent("assessment_start", { source: "custom_event" });
    };
    window.addEventListener("open_tanmatra_assessment", handleOpen);
    return () => window.removeEventListener("open_tanmatra_assessment", handleOpen);
  }, [defaultOpen]);

  function handleStart() {
    setOpen(true);
    setStepIdx(0);
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
    setOpen(false);
    window.location.href = outcome;
  }

  function handleSkip() {
    emitLpEvent("assessment_skip", { step: stepIdx + 1 });
    setOpen(false);
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
  if (!currentConfig) return null;

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

        <div className="my-auto py-2">
          <AssessmentScreen step={currentConfig} state={state} onUpdateState={setState} />
        </div>

        <AssessmentControls
          currentStep={stepIdx}
          totalSteps={ASSESSMENT_STEPS.length}
          onBack={handleBack}
          onNext={handleNext}
          onSkip={handleSkip}
          isLastStep={stepIdx === ASSESSMENT_STEPS.length - 1}
        />
      </div>
    </div>
  );
}
