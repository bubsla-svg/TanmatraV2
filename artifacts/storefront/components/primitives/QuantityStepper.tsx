"use client";
// Justification: the two buttons carry the caller's click handlers.
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * The one quantity control (PR-11b — brief CUJ 4 §5, matrix #6). Five
 * surfaces used to draw their own: the dish card's in-cart face, the
 * marketplace card and PDP, the PDP buy ledger, the cart drawer rows and the
 * checkout order summary — same three-part control, five skins (40 to 48 px,
 * hairline or gold ring, pill or rounded). This is the skin; behaviour stays
 * with the caller, which owns the cart write and decides what `value` is.
 *
 * Contract:
 *  - `role="group"` named by `label` (`"<item> quantity"`) — the e2e page
 *    objects find the control by that name, so the name is the caller's.
 *  - The button names default to "Decrease quantity" / "Increase quantity";
 *    the cart-side rows use the shorter "Decrease" / "Increase" and pass them
 *    in — both spellings are pinned by e2e specs, so neither is changed here.
 *  - 48 px targets (the brief's money-path minimum), the live count between
 *    them, and the README's rule for a perceivable boundary: a fill, not a
 *    hairline.
 *  - `pending` disables both buttons and marks the group busy — the client
 *    boundary the brief asks for against rapid taps. Decrease is also
 *    disabled at `min` (zero), so the control never asks the store for a
 *    negative quantity.
 *  - The events are passed through untouched; a caller that must stop a
 *    parent card's navigation calls `preventDefault` itself, as before.
 */
export interface QuantityStepperProps {
  value: number;
  /** Accessible name of the group — `"<item name> quantity"`. */
  label: string;
  onDecrease: (e: MouseEvent<HTMLButtonElement>) => void;
  onIncrease: (e: MouseEvent<HTMLButtonElement>) => void;
  decreaseLabel?: string;
  increaseLabel?: string;
  /** Decrease is disabled at this value. */
  min?: number;
  /** A request is in flight for this line — both buttons disabled, group busy. */
  pending?: boolean;
  /** "accent" is the in-cart face of a browse card (gold ring, gold glyphs). */
  tone?: "neutral" | "accent";
  /** Stretch to the container (a card's full-width control). */
  fluid?: boolean;
  className?: string;
}

const BUTTON =
  "flex min-h-12 min-w-12 items-center justify-center rounded-full text-lg font-semibold transition-transform active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100";

export function QuantityStepper({
  value,
  label,
  onDecrease,
  onIncrease,
  decreaseLabel = "Decrease quantity",
  increaseLabel = "Increase quantity",
  min = 0,
  pending = false,
  tone = "neutral",
  fluid = false,
  className,
}: QuantityStepperProps) {
  const glyph = tone === "accent" ? "text-gold-text" : "text-ink";
  return (
    <div
      role="group"
      aria-label={label}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex items-center rounded-full bg-surface-raised",
        tone === "accent" && "ring-1 ring-gold",
        fluid && "flex w-full justify-between",
        className,
      )}
    >
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={pending || value <= min}
        onClick={onDecrease}
        className={cn(BUTTON, glyph)}
      >
        −
      </button>
      <span aria-live="polite" className={cn("tabular min-w-6 text-center text-sm font-semibold text-ink", pending && "opacity-60")}>
        {value}
      </span>
      <button type="button" aria-label={increaseLabel} disabled={pending} onClick={onIncrease} className={cn(BUTTON, glyph)}>
        +
      </button>
    </div>
  );
}
