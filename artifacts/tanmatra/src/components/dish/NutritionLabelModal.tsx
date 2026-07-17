import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollText, ShieldCheck, Leaf, AlertTriangle, Sprout } from "lucide-react";
import type { DishData } from "@workspace/menu-catalog";
import { buildNutritionLabel, getSourcingForDish } from "@/lib/nutritionLabel";

interface Props {
  dish: DishData;
}

export default function NutritionLabelModal({ dish }: Props) {
  const label = buildNutritionLabel(dish);
  const sourcing = getSourcingForDish(dish);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-[11px] border-white/[0.08] text-nn-on-surface-variant hover:text-nn-primary hover:border-nn-primary/40"
        >
          <ScrollText className="w-3.5 h-3.5" />
          Full nutrition label & sourcing
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-nn-surface border-white/[0.08] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">{dish.name}</DialogTitle>
          <DialogDescription className="text-xs text-nn-on-surface-variant">
            Nutrition Facts &middot; Serving size: {label.servingSize}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Calories banner */}
          <div className="rounded-lg border-2 border-nn-primary/40 bg-nn-primary/5 p-4 flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-widest text-nn-on-surface-variant font-semibold">
              Calories
            </span>
            <span className="tabular-nums text-3xl font-bold text-nn-primary">
              {label.calories}
            </span>
          </div>

          {/* Macros table */}
          <div className="rounded-lg border border-white/[0.08] overflow-hidden">
            <div className="bg-nn-surface-high px-3 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-nn-on-surface-variant font-semibold">
              <span>Macros &amp; key nutrients</span>
              <span>Per serving</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-white/[0.08]">
                <NutRow label="Total fat" value={`${label.macros.fat} g`} />
                <NutRow
                  label="Saturated fat"
                  value={`${label.macros.saturatedFat} g`}
                  indented
                />
                <NutRow label="Sodium" value={`${label.macros.sodiumMg} mg`} />
                <NutRow label="Total carbohydrate" value={`${label.macros.carbs} g`} />
                <NutRow label="Dietary fibre" value={`${label.macros.fiber} g`} indented />
                <NutRow label="Total sugars" value={`${label.macros.sugar} g`} indented />
                <NutRow label="Protein" value={`${label.macros.protein} g`} bold />
              </tbody>
            </table>
          </div>

          {/* Micros */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-nn-secondary font-semibold mb-2">
              Micronutrients (estimated)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {label.micros.map((mn) => (
                <div
                  key={mn.key}
                  className="rounded-md border border-white/[0.08] bg-nn-surface-high px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wide text-nn-on-surface-variant">
                    {mn.label}
                  </p>
                  <p className="tabular-nums text-sm text-white font-semibold">
                    {mn.value}
                    <span className="text-[10px] text-nn-on-surface-variant font-normal ml-0.5">
                      {mn.unit}
                    </span>
                  </p>
                  <p className="text-[10px] text-nn-primary tabular-nums">
                    {mn.dailyTargetPct}% DV
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-nn-secondary mt-2 leading-relaxed">
              % Daily Value based on a 2,000 kcal reference diet. Micronutrient values
              estimated from ingredient composition; precise values are batch-tested
              monthly.
            </p>
          </div>

          {/* Claims */}
          {(label.containsClaims.length > 0 || label.freeFromClaims.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {label.containsClaims.length > 0 && (
                <div className="rounded-lg border border-clinical-sage/30 bg-clinical-sage/5 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-clinical-sage" />
                    <p className="text-[10px] uppercase tracking-widest text-clinical-sage font-semibold">
                      Health highlights
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {label.containsClaims.map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="border-clinical-sage/40 text-clinical-sage bg-clinical-sage/10 text-[10px]"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {label.freeFromClaims.length > 0 && (
                <div className="rounded-lg border border-nn-tertiary/30 bg-nn-tertiary/5 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Leaf className="w-3.5 h-3.5 text-nn-tertiary" />
                    <p className="text-[10px] uppercase tracking-widest text-nn-tertiary font-semibold">
                      Free from
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {label.freeFromClaims.map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="border-nn-tertiary/40 text-nn-tertiary bg-nn-tertiary/10 text-[10px]"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Allergens */}
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-[10px] uppercase tracking-widest text-orange-400 font-semibold">
                Allergens
              </p>
            </div>
            {label.allergens.length > 0 ? (
              <p className="text-xs text-nn-on-surface-variant">
                Contains: {label.allergens.join(", ")}.
              </p>
            ) : (
              <p className="text-xs text-nn-on-surface-variant">
                No common allergens reported in this dish.
              </p>
            )}
            <p className="text-[10px] text-nn-secondary mt-1 leading-relaxed">
              Prepared in a kitchen that also handles dairy, gluten, soy, and tree nuts.
              Cross-contact is possible.
            </p>
          </div>

          <Separator className="bg-nn-surface-high" />

          {/* Ingredients */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-nn-secondary font-semibold mb-2">
              Ingredients (in descending order)
            </p>
            <p className="text-xs text-nn-on-surface-variant leading-relaxed">
              {dish.ingredients.join(" · ")}.
            </p>
          </div>

          {/* Sourcing */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sprout className="w-3.5 h-3.5 text-clinical-sage" />
              <p className="text-[10px] uppercase tracking-widest text-nn-secondary font-semibold">
                Sourcing &amp; preparation
              </p>
            </div>
            <ul className="space-y-2">
              {sourcing.map((s) => (
                <li
                  key={s.area}
                  className="text-xs text-nn-on-surface-variant leading-relaxed"
                >
                  <span className="text-white font-medium">{s.area}: </span>
                  {s.detail}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <DialogClose asChild>
            <Button
              variant="outline"
              className="border-white/[0.08] text-nn-on-surface-variant hover:text-white"
            >
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NutRow({
  label,
  value,
  indented,
  bold,
}: {
  label: string;
  value: string;
  indented?: boolean;
  bold?: boolean;
}) {
  return (
    <tr>
      <td
        className={`px-3 py-2 ${indented ? "pl-8 text-nn-on-surface-variant" : "text-white"} ${
          bold ? "font-semibold" : ""
        }`}
      >
        {label}
      </td>
      <td
        className={`px-3 py-2 text-right tabular-nums ${
          bold ? "text-white font-semibold" : "text-nn-on-surface-variant"
        }`}
      >
        {value}
      </td>
    </tr>
  );
}
