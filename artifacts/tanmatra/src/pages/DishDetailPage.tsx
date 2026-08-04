import React from "react";
import { FocusLayout } from "../components/Layouts";
import { SafeImage } from "../components/SafeImage";
import { PriceDisplay } from "../components/PriceDisplay";
import { ClinicalBadge } from "../components/Badges";
import { StickyLedger } from "../components/StickyLedger";
import { AccordionItem } from "../components/Accordion";
import { CartService } from "../services/CartService";
import { PlannedMeal } from "../domain/types";

interface DishDetailPageProps {
  meal?: PlannedMeal;
  onNavigate: (route: string) => void;
}

const DEFAULT_DISH: PlannedMeal = {
  mealId: "pdp_dish_1",
  name: "Golden Glycemic Quinoa Bowl",
  slug: "golden-glycemic-quinoa-bowl",
  imageUrl: "https://picsum.photos/seed/quinoa/1200/800",
  calories: 420,
  proteinGrams: 22,
  carbsGrams: 48,
  fatGrams: 14,
  clinicalTags: ["low-gi", "diabetic-friendly", "anti-inflammatory"],
  isLocked: false,
  pricePaise: 29900,
};

export const DishDetailPage: React.FC<DishDetailPageProps> = ({
  meal = DEFAULT_DISH,
  onNavigate,
}) => {
  const handleAddToCartAndCheckout = () => {
    CartService.addItem(meal);
    onNavigate("/checkout");
  };

  return (
    <FocusLayout 
      title={meal.name} 
      stepProgress="PDP" 
      onBack={() => onNavigate("/menu")}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Image */}
        <div>
          <SafeImage src={meal.imageUrl} alt={meal.name} aspectRatio="4/3" className="shadow-2xl border border-slate-800" />
        </div>

        {/* Right Column: Information & Clinical Breakdown */}
        <div className="space-y-6">
          <div className="flex gap-2">
            {meal.clinicalTags.map(tag => (
              <ClinicalBadge key={tag} label={tag} variant="emerald" />
            ))}
          </div>

          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">{meal.name}</h1>
          <PriceDisplay pricePaise={meal.pricePaise} size="xl" />

          <p className="text-sm text-slate-300 leading-relaxed">
            Formulated with organic tricolor quinoa, cold-pressed golden turmeric oil, and slow-roasted vegetables designed to maintain steady blood glucose levels without post-meal fatigue.
          </p>

          {/* Progressive Clinical Disclosure (Collapsed Accordion) */}
          <div className="border-t border-slate-800 pt-4">
            <AccordionItem title="Clinical Macronutrient Breakdown" subtitle="Tap to review metabolic details">
              <div className="grid grid-cols-4 gap-2 text-center my-3">
                <div className="p-3 bg-slate-950 rounded-xl">
                  <span className="block text-[10px] text-slate-400">Calories</span>
                  <span className="font-bold text-slate-100">{meal.calories} kcal</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl">
                  <span className="block text-[10px] text-slate-400">Protein</span>
                  <span className="font-bold text-slate-100">{meal.proteinGrams}g</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl">
                  <span className="block text-[10px] text-slate-400">Carbs</span>
                  <span className="font-bold text-slate-100">{meal.carbsGrams}g</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl">
                  <span className="block text-[10px] text-slate-400">Fat</span>
                  <span className="font-bold text-slate-100">{meal.fatGrams}g</span>
                </div>
              </div>
            </AccordionItem>

            <AccordionItem title="Allergen & Sourcing Transparency">
              <p className="text-xs text-slate-400">
                100% Gluten-free certified facility. Zero artificial preservatives, zero refined sugar, zero industrial seed oils.
              </p>
            </AccordionItem>
          </div>
        </div>
      </div>

      {/* FocusLayout Single Sticky Ledger */}
      <StickyLedger
        chargePaise={meal.pricePaise}
        ctaText="Add to Order & Checkout"
        onCtaClick={handleAddToCartAndCheckout}
      />
    </FocusLayout>
  );
};
