import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import {
  ROUTER_ANSWERS,
  MENU_ESCAPE_ANSWER,
  type RouterDestination,
} from "./cuj";

interface GoalRouterProps {
  onSelect: (destination: RouterDestination, answer: string) => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * `<GoalRouter>` — 02d §2 / 02f §2.1: "What's lunch for?". One question, five
 * stacked answers (≥64px, text only — no icons), the menu escape hatch visually
 * subordinate and last. Recognition, not comparison: the answer IS the plan.
 * No progress indicator (there are no steps to imply).
 */
export function GoalRouter({ onSelect, onDismiss, className }: GoalRouterProps) {
  const choose = (answer: string, destination: RouterDestination) => {
    track("cuj_router_answer", {
      answer,
      destination: destination.kind === "plan" ? destination.planId : "menu",
    });
    onSelect(destination, answer);
  };

  return (
    <section
      className={cn("flex min-h-[100dvh] flex-col px-4 pt-6 pb-8", className)}
      aria-label="Find my plan"
    >
      {onDismiss && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="p-2"
            style={{ color: "var(--color-ink-500)", background: "none", border: "none" }}
          >
            <i className="ph-bold ph-x" aria-hidden="true" />
          </button>
        </div>
      )}

      <h1 className="mb-6 mt-2" style={{ fontSize: "2rem", fontWeight: 600, lineHeight: 1.15 }}>
        What's lunch for?
      </h1>

      <div className="mt-auto flex flex-col gap-3">
        {ROUTER_ANSWERS.map(({ answer, destination }) => {
          const subordinate = answer === MENU_ESCAPE_ANSWER;
          return (
            <button
              key={answer}
              type="button"
              onClick={() => choose(answer, destination)}
              className="rounded-2xl px-4 text-left font-medium transition-transform active:scale-[0.98]"
              style={
                subordinate
                  ? {
                      minHeight: 52,
                      background: "none",
                      border: "none",
                      color: "var(--color-ink-500)",
                      textAlign: "center",
                    }
                  : {
                      minHeight: 64,
                      backgroundColor: "var(--color-ink-800)",
                      border: "1px solid var(--color-ink-600)",
                      color: "var(--color-stone-0)",
                    }
              }
            >
              {answer}
            </button>
          );
        })}
      </div>
    </section>
  );
}
