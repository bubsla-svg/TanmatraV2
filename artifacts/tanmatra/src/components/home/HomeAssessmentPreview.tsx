import { Link } from "react-router";
import { Brain, ArrowRight } from "@phosphor-icons/react";

interface HomeAssessmentPreviewProps {
  onStart: () => void;
}

export default function HomeAssessmentPreview({ onStart }: HomeAssessmentPreviewProps) {
  const steps = [
    { num: 1, label: "Goal" },
    { num: 2, label: "Dietary safety" },
    { num: 3, label: "Routine" },
    { num: 4, label: "Optional health context" },
    { num: 5, label: "Recommendation" },
  ];

  return (
    <section className="padx mt-8">
      <div className="bg-[var(--tnm-surface-ink-2)] border border-white/5 rounded-2xl p-5 shadow-lg">
        {/* Eyebrow and Title */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-semibold text-[var(--tnm-sage)] uppercase tracking-wider bg-[var(--tnm-sage)]/10 px-2.5 py-1 rounded">
            About 60 seconds
          </span>
          <Brain className="w-5 h-5 text-[var(--tnm-action)]" weight="bold" />
        </div>

        <h3 className="text-base font-semibold text-white/95">Metabolic Health Assessment</h3>
        <p className="text-xs text-white/50 leading-relaxed mt-1">
          Answer a few questions to calibrate the menu to your exact physiology.
        </p>

        {/* Horizontal Stepper Progress Indicator */}
        <div className="mt-5 mb-5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 min-w-[340px] py-1">
            {steps.map((s, idx) => (
              <div key={s.num} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[var(--tnm-surface-ink)] border border-white/10 flex items-center justify-center text-[10px] text-white/70 font-semibold">
                    {s.num}
                  </div>
                  <span className="text-[11px] text-white/70 font-medium whitespace-nowrap">
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="w-4 h-px bg-white/10" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Control Statement & Privacy */}
        <div className="border-t border-white/5 pt-4 mt-4">
          <p className="text-[11px] text-white/45 leading-relaxed">
            We use this information to recommend portion sizes, calculate glycemic load, and screen for safety conflicts (allergens/conditions). Your data is stored securely.
          </p>
          <div className="mt-3">
            <Link
              to="/privacy"
              className="text-[11px] font-semibold text-[var(--tnm-action)] hover:underline inline-flex items-center gap-1"
            >
              How we use health information <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Primary CTA */}
        <button
          onClick={onStart}
          className="btn btn-p btn-blk mt-5"
          style={{
            background: "var(--tnm-action)",
            color: "black",
            minHeight: 46,
          }}
        >
          Start Metabolic Assessment
        </button>
      </div>
    </section>
  );
}
