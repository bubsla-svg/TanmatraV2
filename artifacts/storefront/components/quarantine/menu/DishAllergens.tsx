import type { DishData } from "@workspace/menu-catalog";
import { allergenView } from "@/lib/allergenCopy";

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
      className={`mt-6 rounded-3xl border bg-surface p-5 ${
        warn ? "border-[var(--danger)]" : "border-line"
      }`}
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        Allergens
      </h2>
      <p className="mt-1 text-sm font-semibold text-ink">{view.heading}</p>

      {view.items.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {view.items.map((item) => (
            <li
              key={item}
              className="rounded-full border border-line bg-surface-raised px-2.5 py-1 text-xs text-ink-muted"
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
    </section>
  );
}
