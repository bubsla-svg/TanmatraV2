"use client"; // Interactive card flip and state management
// Tap-to-flip clinical dish photo card revealing specification sheet
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMacroLine, formatPaise } from "@/lib/format";
import { emitLpEvent } from "@/lib/lpEvents";
import { SpecSheetCard, type ClinicalDishSpec } from "./SpecSheetCard";
import { SafeImage } from "@/components/ui/SafeImage";

/**
 * `spec` is REQUIRED, and that is the fix.
 *
 * It used to be optional, defaulting to a fictional dish: a "Glazed Salmon &
 * Quinoa Bowl" (stock photo, US healthy-bowl trope, shown to Noida lunch
 * buyers) with invented macros, an invented GI classification, an invented
 * dietitian's note, and — when its own price lookup missed — a price silently
 * borrowed from a DIFFERENT plan's table. Nothing rendered it with real data,
 * so the default WAS the component: the only dish this card ever showed was
 * one that does not exist.
 *
 * Making the prop required means the card cannot render without a real dish
 * behind it. Its one caller resolves that from the catalog and omits the card
 * entirely when no dish qualifies (see lib/planCardDish.ts).
 */
export interface FlipCardProps {
  spec: ClinicalDishSpec;
  initialFlipped?: boolean;
}

export function FlipCard({ spec, initialFlipped = false }: FlipCardProps) {
  const [flipped, setFlipped] = useState(initialFlipped);

  function toggleFlip(newFlipped: boolean) {
    setFlipped(newFlipped);
    if (newFlipped) {
      emitLpEvent("spec_card_flip", {
        dish: spec.name,
        id: spec.id,
        giClass: spec.giClass ?? "unclassified",
      });
    }
  }

  if (flipped) {
    return (
      <div className="h-full w-full transition-all duration-300">
        <SpecSheetCard spec={spec} onFlipBack={() => toggleFlip(false)} />
      </div>
    );
  }

  // Reads the dish's own flag. The old expression was `spec.macros ? "~" : ""`
  // — and `macros` is a required field, so it was always truthy: every dish
  // got the approximation tilde, including ones whose macros are exact.

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
      <button
        type="button"
        onClick={() => toggleFlip(true)}
        className="flex w-full flex-col text-left outline-none"
        aria-label={`View clinical spec sheet for ${spec.name}`}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-raised">
          {spec.image && (
            <SafeImage
              src={spec.image}
              alt={spec.name}
              className="h-full w-full"
              imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
            />
          )}
          <span
            role="img"
            aria-label={spec.isVeg ? "Vegetarian" : "Non-vegetarian"}
            className={`absolute left-2 top-2 inline-block h-3 w-3 ring-2 ring-[var(--surface)] ${
              spec.isVeg ? "rounded-full" : "rounded-[2px]"
            }`}
            style={{ backgroundColor: spec.isVeg ? "var(--sage)" : "var(--danger)" }}
          />
          <span className="absolute bottom-2 right-2 rounded-md border border-line bg-surface px-2 py-1 text-2xs font-semibold text-ink shadow">
            Tap for Specs ➔
          </span>
        </div>
        {/* Both lines below are the dish's own or absent. They used to fall
            back to "Clinical Macro Monitored" and "Precision macro balanced
            meal designed by certified clinical dietitians." — house sentences
            that read as findings about THIS dish and, with no catalog dish
            carrying either field, would have appeared under every one of
            them. A card that says less but only true things is the trade. */}
        <div className="flex flex-col gap-1.5 p-3 pb-0">
          <h3 className="text-sm font-semibold leading-snug text-ink">{spec.name}</h3>
          {spec.giClass && (
            <p className="text-2xs font-semibold text-ink-muted">{spec.giClass}</p>
          )}
          {spec.rdNote && (
            <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">{spec.rdNote}</p>
          )}
        </div>
      </button>

      <div className="mt-auto flex items-center justify-between gap-2 p-3 pt-2">
        <div className="flex flex-col">
          <span className="tabular text-sm font-semibold text-ink">
            {formatPaise(spec.price)}
          </span>
          <span className="tabular text-2xs text-ink-faint">
            {formatMacroLine(spec.macros, spec.macrosEstimated)}
          </span>
        </div>
        <Button
          type="button"
          onClick={() => toggleFlip(true)}
          shape="xl" size="fluid" className="px-3 py-1.5 text-xs font-semibold"
        >
          View Specs
        </Button>
      </div>
    </article>
  );
}
