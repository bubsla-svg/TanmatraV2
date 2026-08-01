"use client"; // Interactive stepper navigation buttons and progress bar
// Thumb-zone navigation controls and progress indicator for mobile-first stepper
import { Button } from "@/components/ui/button";

export interface AssessmentControlsProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  isLastStep?: boolean;
}

export function AssessmentControls({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSkip,
  isLastStep = false,
}: AssessmentControlsProps) {
  const progressPct = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <div className="mt-auto flex flex-col gap-4 border-t border-line bg-surface pt-4 sm:pt-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
          <span>
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span>{progressPct}% Completed</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full border border-line bg-surface-raised">
          {/* Full-width bar scaled via `transform` (never `width`) so the fill
              animates on the compositor — `scaleX` + `transform-origin: left`
              is the hardware-accelerated equivalent of animating width. */}
          <div
            className="h-full w-full origin-left rounded-full bg-gold transition-transform duration-300"
            style={{ transform: `scaleX(${progressPct / 100})` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Assessment progress"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={currentStep === 0}
            className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-line-strong disabled:pointer-events-none disabled:opacity-40"
          >
            ← Back
          </button>
          <Button
            type="button"
            onClick={onNext}
            shape="xl" size="fluid" className="flex-[2] px-6 py-3 font-semibold"
          >
            {isLastStep ? "Complete & View Recommendation ➔" : "Next Step ➔"}
          </Button>
        </div>

        <div className="flex items-center justify-center pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
          >
            Skip assessment and go directly to plans
          </button>
        </div>
      </div>
    </div>
  );
}
