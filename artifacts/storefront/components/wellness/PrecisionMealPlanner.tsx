"use client";
import React, { useState } from 'react';
import { generatePrecisionPlan, type PrecisionPlannerInput, type PrecisionPlanResult } from '@/lib/wellnessApi';
import { PrecisionPlannerFunnel } from './PrecisionPlannerFunnel';
import { PrecisionPlanResults } from './PrecisionPlanResults';

export const PrecisionMealPlanner: React.FC = () => {
  const [plan, setPlan] = useState<PrecisionPlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = (input: PrecisionPlannerInput) => {
    setLoading(true);
    setError(null);
    generatePrecisionPlan(input)
      .then((res) => {
        if (res.plan) {
          setPlan(res.plan);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to generate precision plan. Please try again.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-8">
      <PrecisionPlannerFunnel onGenerate={handleGenerate} loading={loading} />

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
          {error}
        </div>
      )}

      {plan && <PrecisionPlanResults plan={plan} />}
    </div>
  );
};
