import type { DishData } from "@workspace/menu-catalog";
import { getSourcingForDish } from "@/lib/catalog";

export function SourcingTransparency({ dish }: { dish: DishData }) {
  const sourcing = getSourcingForDish(dish);
  const hasAllergens = !!dish.allergens && dish.allergens.length > 0;
  const allergens = hasAllergens ? dish.allergens : ["None reported"];

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col gap-6 shadow-sm">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Farm to Tray Sourcing
        </span>
        <h2 className="text-lg font-semibold text-ink mt-1">
          Ingredient Origin & Clinical Sourcing
        </h2>
        <p className="text-xs text-ink-muted mt-1 leading-relaxed">
          Every ingredient in our {dish.kitchen.toUpperCase()} kitchen undergoes zero-pesticide verification and cold-chain temperature locking.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {sourcing.map((note, idx) => (
          <div key={idx} className="rounded-xl border border-line p-3.5 flex flex-col gap-1">
            <div className="text-xs font-semibold text-ink uppercase tracking-wide">&bull; {note.area}</div>
            <p className="text-xs text-ink-muted leading-relaxed">{note.detail}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-4 flex flex-col gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink">Strict Allergen Clarification</h3>
        <div className="flex flex-wrap gap-2 mt-1">
          {allergens.map((a, idx) => (
            <span
              key={idx}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                hasAllergens ? "border border-line bg-surface-raised text-ink" : "bg-sage-soft text-sage-text"
              }`}
            >
              {a}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
          Prepared in a facility that also handles nuts, seeds, and organic dairy. Our kitchen enforces strict station sanitation and utensil segregation between allergen builds.
        </p>
      </div>
    </div>
  );
}
