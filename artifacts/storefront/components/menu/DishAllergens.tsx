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
      className="mt-6 rounded-lg border border-line bg-surface p-4"
      style={warn ? { borderColor: "var(--danger)" } : undefined}
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        Allergens
      </h2>
      <p className="mt-1 text-sm font-semibold text-ink">{view.heading}</p>

      {view.items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
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

      <p className="mt-2 text-xs text-ink-faint">{view.note}</p>
    </section>
  );
}
