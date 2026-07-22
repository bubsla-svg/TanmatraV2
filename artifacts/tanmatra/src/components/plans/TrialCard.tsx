import { cn } from "@/lib/utils";
import { Price, DishImage } from "@/components/primitives";

interface TrialCardProps {
  /** Trial price in paise (₹399). */
  pricePaise: number;
  /** The fixed trio thumbnails (02e §3.5) — exactly three. */
  thumbnails: string[];
  onStart: () => void;
  className?: string;
}

/**
 * `<TrialCard>` — 02f §2.6. The secondary hedge on plan surfaces. Outlined CTA,
 * NEVER saffron-filled (it must not out-compete the plan CTA it sits beneath).
 * The mechanics line is verbatim and the only one shown.
 */
export function TrialCard({ pricePaise, thumbnails, onStart, className }: TrialCardProps) {
  return (
    <section
      className={cn("flex flex-col gap-3 rounded-2xl p-4", className)}
      style={{ backgroundColor: "var(--color-ink-800)", border: "1px solid var(--color-ink-600)" }}
      aria-label="3-Day Taste Test"
    >
      <div className="flex items-baseline justify-between">
        <h4 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>Try 3 days first</h4>
        <Price paise={pricePaise} size="lg" />
      </div>

      <p className="text-sm" style={{ color: "var(--color-ink-500)", margin: 0 }}>
        Credited in full when you start any plan within 7 days.
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        {thumbnails.slice(0, 3).map((src, i) => (
          <DishImage key={src + i} src={src} alt="Trial dish" ratio="1:1" className="rounded-lg" />
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="rounded-xl px-4 py-2.5 text-center font-semibold transition-transform active:scale-[0.98]"
        style={{
          backgroundColor: "transparent",
          color: "var(--color-saffron-300)",
          border: "1px solid var(--color-saffron-700)",
        }}
      >
        Start the taste test
      </button>
    </section>
  );
}
