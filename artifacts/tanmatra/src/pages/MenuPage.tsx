import React, { useState } from "react";
import { GlobalLayout } from "../components/Layouts";
import { HorizontalSnapRail } from "../components/HorizontalSnapRail";
import { SafeImage } from "../components/SafeImage";
import { PriceDisplay } from "../components/PriceDisplay";
import { ClinicalBadge, FilterChip } from "../components/Badges";
import { DishQuickViewSheet } from "../components/DishQuickViewSheet";
import { CartDrawer } from "../components/CartDrawer";
import { PlannedMeal } from "../domain/types";

const MENU_CATEGORIES = ["All Meals", "Low-GI Glycemic", "High Protein", "Gut Recovery", "Keto Metabolic"];

const SAMPLE_MENU: PlannedMeal[] = [
  {
    mealId: "m1",
    name: "Golden Glycemic Quinoa Bowl",
    slug: "golden-glycemic-quinoa-bowl",
    imageUrl: "https://picsum.photos/seed/quinoa/800/600",
    calories: 420,
    proteinGrams: 22,
    carbsGrams: 48,
    fatGrams: 14,
    clinicalTags: ["low-gi", "diabetic-friendly"],
    isLocked: false,
    pricePaise: 29900,
  },
  {
    mealId: "m2",
    name: "Nocturnal Recovery Salmon & Asparagus",
    slug: "nocturnal-recovery-salmon",
    imageUrl: "https://picsum.photos/seed/salmon/800/600",
    calories: 510,
    proteinGrams: 38,
    carbsGrams: 16,
    fatGrams: 26,
    clinicalTags: ["omega-3", "anti-inflammatory"],
    isLocked: false,
    pricePaise: 44900,
  },
  {
    mealId: "m3",
    name: "Therapeutic Turmeric Dal & Wild Rice",
    slug: "therapeutic-turmeric-dal",
    imageUrl: "https://picsum.photos/seed/dal/800/600",
    calories: 380,
    proteinGrams: 18,
    carbsGrams: 54,
    fatGrams: 9,
    clinicalTags: ["gut-health", "vegan"],
    isLocked: false,
    pricePaise: 24900,
  },
  {
    mealId: "m4",
    name: "Metabolic Roasted Chicken & Avocado",
    slug: "metabolic-roasted-chicken",
    imageUrl: "https://picsum.photos/seed/chicken/800/600",
    calories: 460,
    proteinGrams: 42,
    carbsGrams: 12,
    fatGrams: 24,
    clinicalTags: ["high-protein", "keto-friendly"],
    isLocked: false,
    pricePaise: 38900,
  }
];

interface MenuPageProps {
  onNavigate: (route: string) => void;
}

export const MenuPage: React.FC<MenuPageProps> = ({ onNavigate }) => {
  const [selectedCategory, setSelectedCategory] = useState("All Meals");
  const [activeQuickViewMeal, setActiveQuickViewMeal] = useState<PlannedMeal | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <GlobalLayout activeTab="menu" currentRoute="/menu" onNavigate={onNavigate}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Therapeutic Culinary Menu</h1>
          <p className="text-xs text-slate-400 mt-1">Browse dishes by clinical category or customize accompaniments</p>
        </div>

        <button 
          onClick={() => setIsCartOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-slate-200 text-xs font-semibold flex items-center gap-2 self-start md:self-auto min-h-[44px]"
        >
          <span>🛒 View Cart</span>
        </button>
      </div>

      {/* Horizontal Category Rail */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
        {MENU_CATEGORIES.map(cat => (
          <FilterChip
            key={cat}
            label={cat}
            isSelected={selectedCategory === cat}
            onClick={() => setSelectedCategory(cat)}
          />
        ))}
      </div>

      {/* Horizontal Snap Rail for Fast Discovery (Mobile Ergonomics Rule) */}
      <HorizontalSnapRail title="Recommended Therapeutic Dishes" subtitle="Tap any dish for clinical details">
        {SAMPLE_MENU.map((meal) => (
          <div 
            key={meal.mealId}
            onClick={() => setActiveQuickViewMeal(meal)}
            className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-4 rounded-2xl cursor-pointer transition-all duration-200 group flex flex-col justify-between h-full"
          >
            <div>
              <SafeImage src={meal.imageUrl} alt={meal.name} aspectRatio="4/3" className="mb-3" />
              <div className="flex gap-1 mb-2">
                {meal.clinicalTags.map(t => (
                  <ClinicalBadge key={t} label={t} variant="gold" />
                ))}
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-400 transition-colors line-clamp-2">
                {meal.name}
              </h3>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <PriceDisplay pricePaise={meal.pricePaise} size="sm" />
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                + Quick View
              </span>
            </div>
          </div>
        ))}
      </HorizontalSnapRail>

      {/* Dish Quick View Sheet */}
      <DishQuickViewSheet
        meal={activeQuickViewMeal}
        isOpen={!!activeQuickViewMeal}
        onClose={() => setActiveQuickViewMeal(null)}
        onAddedToCart={() => setIsCartOpen(true)}
      />

      {/* Cart Slide-Over Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckoutClick={() => {
          setIsCartOpen(false);
          onNavigate("/checkout");
        }}
      />
    </GlobalLayout>
  );
};
