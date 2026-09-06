import type { DishData } from "@workspace/menu-catalog";
import { allergenView } from "@/lib/allergenCopy";
import { KitchenSafetyChip } from "@/components/trust/KitchenSafetySheet";

/**
 * Allergen disclosure block for BOTH PDP surfaces. Unlike a bare
 * `allergens.join(", ")`, this preserves the catalog's three-state safety
 * distinction (reviewed / auto-detected / under-review) via `allergenView`, so
 * an empty list is never silently rendered as "no allergens" when the data is
 * actually unknown. The `under review` state carries a danger-accented border
 * because a customer with allergies must act on it. Pure presentational.
 */
export function DishAllergens({ dish }: { dish: DishData }) {
  const view = allergenView(dish);
  const warn = view.tone === "warn";

  return (
    <section
      className={`mt-6 rounded-2xl border bg-surface p-5 ${
        warn ? "border-danger" : "border-line"
      }`}
    >
      <h2 className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">
        Allergens
      </h2>
      <p className="mt-1 font-display text-lg font-semibold leading-tight text-primary">{view.heading}</p>

      {view.items.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {view.items.map((item) => (
            <li
              key={item}
              className="rounded-full bg-secondary px-2.5 py-1 text-xs text-ink-muted"
            >
              {item}
            </li>
          ))}
        </ul>
      )}

      {view.affirmativeNone ? (
        /* Quiet check line — keyed off `affirmativeNone`, the one RD-reviewed
           state allowed to affirm absence. Derived/unchecked never get it. */
        <p className="mt-2 flex items-center gap-1.5 text-xs text-sage-text">
          <span aria-hidden="true">{"✓"}</span>
          {view.note}
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-faint">{view.note}</p>
      )}

      {/* T-20: the kitchen's credentials, tappable, in the block a customer
          with allergies reads most carefully — not a 12px line under a bar. */}
      <div className="mt-3">
        <KitchenSafetyChip />
      </div>
    </section>
  );
}
