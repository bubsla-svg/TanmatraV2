"use client";
// Client: a timed dismissal and an Undo tap.
import { useEffect } from "react";

/** How long the removal stays undoable — the q-commerce convention. */
export const REMOVED_TOAST_MS = 4000;

/**
 * "Removed · Undo" (audit 2026-09-17). Blinkit/Zepto grammar: minus at
 * quantity 1 removes the line — same here — but they give four seconds to
 * take it back, and this app gave nothing: no confirm, no undo, and the
 * stepper's live region unmounted with the line, so a screen reader never
 * heard the removal either. `role="status"` announces it; Undo restores the
 * line at the quantity it had.
 *
 * Sits above the bottom band (tab bar + mini-cart pill) at the modal tier so
 * it is also visible over the cart drawer, where most removals happen.
 */
export function CartRemovedToast({
  name,
  onUndo,
  onDone,
}: {
  name: string;
  onUndo: () => void;
  onDone: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onDone, REMOVED_TOAST_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-[var(--z-modal)] flex justify-center px-4 md:bottom-24"
    >
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-line bg-surface-raised py-1.5 pl-4 pr-1.5 text-sm text-ink shadow-lg animate-bar-in">
        <span className="min-w-0 truncate">
          Removed <span className="font-semibold">{name}</span>
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-gold-text transition-transform active:scale-[0.98]"
        >
          Undo
        </button>
      </div>
    </div>
  );
}
