"use client"; // Interactive option selection screen for assessment stepper
// Screen renderer for health assessment questions and selectable option tiles
import type { AssessmentStepConfig, AssessmentState } from "./AssessmentTypes";

export interface AssessmentScreenProps {
  step: AssessmentStepConfig;
  state: AssessmentState;
  onUpdateState: (next: AssessmentState) => void;
}

export function AssessmentScreen({ step, state, onUpdateState }: AssessmentScreenProps) {
  function isSelected(optionId: string): boolean {
    if (step.id === "goal") return state.primaryGoal === optionId;
    if (step.id === "conditions") return state.conditions.includes(optionId);
    if (step.id === "diet") return state.dietTrack === optionId;
    if (step.id === "activity") return state.dailyActivity === optionId;
    if (step.id === "timeframe") return state.timeframe === optionId;
    return false;
  }

  function handleSelect(optionId: string) {
    if (step.type === "single") {
      if (step.id === "goal") onUpdateState({ ...state, primaryGoal: optionId });
      else if (step.id === "diet") onUpdateState({ ...state, dietTrack: optionId });
      else if (step.id === "activity") onUpdateState({ ...state, dailyActivity: optionId });
      else if (step.id === "timeframe") onUpdateState({ ...state, timeframe: optionId });
    } else {
      let nextConditions = [...state.conditions];
      if (optionId === "none") {
        nextConditions = nextConditions.includes("none") ? [] : ["none"];
      } else {
        nextConditions = nextConditions.filter((c) => c !== "none");
        if (nextConditions.includes(optionId)) {
          nextConditions = nextConditions.filter((c) => c !== optionId);
        } else {
          nextConditions.push(optionId);
        }
      }
      onUpdateState({ ...state, conditions: nextConditions });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {step.title}
        </h2>
        <p className="text-sm text-ink-muted">{step.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {step.options.map((opt) => {
          const active = isSelected(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all outline-none ${
                active
                  ? "border-[2px] border-line-strong bg-surface-raised shadow-[var(--shadow-card)]"
                  : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-base font-semibold text-ink">{opt.label}</span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    active
                      ? "border-line-strong bg-gold text-xs font-bold text-[var(--gold-ink)]"
                      : "border-line"
                  }`}
                >
                  {active ? "✓" : ""}
                </span>
              </div>
              {opt.description && (
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  {opt.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
