import { motion } from "framer-motion";
import { Check } from "lucide-react";

export type CheckoutStep = "review" | "address" | "payment";

type CheckoutStepperProps = {
  current: CheckoutStep;
  reviewComplete?: boolean;
  addressComplete?: boolean;
  /**
   * R1 stepped mode: when provided, steps BEFORE the current one become
   * tappable (walk back to revisit); the current and forward steps stay
   * inert — forward movement belongs to the flow's Continue gate, so the
   * stepper can never skip validation.
   */
  onStepClick?: (step: CheckoutStep) => void;
};

const STEPS: Array<{ id: CheckoutStep; label: string; index: number }> = [
  { id: "review", label: "Review", index: 1 },
  { id: "address", label: "Delivery", index: 2 },
  { id: "payment", label: "Payment", index: 3 },
];

export default function CheckoutStepper({
  current,
  reviewComplete = true,
  addressComplete = false,
  onStepClick,
}: CheckoutStepperProps) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  const completion: Record<CheckoutStep, boolean> = {
    review: reviewComplete,
    address: addressComplete,
    payment: false,
  };

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="flex items-center justify-between gap-3">
        {STEPS.map((step, i) => {
          const active = step.id === current;
          const done = completion[step.id] && !active;
          const accent = active || done;
          const clickable = Boolean(onStepClick) && i < currentIdx;
          const inner = (
            <>
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: active
                    ? "var(--tnm-action)"
                    : "transparent",
                  borderColor: active
                    ? "var(--tnm-action)"
                    : done
                      ? "transparent"
                      : "color-mix(in srgb, white 20%, transparent)",
                }}
                transition={{ duration: 0.25 }}
                className="w-7 h-7 rounded-full border flex items-center justify-center shrink-0"
                aria-current={active ? "step" : undefined}
              >
                {done ? (
                  <Check className="w-4 h-4 text-[var(--tnm-action)]" strokeWidth={3} />
                ) : (
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color: active ? "black" : "color-mix(in srgb, white 40%, transparent)" }}
                  >
                    {step.index}
                  </span>
                )}
              </motion.div>
              <span
                className="text-[11px] uppercase tracking-[0.12em] font-semibold truncate"
                style={{ color: accent ? "white" : "color-mix(in srgb, white 40%, transparent)" }}
              >
                {step.label}
              </span>
            </>
          );
          return (
            <div key={step.id} className="flex items-center gap-3 flex-1 min-w-0">
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.id)}
                  aria-label={`Go back to ${step.label} step`}
                  className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0 active:scale-[0.98] transition-transform"
                >
                  {inner}
                </button>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
                  {inner}
                </div>
              )}
              {i < STEPS.length - 1 && (
                <div className="relative flex-1 h-px overflow-hidden bg-white/10">
                  <motion.div
                    initial={false}
                    animate={{ width: i < currentIdx ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0"
                    style={{ background: "var(--tnm-action)" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
