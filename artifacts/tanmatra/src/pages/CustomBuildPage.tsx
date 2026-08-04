import React, { useState } from "react";
import { FocusLayout } from "../components/Layouts";
import { PrimaryCTA, SecondaryCTA } from "../components/CTA";
import { ClinicalBadge } from "../components/Badges";
import { PriceDisplay } from "../components/PriceDisplay";
import { SafeImage } from "../components/SafeImage";
import { StickyLedger } from "../components/StickyLedger";
import { PlanDraft, PlannedMeal } from "../domain/types";
import { PlanGenerationService } from "../services/PlanGenerationService";
import { PricingService } from "../services/PricingService";

interface CustomBuildPageProps {
  onNavigate: (route: string) => void;
}

const ALLERGEN_OPTIONS = ["Peanuts", "Tree Nuts", "Shellfish", "Fish", "Dairy", "Gluten", "Soy", "Eggs"];

export const CustomBuildPage: React.FC<CustomBuildPageProps> = ({ onNavigate }) => {
  const [step, setStep] = useState<number>(1);
  const [goal, setGoal] = useState("glycemic");
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [durationDays, setDurationDays] = useState(30);

  const [draft, setDraft] = useState<PlanDraft>(() => ({
    id: `custom_draft_${Date.now()}`,
    version: 1,
    type: "custom",
    currentStage: "questionnaire",
    servingCount: 1,
    mealSlots: ["lunch", "dinner"],
    durationDays: 30,
    allergenExclusions: [],
    hardIngredientExclusions: [],
    dislikedIngredients: [],
    generatedMeals: [],
    lockedMealIds: [],
    manuallyReplacedMealIds: [],
    deliveryDates: ["2026-08-05", "2026-08-06"],
    entitlementIds: [],
    wearableInfluenceEnabled: false,
    validationErrors: [],
    unsavedChanges: true,
    serviceabilityStatus: "serviceable",
  }));

  const handleToggleAllergen = (allergen: string) => {
    setSelectedAllergens(prev =>
      prev.includes(allergen) ? prev.filter(a => a !== allergen) : [...prev, allergen]
    );
  };

  const handleGenerate = () => {
    const updatedDraft: PlanDraft = {
      ...draft,
      primaryGoal: goal,
      allergenExclusions: selectedAllergens,
      durationDays,
    };
    const generated = PlanGenerationService.generateLineup(updatedDraft, 6);
    setDraft(generated);
    setStep(6); // Review & Generate step
  };

  const handleProceedToCheckout = () => {
    const quote = PricingService.generateQuote(draft);
    onNavigate("/checkout");
  };

  return (
    <FocusLayout 
      title="Build Your Custom Plan" 
      stepProgress={`Step ${step} of 6`}
      onBack={() => {
        if (step > 1) setStep(step - 1);
        else onNavigate("/plans");
      }}
    >
      <div className="space-y-8">
        {/* Step Progress Bar */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-[#D4AF37] h-full transition-all duration-300"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>

        {/* Step 1: Goal */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-100 mb-2">1. What is your primary health goal?</h2>
              <p className="text-xs text-slate-400">Tanmatra algorithms will calibrate macro ratios around your selection</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: "glycemic", title: "Glycemic Stability & Insulin Sensitivity", desc: "Low-GI grains, high dietary fiber, anti-inflammatory oils" },
                { id: "anti-inflammatory", title: "Cellular Recovery & Anti-Inflammation", desc: "Omega-3 fatty acids, turmeric oil, polyphenol rich greens" },
                { id: "gut", title: "Microbiome & Gut Microbiota Repair", desc: "Fermented kombucha, resistant starches, gut-soothing broths" },
                { id: "performance", title: "Metabolic Peak Athletic Performance", desc: "Optimized protein density, clean complex carbohydrates" }
              ].map(item => (
                <div
                  key={item.id}
                  onClick={() => setGoal(item.id)}
                  className={`p-6 rounded-3xl border cursor-pointer transition-all ${
                    goal === item.id 
                      ? "bg-amber-500/10 border-amber-500/40 shadow-xl" 
                      : "bg-slate-900 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <h3 className="text-base font-bold text-slate-100 mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>

            <PrimaryCTA onClick={() => setStep(2)} className="w-full">
              Continue to Food Restrictions
            </PrimaryCTA>
          </div>
        )}

        {/* Step 2: Allergens & Hard Restrictions */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <ClinicalBadge label="Hard Safety Constraint" variant="emerald" />
              <h2 className="text-2xl font-extrabold text-slate-100 mt-2 mb-2">2. Hard Allergen Exclusions</h2>
              <p className="text-xs text-slate-400">Selected allergens are strictly forbidden during generation, shuffle, and meal replacement</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ALLERGEN_OPTIONS.map(allergen => {
                const isSelected = selectedAllergens.includes(allergen);
                return (
                  <button
                    key={allergen}
                    onClick={() => handleToggleAllergen(allergen)}
                    className={`p-4 rounded-2xl border text-xs font-bold text-left transition-all min-h-[44px] ${
                      isSelected
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/40"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <span>{isSelected ? "⛔ " : "+ "}{allergen}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-4">
              <SecondaryCTA onClick={() => setStep(1)} className="w-1/3">
                Back
              </SecondaryCTA>
              <PrimaryCTA onClick={() => setStep(3)} className="w-2/3">
                Continue to Duration
              </PrimaryCTA>
            </div>
          </div>
        )}

        {/* Step 3 & 4 & 5: Duration & Preferences */}
        {step >= 3 && step <= 5 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-100 mb-2">3. Plan Duration & Commitment</h2>
              <p className="text-xs text-slate-400">Select subscription timeframe</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { days: 7, label: "7 Days Trial", desc: "No long term commitment" },
                { days: 14, label: "14 Days Plan", desc: "Save 10% on total meals" },
                { days: 30, label: "30 Days Reset", desc: "Save 20% + Free RD consult" },
              ].map(d => (
                <div
                  key={d.days}
                  onClick={() => setDurationDays(d.days)}
                  className={`p-6 rounded-3xl border cursor-pointer transition-all ${
                    durationDays === d.days
                      ? "bg-amber-500/10 border-amber-500/40"
                      : "bg-slate-900 border-slate-800"
                  }`}
                >
                  <h3 className="text-lg font-bold text-slate-100 mb-1">{d.label}</h3>
                  <p className="text-xs text-slate-400">{d.desc}</p>
                </div>
              ))}
            </div>

            <PrimaryCTA onClick={handleGenerate} className="w-full">
              ⚡ Generate Custom Meal Lineup
            </PrimaryCTA>
          </div>
        )}

        {/* Step 6: Review States & Lineup Preview */}
        {step === 6 && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* 4 Review States Summary */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs text-slate-400 font-bold uppercase">Configuration Summary</span>
                <button onClick={() => setStep(1)} className="text-xs font-bold text-amber-400 hover:underline">Edit Rules</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="block text-slate-500">Goal</span>
                  <span className="font-bold text-slate-200 capitalize">{goal}</span>
                </div>
                <div>
                  <span className="block text-slate-500">Allergen Exclusions</span>
                  <span className="font-bold text-slate-200">{selectedAllergens.length > 0 ? selectedAllergens.join(", ") : "None"}</span>
                </div>
                <div>
                  <span className="block text-slate-500">Duration</span>
                  <span className="font-bold text-slate-200">{durationDays} Days</span>
                </div>
                <div>
                  <span className="block text-slate-500">Lineup Status</span>
                  <span className="font-bold text-emerald-400">Generated & Safe</span>
                </div>
              </div>
            </div>

            {/* Generated Lineup Preview */}
            <div>
              <h3 className="text-lg font-bold text-slate-100 mb-4">Generated Meal Lineup</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {draft.generatedMeals.map((m, idx) => (
                  <div key={m.mealId} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex gap-4 items-center">
                    <SafeImage src={m.imageUrl} alt={m.name} aspectRatio="1/1" className="w-16 h-16 shrink-0" />
                    <div>
                      <span className="text-[10px] text-amber-400 font-bold">Meal Slot {idx + 1}</span>
                      <h4 className="text-sm font-bold text-slate-100">{m.name}</h4>
                      <PriceDisplay pricePaise={m.pricePaise} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sticky Ledger Checkout Handoff */}
            <StickyLedger
              chargePaise={PricingService.calculateBreakdown({ ...draft, durationDays }).chargePaise}
              ctaText="Proceed to Checkout"
              onCtaClick={handleProceedToCheckout}
            />
          </div>
        )}
      </div>
    </FocusLayout>
  );
};
