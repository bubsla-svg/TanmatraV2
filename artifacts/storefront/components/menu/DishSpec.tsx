import type { DishData } from "@workspace/menu-catalog";
import { MACROS_PENDING_LABEL } from "@/lib/format";
import { Disclosure } from "@/components/primitives/Disclosure";

const GI_LABEL: Record<DishData["glycaemicIndex"], string> = {
  low: "Low",
  medium: "Med",
  high: "High",
};

const CHIP =
  "inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-ink-muted";
const ROW = "font-display text-lg font-semibold leading-tight text-primary";

/**
 * The dish sheet's detail rows (PR-11e — brief CUJ 3 §3-4). The headline
 * kcal / P / C / F grid above stays the always-visible summary row; the rest
 * sits in the shared `Disclosure`: "Nutrition" (diet and GI marks, fibre,
 * sugar) and "Ingredients" (the full declaration — never clamped or
 * summarised, complete the moment the row opens). Same two labels as the full
 * page's sections, so the quick view and the page read as one thing.
 */
export function DishSpec({ dish }: { dish: DishData }) {
  const est = dish.macrosEstimated ? "≈" : "";
  const nutrition = (
    <div className="flex flex-col gap-3">
      {/* diet + glycaemic-index chips — colour is never the sole signal (the
          shape + label carry it too), so the veg/non-veg mark stays legible
          without colour. */}
      <div className="flex flex-wrap gap-2">
        <span className={CHIP}>
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 ${dish.isVeg ? "rounded-full" : "rounded-[2px]"}`}
            style={{ backgroundColor: dish.isVeg ? "var(--sage)" : "var(--danger)" }}
          />
          {dish.isVeg ? "Veg" : "Non-veg"}
        </span>
        <span className={CHIP}>GI {GI_LABEL[dish.glycaemicIndex]}</span>
      </div>

      {/* nutrition facts beyond the headline kcal/P/C/F grid */}
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <dt className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Fibre</dt>
          <dd className="mt-1 font-data text-sm font-bold text-primary">
            {dish.macrosProvisional ? (
              <span className="font-sans text-xs font-normal normal-case text-ink-muted">
                {MACROS_PENDING_LABEL}
              </span>
            ) : (
              <>
                {est}
                {dish.macros.fiber} g
              </>
            )}
          </dd>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <dt className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Sugar</dt>
          <dd className="mt-1 font-data text-sm font-bold text-primary">
            {dish.sugarPerServing || "—"}
          </dd>
        </div>
      </dl>
    </div>
  );

  const items = [
    { key: "nutrition", summary: <span className={ROW}>Nutrition</span>, body: nutrition },
    ...(dish.ingredients.length > 0
      ? [
          {
            key: "ingredients",
            summary: <span className={ROW}>Ingredients</span>,
            body: (
              <ul className="flex flex-wrap gap-1.5">
                {dish.ingredients.map((ingredient, i) => (
                  <li key={i} className="rounded-full bg-secondary px-3 py-1 text-xs text-ink-muted">
                    {ingredient}
                  </li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="mt-6">
      <Disclosure items={items} />
    </div>
  );
}
