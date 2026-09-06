"use client";
import React, { useId, useState } from 'react';
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
  // Stable id prefix so each visible <label> actually names its control.
  const uid = useId();
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
    <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 sm:p-8 border border-line space-y-6">
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <div className="w-10 h-10 rounded-2xl bg-gold/10 text-gold-text flex items-center justify-center font-bold">
          <Sparkles className="w-5 h-5 text-gold-text" />
        </div>
        <div>
          <h3 className="font-display text-xl font-semibold leading-tight text-primary">ICMR Clinical Precision Funnel</h3>
          <span className="text-xs text-ink-muted font-medium">Input your biometrics to auto-calculate BMR, TDEE, & 7-Day Thalis</span>
        </div>
      </div>

      {/* Grid 1: Biometrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted block mb-1" htmlFor={`${uid}-age-years`}>Age (Years)</label>
          <input id={`${uid}-age-years`}
            type="number"
            min={12}
            max={120}
            value={age}
            onChange={(e) => setAge(parseInt(e.target.value) || 30)}
            className="w-full min-h-[50px] bg-surface border border-line rounded-2xl px-4 py-3 text-xs text-ink outline-none focus-visible:border-primary"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted block mb-1" htmlFor={`${uid}-gender`}>Gender</label>
          <select id={`${uid}-gender`}
            value={gender}
            onChange={(e) => setGender(e.target.value as any)}
            className="w-full min-h-[50px] bg-surface border border-line rounded-2xl px-4 py-3 text-xs text-ink outline-none focus-visible:border-primary"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted block mb-1" htmlFor={`${uid}-height-cm`}>Height (cm)</label>
          <input id={`${uid}-height-cm`}
            type="number"
            min={100}
            max={250}
            value={heightCm}
            onChange={(e) => setHeightCm(parseInt(e.target.value) || 170)}
            className="w-full min-h-[50px] bg-surface border border-line rounded-2xl px-4 py-3 text-xs text-ink outline-none focus-visible:border-primary"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted block mb-1" htmlFor={`${uid}-weight-kg`}>Weight (kg)</label>
          <input id={`${uid}-weight-kg`}
            type="number"
            min={30}
            max={300}
            value={weightKg}
            onChange={(e) => setWeightKg(parseInt(e.target.value) || 70)}
            className="w-full min-h-[50px] bg-surface border border-line rounded-2xl px-4 py-3 text-xs text-ink outline-none focus-visible:border-primary"
          />
        </div>
      </div>

      {/* Grid 2: Activity & Health Goal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted block mb-1" htmlFor={`${uid}-activity-multiplier`}>Activity Multiplier</label>
          <select id={`${uid}-activity-multiplier`}
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as any)}
            className="w-full min-h-[50px] bg-surface border border-line rounded-2xl px-4 py-3 text-xs text-ink outline-none focus-visible:border-primary"
          >
            <option value="sedentary">Sedentary (Desk Job)</option>
            <option value="light">Lightly Active (1-3 days/wk)</option>
            <option value="moderate">Moderately Active (3-5 days/wk)</option>
            <option value="active">Very Active (6-7 days/wk)</option>
            <option value="very_active">Extra Active (Athlete)</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted block mb-1" htmlFor={`${uid}-primary-clinical-goal`}>Primary Clinical Goal</label>
          <select id={`${uid}-primary-clinical-goal`}
            value={goal}
            onChange={(e) => setGoal(e.target.value as any)}
            className="w-full min-h-[50px] bg-surface border border-line rounded-2xl px-4 py-3 text-xs text-ink outline-none focus-visible:border-primary"
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
          <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted block mb-1">Dietary Preference</label>
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
                className={`py-2 rounded-2xl text-xs font-bold border transition-all ${
                  dietPreference === d.id
                    ? 'border-gold bg-primary/10 text-primary'
                    : 'border-transparent bg-secondary text-ink-muted hover:text-primary'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted block mb-1">Excludes Allergens (Safety Filter)</label>
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
                      ? 'border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]'
                      : 'border-transparent bg-secondary text-ink-muted hover:text-[var(--danger)]'
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
        className="w-full py-3 rounded-2xl bg-gold hover:brightness-110 disabled:opacity-50 text-[var(--gold-ink)] text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        <span>{loading ? "Calculating ICMR Precision Plan..." : "Generate 7-Day Precision Thali Plan"}</span>
      </button>
    </form>
  );
};
