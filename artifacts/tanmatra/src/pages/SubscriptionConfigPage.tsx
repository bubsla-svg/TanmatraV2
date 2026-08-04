import React, { useState } from "react";
import { FocusLayout } from "../components/Layouts";
import { SafeImage } from "../components/SafeImage";
import { PriceDisplay } from "../components/PriceDisplay";
import { ClinicalBadge } from "../components/Badges";
import { StickyLedger } from "../components/StickyLedger";
import { PrimaryCTA, SecondaryCTA } from "../components/CTA";
import { PlanDraft, PlannedMeal } from "../domain/types";
import { PlanGenerationService } from "../services/PlanGenerationService";
import { PricingService } from "../services/PricingService";

interface SubscriptionConfigPageProps {
  planId?: string;
  onNavigate: (route: string) => void;
}

const DURATIONS = [
  { days: 7, totalMeals: 7, discountPercent: 0, pricePaise: 209300, origPaise: 209300, effectivePerMeal: 29900 },
  { days: 14, totalMeals: 14, discountPercent: 10, pricePaise: 376740, origPaise: 418600, effectivePerMeal: 26910 },
  { days: 30, totalMeals: 30, discountPercent: 20, pricePaise: 717600, origPaise: 897000, effectivePerMeal: 23920 },
];

export const SubscriptionConfigPage: React.FC<SubscriptionConfigPageProps> = ({
  planId = "glycemic-reset",
  onNavigate,
}) => {
  const [selectedDurationDays, setSelectedDurationDays] = useState(30);
  const [draft, setDraft] = useState<PlanDraft>(() => {
    const base: PlanDraft = {
      id: `draft_${Date.now()}`,
      version: 1,
      type: "recommended",
      currentStage: "configuration",
      servingCount: 1,
      mealSlots: ["lunch"],
      durationDays: 30,
      allergenExclusions: [],
      hardIngredientExclusions: [],
      dislikedIngredients: [],
      generatedMeals: [],
      lockedMealIds: [],
      manuallyReplacedMealIds: [],
      deliveryDates: ["2026-08-05", "2026-08-06", "2026-08-07"],
      entitlementIds: [],
      wearableInfluenceEnabled: false,
      validationErrors: [],
      unsavedChanges: false,
      serviceabilityStatus: "serviceable",
    };
    return PlanGenerationService.generateLineup(base, 6);
  });

  const activeDurationObj = DURATIONS.find(d => d.days === selectedDurationDays) || DURATIONS[2];

  const handleToggleKeep = (mealId: string) => {
    setDraft(PlanGenerationService.toggleKeep(draft, mealId));
  };

  const handleShuffle = () => {
    setDraft(PlanGenerationService.shuffle(draft));
  };

  const handleUndo = () => {
    setDraft(PlanGenerationService.undo(draft));
  };

  const handleProceedToCheckout = () => {
    // Generate authoritative server quote snapshot
    const quote = PricingService.generateQuote({ ...draft, durationDays: selectedDurationDays });
    // In real app, store quoteId in session/context
    onNavigate("/checkout");
  };

  return (
    <FocusLayout 
      title="Configure Recommended Plan" 
      stepProgress="Plan Builder" 
      onBack={() => onNavigate("/plans")}
    >
      <div className="space-y-10">
        {/* Header Summary */}
        <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl">
          <div className="flex gap-2 mb-3">
            <ClinicalBadge label="Metabolic Glycemic Reset" variant="gold" />
            <ClinicalBadge label="RD Reviewed" variant="emerald" />
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-slate-100 tracking-tight mb-2">
            Configure Your Day-by-Day Meal Lineup
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            Customize duration, review your exact meals, lock your favorites with Keep, or Shuffle unlocked slots.
          </p>
        </div>

        {/* Duration Selection (Mandatory display of price, original, savings %, effective per meal) */}
        <div>
          <h2 className="text-lg font-bold text-slate-100 mb-4">1. Select Plan Duration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DURATIONS.map((dur) => {
              const isSelected = selectedDurationDays === dur.days;
              return (
                <div
                  key={dur.days}
                  onClick={() => setSelectedDurationDays(dur.days)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? "bg-amber-500/10 border-amber-500/50 shadow-xl shadow-amber-500/5"
                      : "bg-slate-900 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-extrabold text-slate-100">{dur.days} Days</span>
                      {dur.discountPercent > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Save {dur.discountPercent}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mb-4">{dur.totalMeals} Total Meals</p>
                  </div>

                  <div>
                    <PriceDisplay pricePaise={dur.pricePaise} originalPricePaise={dur.discountPercent > 0 ? dur.origPaise : undefined} size="lg" />
                    <p className="text-[11px] font-medium text-amber-400 mt-1">
                      Effective {Math.round(dur.effectivePerMeal / 100).toLocaleString("en-IN")} / meal
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day-by-Day Meal Lineup Preview & Keep/Shuffle/Undo Controls */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-100">2. Day-by-Day Meal Lineup</h2>
              <p className="text-xs text-slate-400">Lock meals with Keep to prevent changes during Shuffle</p>
            </div>

            <div className="flex gap-2">
              {draft.previousShuffleSnapshot && (
                <SecondaryCTA onClick={handleUndo} className="!px-4 !py-2 text-xs">
                  ↺ Undo Shuffle
                </SecondaryCTA>
              )}
              <SecondaryCTA onClick={handleShuffle} className="!px-4 !py-2 text-xs">
                🔀 Shuffle Unlocked Meals
              </SecondaryCTA>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {draft.generatedMeals.map((meal, index) => (
              <div
                key={meal.mealId}
                className={`bg-slate-900 border rounded-2xl p-4 transition-all duration-200 relative flex flex-col justify-between ${
                  meal.isLocked ? "border-amber-500/50 bg-amber-500/5" : "border-slate-800"
                }`}
              >
                {/* Lock Tag */}
                <button
                  onClick={() => handleToggleKeep(meal.mealId)}
                  className={`absolute top-6 right-6 px-3 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[36px] flex items-center gap-1 z-10 ${
                    meal.isLocked
                      ? "bg-[#D4AF37] text-slate-950 shadow-md shadow-amber-500/10"
                      : "bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  <span>{meal.isLocked ? "🔒 Keep" : "🔓 Unlock"}</span>
                </button>

                <div>
                  <SafeImage src={meal.imageUrl} alt={meal.name} aspectRatio="16/9" className="mb-3" />
                  <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Day {index + 1} • Lunch</span>
                  <h3 className="text-sm font-bold text-slate-100 mt-1 mb-2 leading-tight">{meal.name}</h3>
                  <div className="flex gap-1 mb-3">
                    {meal.clinicalTags.map(t => (
                      <ClinicalBadge key={t} label={t} variant="gold" />
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <PriceDisplay pricePaise={meal.pricePaise} size="sm" />
                  <span className="text-[11px] text-slate-400">{meal.calories} kcal</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Single Sticky Ledger */}
      <StickyLedger
        chargePaise={activeDurationObj.pricePaise}
        originalChargePaise={activeDurationObj.discountPercent > 0 ? activeDurationObj.origPaise : undefined}
        ctaText="Proceed to Checkout"
        onCtaClick={handleProceedToCheckout}
        itemCount={activeDurationObj.totalMeals}
      />
    </FocusLayout>
  );
};
