import { cn } from "@/lib/utils";
import { Chip, Price, DishImage, RdBadge } from "@/components/primitives";
import type { PlanChip } from "./planDisplay";

interface PlanCardProps {
  name: string;
  /** One-line promise, ≤8 words. */
  promise: string;
  heroImage: string;
  /** Per-meal price in paise (null for flat-priced plans → total leads). */
  pricePerMealPaise: number | null;
  /** Cycle total in paise (server-quoted). */
  totalPaise: number;
  chips?: PlanChip[];
  variant: "matched" | "alt";
  /** Clinical plans (Steady, GLP-1) carry the RD credibility beat (02d §6). */
  rdBadge?: { rdName: string; credential: string; photo?: string };
  /** Trial secondary CTA price in paise (renders "Try 3 days" link). */
  trialPricePaise?: number;
  onStart: () => void;
  onTrial?: () => void;
  className?: string;
}

/**
 * `<PlanCard>` — 02f §2.2. Page-level composition of the primitives (no shared
 * `<Card>` base). `variant="matched"` is the recognition mechanic: full width,
 * saffron CTA, chips, RD badge — ~2× the visual weight of `variant="alt"`
 * (condensed, outlined CTA, no chips). Per-meal price leads; total is secondary.
 */
export function PlanCard({
  name,
  promise,
  heroImage,
  pricePerMealPaise,
  totalPaise,
  chips = [],
  variant,
  rdBadge,
  trialPricePaise,
  onStart,
  onTrial,
  className,
}: PlanCardProps) {
  const matched = variant === "matched";
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl",
        matched ? "w-full" : "w-full",
        className,
      )}
      style={{
        backgroundColor: "var(--color-ink-800)",
        border: matched
          ? "1px solid var(--color-saffron-700)"
          : "1px solid var(--color-ink-600)",
      }}
      aria-label={`${name} plan`}
    >
      <DishImage src={heroImage} alt={`${name} — signature dish`} ratio="16:9" priority={matched} />

      <div className={cn("flex flex-col gap-2", matched ? "p-4" : "p-3")}>
        <h3 style={{ fontSize: matched ? "1.375rem" : "1.05rem", fontWeight: 600 }}>{name}</h3>
        <p className="text-sm" style={{ color: "var(--color-ink-500)", margin: 0 }}>
          {promise}
        </p>

        {matched && rdBadge && (
          <RdBadge rdName={rdBadge.rdName} credential={rdBadge.credential} photo={rdBadge.photo} />
        )}

        <div className="flex items-baseline gap-2">
          {pricePerMealPaise != null ? (
            <>
              <Price paise={pricePerMealPaise} size={matched ? "display" : "lg"} />
              <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>
                /meal
              </span>
              <span className="text-xs" style={{ color: "var(--color-ink-500)" }}>
                · <Price paise={totalPaise} size="sm" /> total
              </span>
            </>
          ) : (
            <Price paise={totalPaise} size={matched ? "display" : "lg"} />
          )}
        </div>

        {matched && chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.slice(0, 3).map((c) => (
              <Chip key={c.glyph + c.label} glyph={c.glyph} label={c.label} tone={c.tone} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onStart}
          className="mt-1 rounded-xl px-4 py-3 text-center font-semibold transition-transform active:scale-[0.98]"
          style={
            matched
              ? { backgroundColor: "var(--color-saffron-500)", color: "var(--color-saffron-on)" }
              : {
                  backgroundColor: "transparent",
                  color: "var(--color-saffron-300)",
                  border: "1px solid var(--color-saffron-700)",
                }
          }
        >
          Start {name}
        </button>

        {trialPricePaise != null && onTrial && (
          <button
            type="button"
            onClick={onTrial}
            className="text-center text-sm underline-offset-2 hover:underline"
            style={{ color: "var(--color-ink-500)", background: "none", border: "none" }}
          >
            Try 3 days — <Price paise={trialPricePaise} size="sm" />
          </button>
        )}
      </div>
    </section>
  );
}
