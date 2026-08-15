import type { DishData } from "@workspace/menu-catalog";

const GI_LABEL: Record<DishData["glycaemicIndex"], string> = {
  low: "Low",
  medium: "Med",
  high: "High",
};

/**
 * Dish specification block for BOTH PDP surfaces (the canonical /dish/[slug]
 * page and the /menu?dish= drawer): diet + glycaemic-index chips, the nutrition
 * facts the headline macro grid omits (fibre, sugar), and the full ingredient
 * declaration. Pure presentational — reads only fields already present on
 * DishData, so it renders identically in an RSC (the page) or inside a client
 * island (the drawer). Estimated macros carry a "≈", matching the grid.
 */
export function DishSpec({ dish }: { dish: DishData }) {
  const est = dish.macrosEstimated ? "≈" : "";
  return (
    <div className="mt-6 space-y-5">
      {/* diet + glycaemic-index chips — colour is never the sole signal (the
          shape + label carry it too), so the veg/non-veg mark stays legible
          without colour. */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 ${dish.isVeg ? "rounded-full" : "rounded-[2px]"}`}
            style={{ backgroundColor: dish.isVeg ? "var(--sage)" : "var(--danger)" }}
          />
          {dish.isVeg ? "Veg" : "Non-veg"}
        </span>
        <span className="inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
          GI {GI_LABEL[dish.glycaemicIndex]}
        </span>
      </div>

      {/* nutrition facts beyond the headline kcal/P/C/F grid */}
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-3xl border border-line bg-surface p-4">
          <dt className="text-2xs uppercase tracking-wide text-ink-muted">Fibre</dt>
          <dd className="mt-1 font-mono text-sm tabular-nums text-ink">
            {est}
            {dish.macros.fiber} g
          </dd>
        </div>
        <div className="rounded-3xl border border-line bg-surface p-4">
          <dt className="text-2xs uppercase tracking-wide text-ink-muted">Sugar</dt>
          <dd className="mt-1 font-mono text-sm tabular-nums text-ink">
            {dish.sugarPerServing || "—"}
          </dd>
        </div>
      </dl>

      {/* full ingredient declaration — clinical product, so the list is never
          clamped or summarised. */}
      {dish.ingredients.length > 0 && (
        <div>
          <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">
            Ingredients
          </h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {dish.ingredients.map((ingredient, i) => (
              <li
                key={i}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted"
              >
                {ingredient}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
