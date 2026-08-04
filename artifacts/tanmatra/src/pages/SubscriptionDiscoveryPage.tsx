import React, { useState } from "react";
import { GlobalLayout } from "../components/Layouts";
import { PrimaryCTA, SecondaryCTA } from "../components/CTA";
import { ClinicalBadge } from "../components/Badges";
import { PriceDisplay } from "../components/PriceDisplay";
import { SafeImage } from "../components/SafeImage";

interface SubscriptionDiscoveryPageProps {
  onNavigate: (route: string) => void;
}

const GOALS = [
  { id: "glycemic", label: "Glycemic & Diabetes Control" },
  { id: "anti-inflammatory", label: "Anti-Inflammatory & Recovery" },
  { id: "gut", label: "Gut Health & Microbiome" },
  { id: "weight", label: "Metabolic Weight Management" },
];

export const SubscriptionDiscoveryPage: React.FC<SubscriptionDiscoveryPageProps> = ({ onNavigate }) => {
  const [selectedGoal, setSelectedGoal] = useState("glycemic");
  const [selectedMealtime, setSelectedMealtime] = useState<"lunch" | "dinner" | "all-day">("lunch");

  return (
    <GlobalLayout activeTab="plan" currentRoute="/plans" onNavigate={onNavigate}>
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-10">
        <h1 className="text-3xl md:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
          Choose Your Therapeutic Meal Plan
        </h1>
        <p className="text-sm text-slate-400">
          Personalized by clinical algorithms, tailored to your metabolic goal
        </p>
      </div>

      {/* Goal & Mealtime Selector */}
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 p-6 rounded-3xl mb-12 shadow-xl">
        <div className="mb-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            1. Select Primary Health Goal
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGoal(g.id)}
                className={`px-4 py-3 rounded-2xl text-xs font-bold border text-left transition-all duration-200 min-h-[44px] ${
                  selectedGoal === g.id
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-lg shadow-amber-500/5"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            2. Select Meal Slot Preference
          </label>
          <div className="flex gap-3">
            {(["lunch", "dinner", "all-day"] as const).map((slot) => (
              <button
                key={slot}
                onClick={() => setSelectedMealtime(slot)}
                className={`flex-1 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 min-h-[44px] ${
                  selectedMealtime === slot
                    ? "bg-[#D4AF37] text-slate-950 border-[#D4AF37]"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Visually Dominant Tanmatra Recommendation Card */}
      <div className="max-w-4xl mx-auto mb-16">
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border-2 border-amber-500/40 p-8 md:p-10 rounded-3xl shadow-2xl overflow-hidden">
          <div className="absolute top-0 right-0 px-6 py-2 bg-[#D4AF37] text-slate-950 font-extrabold text-xs tracking-wider uppercase rounded-bl-2xl">
            Tanmatra Top Recommendation
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex gap-2 mb-3">
                <ClinicalBadge label="Glycemic Index < 45" variant="gold" />
                <ClinicalBadge label="RD Reviewed" variant="emerald" />
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight mb-3">
                Metabolic Glycemic Reset Plan
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                Formulated specifically for blood glucose stabilization, high dietary fiber intake, and sustained daily energy without insulin spikes.
              </p>

              <div className="space-y-2 mb-8 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">✓</span>
                  <span>Exact day-by-day meal lineup before checkout</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">✓</span>
                  <span>Keep & Shuffle controls to lock favorite meals</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">✓</span>
                  <span>Zero-penalty pause, skip, and address updates</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <PriceDisplay pricePaise={239200} originalPricePaise={299000} label="Starting at (30 Days)" size="lg" />
                <PrimaryCTA onClick={() => onNavigate("/plan/glycemic-reset")}>
                  Build This Plan
                </PrimaryCTA>
              </div>
            </div>

            <div>
              <SafeImage 
                src="https://picsum.photos/seed/glycemic-plan/800/600" 
                alt="Metabolic Glycemic Reset Plan" 
                aspectRatio="4/3" 
                className="shadow-2xl border border-slate-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Alternative Plans Section */}
      <div className="max-w-4xl mx-auto">
        <h3 className="text-xl font-bold text-slate-100 mb-6">Other Plans That May Fit</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between">
            <div>
              <ClinicalBadge label="Anti-Inflammatory" variant="emerald" />
              <h4 className="text-lg font-bold text-slate-100 mt-3 mb-2">Nocturnal Cellular Recovery Plan</h4>
              <p className="text-xs text-slate-400 mb-4">Omega-3 rich salmon, turmeric oil elixirs, and deep digestive repair ingredients.</p>
            </div>
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <PriceDisplay pricePaise={319200} size="md" />
              <SecondaryCTA onClick={() => onNavigate("/plan/cellular-recovery")} className="!px-4 !py-2 text-xs">
                Configure
              </SecondaryCTA>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between">
            <div>
              <ClinicalBadge label="Gut Health" variant="amber" />
              <h4 className="text-lg font-bold text-slate-100 mt-3 mb-2">Microbiome Fiber Diversity Plan</h4>
              <p className="text-xs text-slate-400 mb-4">30+ plant varieties per week to optimize gut flora and digestion resilience.</p>
            </div>
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <PriceDisplay pricePaise={199200} size="md" />
              <SecondaryCTA onClick={() => onNavigate("/plan/microbiome-diversity")} className="!px-4 !py-2 text-xs">
                Configure
              </SecondaryCTA>
            </div>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};
