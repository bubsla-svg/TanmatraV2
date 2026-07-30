import type { DishData } from "@workspace/menu-catalog";
import { getSourcingForDish } from "@/lib/catalog";

export function SourcingTransparency({ dish }: { dish: DishData }) {
  const sourcing = getSourcingForDish(dish);
  const hasAllergens = !!dish.allergens && dish.allergens.length > 0;
  const allergens = hasAllergens ? dish.allergens : ["None reported"];

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 flex flex-col gap-6 shadow-sm">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Farm to Tray Sourcing
        </span>
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-ink mt-1">
          Ingredient Origin & Clinical Sourcing
        </h2>
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">
          Every ingredient in our {dish.kitchen.toUpperCase()} kitchen undergoes zero-pesticide verification and cold-chain temperature locking.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {sourcing.map((note, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-line bg-surface-raised p-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-ink shrink-0 sm:w-28">
              {note.area}
            </span>
            <p className="text-sm text-ink-muted leading-relaxed">{note.detail}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-6 flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink">Strict Allergen Clarification</h3>
        <div className="flex flex-wrap gap-2">
          {allergens.map((a, idx) => (
            <span
              key={idx}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${
                hasAllergens ? "border border-line bg-surface-raised text-ink" : "bg-sage-soft text-sage-text"
              }`}
            >
              {a}
            </span>
          ))}
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">
          Prepared in a facility that also handles nuts, seeds, and organic dairy. Our kitchen enforces strict station sanitation and utensil segregation between allergen builds.
        </p>
      </div>
    </div>
  );
}
