import { type ReactNode } from "react";
import { useDialogA11y } from "@/hooks/useDialogA11y";

interface MenuFilterSheetProps {
  open: boolean;
  onClose: () => void;
  /** Live count of matching dishes — drives the primary action label. */
  resultCount: number;
  /** Number of active secondary filters — gates the "Clear all" affordance. */
  activeCount: number;
  onReset: () => void;
  /** The filter rails, owned by the Menu container so filter state stays there. */
  children: ReactNode;
}

const TITLE_ID = "menu-filter-sheet-title";

/**
 * Dedicated filter surface (design contract §2.2 — "advanced filters inside a
 * dedicated filter surface"). A bottom sheet that lifts the secondary filters
 * off the scroll flow: the body scrolls internally while the header and the one
 * primary action ("Show N dishes") stay pinned. Focus-trapped, Escape-closable,
 * and focus-restoring via useDialogA11y — the same money-path a11y hook used on
 * the checkout charge gates. Reduced-motion collapses the slide-up entrance.
 */
export default function MenuFilterSheet({
  open,
  onClose,
  resultCount,
  activeCount,
  onReset,
  children,
}: MenuFilterSheetProps) {
  const { panelRef, onKeyDown } = useDialogA11y<HTMLDivElement>(open, onClose);
  if (!open) return null;

  return (
    <div className="filtersheet-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="filtersheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="filtersheet-grab" aria-hidden="true" />
        <div className="filtersheet-head">
          <h2 id={TITLE_ID} className="h2" style={{ fontSize: 18 }}>
            Filters
          </h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close filters">
            <i className="ph-bold ph-x" />
          </button>
        </div>

        <div className="filtersheet-body">{children}</div>

        <div className="filtersheet-foot">
          {activeCount > 0 && (
            <button className="btn btn-g" onClick={onReset}>
              Clear all ({activeCount})
            </button>
          )}
          <button className="btn btn-p f1" onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? "dish" : "dishes"}
          </button>
        </div>
      </div>
    </div>
  );
}
