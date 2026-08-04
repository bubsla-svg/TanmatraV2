import React, { useState } from "react";
import { PlannedMeal } from "../domain/types";
import { SafeImage } from "./SafeImage";
import { ClinicalBadge } from "./Badges";
import { PriceDisplay } from "./PriceDisplay";
import { PrimaryCTA } from "./CTA";
import { AccordionItem } from "./Accordion";
import { CartService } from "../services/CartService";

interface DishQuickViewSheetProps {
  meal: PlannedMeal | null;
  isOpen: boolean;
  onClose: () => void;
  onAddedToCart?: () => void;
}

export const DishQuickViewSheet: React.FC<DishQuickViewSheetProps> = ({
  meal,
  isOpen,
  onClose,
  onAddedToCart,
}) => {
  const [selectedAccompaniment, setSelectedAccompaniment] = useState<string>("Brown Rice");

  if (!isOpen || !meal) return null;

  const handleAddToCart = () => {
    CartService.addItem(meal, selectedAccompaniment);
    onAddedToCart?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/80 backdrop-blur-md transition-opacity">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl md:rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {meal.clinicalTags.map(tag => (
              <ClinicalBadge key={tag} label={tag} variant="gold" />
            ))}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center">
            ✕
          </button>
        </div>

        {/* Media */}
        <SafeImage src={meal.imageUrl} alt={meal.name} aspectRatio="16/9" className="mb-4" />

        {/* Info */}
        <h2 className="text-xl font-extrabold text-slate-100 mb-1">{meal.name}</h2>
        <PriceDisplay pricePaise={meal.pricePaise} size="lg" className="mb-4" />

        {/* Accompaniments */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase text-slate-400 mb-2 tracking-wider">
            Select Accompaniment
          </label>
          <div className="grid grid-cols-2 gap-2">
            {["Brown Rice", "Quinoa Pilaf", "Steamed Millets", "Zero-Carb Cauliflower Rice"].map((acc) => (
              <button
                key={acc}
                onClick={() => setSelectedAccompaniment(acc)}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border text-left min-h-[44px] ${
                  selectedAccompaniment === acc
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/40"
                    : "bg-slate-950 text-slate-400 border-slate-800"
                }`}
              >
                {acc}
              </button>
            ))}
          </div>
        </div>

        {/* Progressive Clinical Disclosure (Collapsed by default) */}
        <div className="border-t border-slate-800 pt-4 mb-6">
          <AccordionItem title="Clinical Nutrition Rationale" subtitle="Tap to expand breakdown">
            <div className="grid grid-cols-4 gap-2 text-center my-2">
              <div className="p-2 bg-slate-950 rounded-xl">
                <span className="block text-[10px] text-slate-400">Calories</span>
                <span className="font-bold text-slate-200">{meal.calories} kcal</span>
              </div>
              <div className="p-2 bg-slate-950 rounded-xl">
                <span className="block text-[10px] text-slate-400">Protein</span>
                <span className="font-bold text-slate-200">{meal.proteinGrams}g</span>
              </div>
              <div className="p-2 bg-slate-950 rounded-xl">
                <span className="block text-[10px] text-slate-400">Carbs</span>
                <span className="font-bold text-slate-200">{meal.carbsGrams}g</span>
              </div>
              <div className="p-2 bg-slate-950 rounded-xl">
                <span className="block text-[10px] text-slate-400">Fat</span>
                <span className="font-bold text-slate-200">{meal.fatGrams}g</span>
              </div>
            </div>
            <p className="mt-2 text-slate-400">
              Formulated specifically for glycemic stabilization and anti-inflammatory response. Approved by Tanmatra Clinical RD Advisory Board.
            </p>
          </AccordionItem>
        </div>

        {/* Primary CTA */}
        <PrimaryCTA onClick={handleAddToCart} className="w-full">
          Add Dish to Order
        </PrimaryCTA>
      </div>
    </div>
  );
};
