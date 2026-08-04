"use client";
import React, { useState } from 'react';
import { Activity, Sparkles, Scale, Heart, ShieldAlert } from 'lucide-react';
import { type PrecisionPlannerInput } from '@/lib/wellnessApi';

interface PrecisionPlannerFunnelProps {
  onGenerate: (input: PrecisionPlannerInput) => void;
  loading: boolean;
}

export const PrecisionPlannerFunnel: React.FC<PrecisionPlannerFunnelProps> = ({
  onGenerate,
  loading,
}) => {
  const [age, setAge] = useState<number>(30);
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [heightCm, setHeightCm] = useState<number>(170);
  const [weightKg, setWeightKg] = useState<number>(70);
  const [activityLevel, setActivityLevel] = useState<PrecisionPlannerInput["activityLevel"]>("moderate");
  const [goal, setGoal] = useState<PrecisionPlannerInput["goal"]>("fat_loss");
  const [dietPreference, setDietPreference] = useState<PrecisionPlannerInput["dietPreference"]>("any");
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);

  const ALLERGEN_OPTIONS = ["Dairy", "Gluten", "Nuts", "Soy", "Egg", "Shellfish"];

  const toggleAllergen = (allergen: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(allergen) ? prev.filter((a) => a !== allergen) : [...prev, allergen]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      age,
      gender,
      heightCm,
      weightKg,
      activityLevel,
      goal,
      dietPreference,
      allergens: selectedAllergens,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="w-10 h-10 rounded-2xl bg-sky-900/10 text-sky-900 dark:text-cyan-400 flex items-center justify-center font-bold">
          <Sparkles className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading">ICMR Clinical Precision Funnel</h3>
          <span className="text-xs text-slate-500 font-medium">Input your biometrics to auto-calculate BMR, TDEE, & 7-Day Thalis</span>
        </div>
      </div>

      {/* Grid 1: Biometrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Age (Years)</label>
          <input
            type="number"
            min={12}
            max={120}
            value={age}
            onChange={(e) => setAge(parseInt(e.target.value) || 30)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-900"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Gender</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as any)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-900"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Height (cm)</label>
          <input
            type="number"
            min={100}
            max={250}
            value={heightCm}
            onChange={(e) => setHeightCm(parseInt(e.target.value) || 170)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-900"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Weight (kg)</label>
          <input
            type="number"
            min={30}
            max={300}
            value={weightKg}
            onChange={(e) => setWeightKg(parseInt(e.target.value) || 70)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-900"
          />
        </div>
      </div>

      {/* Grid 2: Activity & Health Goal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Activity Multiplier</label>
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as any)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-900"
          >
            <option value="sedentary">Sedentary (Desk Job)</option>
            <option value="light">Lightly Active (1-3 days/wk)</option>
            <option value="moderate">Moderately Active (3-5 days/wk)</option>
            <option value="active">Very Active (6-7 days/wk)</option>
            <option value="very_active">Extra Active (Athlete)</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Primary Clinical Goal</label>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as any)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-900"
          >
            <option value="fat_loss">Fat Loss (-500 kcal Deficit)</option>
            <option value="muscle_gain">Muscle Build (+15% Surplus)</option>
            <option value="maintenance">Weight Maintenance & Vitality</option>
            <option value="diabetic_friendly">Diabetic Glycemic Management</option>
          </select>
        </div>
      </div>

      {/* Diet Preference & Allergens */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Dietary Preference</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'any', label: 'Omnivore 🍱' },
              { id: 'veg', label: 'Vegetarian 🥗' },
              { id: 'vegan', label: 'Vegan 🌿' },
              { id: 'keto', label: 'Keto 🥩' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDietPreference(d.id as any)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  dietPreference === d.id
                    ? 'bg-sky-900 text-white border-sky-900 shadow-md'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-sky-900'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Excludes Allergens (Safety Filter)</label>
          <div className="flex flex-wrap gap-2">
            {ALLERGEN_OPTIONS.map((alg) => {
              const active = selectedAllergens.includes(alg);
              return (
                <button
                  key={alg}
                  type="button"
                  onClick={() => toggleAllergen(alg)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                    active
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-rose-400'
                  }`}
                >
                  {active ? `✓ No ${alg}` : `+ ${alg}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        <span>{loading ? "Calculating ICMR Precision Plan..." : "Generate 7-Day Precision Thali Plan"}</span>
      </button>
    </form>
  );
};
