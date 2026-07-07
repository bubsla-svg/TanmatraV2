import { motion } from "framer-motion";
import { Check } from "lucide-react";

export type CheckoutStep = "review" | "address" | "payment";

type CheckoutStepperProps = {
  current: CheckoutStep;
  reviewComplete?: boolean;
  addressComplete?: boolean;
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
          return (
            <div key={step.id} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: done
                      ? "var(--saf)"
                      : active
                        ? "var(--safd)"
                        : "var(--s3)",
                    borderColor: accent ? "var(--saf)" : "var(--ln2)",
                  }}
                  transition={{ duration: 0.25 }}
                  className="w-7 h-7 rounded-full border flex items-center justify-center shrink-0"
                  aria-current={active ? "step" : undefined}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5" style={{ color: "var(--onsaf)" }} />
                  ) : (
                    <span
                      className="text-[11px] font-bold tabular-nums"
                      style={{ color: active ? "var(--safb)" : "var(--mut)" }}
                    >
                      {step.index}
                    </span>
                  )}
                </motion.div>
                <span
                  className="text-[11px] uppercase tracking-[0.12em] font-semibold truncate"
                  style={{ color: accent ? "var(--safb)" : "var(--mut)" }}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="relative flex-1 h-px overflow-hidden" style={{ background: "var(--ln2)" }}>
                  <motion.div
                    initial={false}
                    animate={{ width: i < currentIdx ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0"
                    style={{ background: "var(--saf)" }}
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
