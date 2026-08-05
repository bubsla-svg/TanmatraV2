"use client";
import React from 'react';
import Link from 'next/link';
import { Sparkles, Utensils, CheckCircle2, ShoppingBag, Flame, Zap } from 'lucide-react';
import { type PrecisionPlanResult } from '@/lib/wellnessApi';

interface PrecisionPlanResultsProps {
  plan: PrecisionPlanResult;
}

export const PrecisionPlanResults: React.FC<PrecisionPlanResultsProps> = ({ plan }) => {
  return (
    <div className="space-y-8">
      {/* Target Biometrics & BMR Header Card */}
      <div className="bg-gradient-to-r from-sky-900 via-sky-950 to-slate-950 text-white p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6 border border-sky-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-xs border border-amber-500/30 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> BMR & TDEE Clinical Prescription
            </span>
            <h3 className="text-2xl sm:text-3xl font-black font-heading">
              Your Daily Target: {plan.targetCalories} <span className="text-sm font-normal text-slate-300">kcal/day</span>
            </h3>
            <p className="text-xs text-slate-300">
              Basal Metabolic Rate (BMR): <strong className="text-white">{plan.bmr} kcal</strong> • Total Daily Energy Expenditure (TDEE): <strong className="text-white">{plan.tdee} kcal</strong>
            </p>
          </div>

          {/* Macro Pills */}
          <div className="grid grid-cols-3 gap-2 bg-white/10 p-3.5 rounded-2xl border border-white/15 backdrop-blur-md shrink-0 text-center">
            <div>
              <strong className="text-lg font-black text-emerald-400 block">{plan.targetProteinG}g</strong>
              <span className="text-[10px] text-slate-300 font-bold uppercase">Protein</span>
            </div>
            <div>
              <strong className="text-lg font-black text-amber-400 block">{plan.targetCarbsG}g</strong>
              <span className="text-[10px] text-slate-300 font-bold uppercase">Carbs</span>
            </div>
            <div>
              <strong className="text-lg font-black text-cyan-400 block">{plan.targetFatG}g</strong>
              <span className="text-[10px] text-slate-300 font-bold uppercase">Fat</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Thalis Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-black text-slate-900 dark:text-white font-heading flex items-center gap-2">
            <Utensils className="w-5 h-5 text-emerald-500" /> Personalized 7-Day Thali Schedule
          </h4>
          <span className="text-xs font-bold text-slate-500">
            Total 7-Day Plan: ₹{Math.round(plan.totalPlanPricePaise / 100)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plan.dailyThalis.map((thali) => (
            <div
              key={thali.dayNumber}
              className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-md space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <strong className="text-sm font-black text-slate-900 dark:text-white font-heading">
                  {thali.dayName} (Thali #{thali.dayNumber})
                </strong>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {thali.totals.calories} kcal • {thali.totals.proteinGrams}g P
                </span>
              </div>

              <div className="space-y-2">
                {thali.meals.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-950">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">{m.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{m.calories} kcal</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 pt-1 font-medium">
                <span>P: {thali.totals.proteinGrams}g • C: {thali.totals.carbsGrams}g • F: {thali.totals.fatGrams}g</span>
                <span className="font-bold text-slate-900 dark:text-white">₹{Math.round(thali.totals.pricePaise / 100)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscription Conversion CTA */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="text-xl font-black font-heading">Subscribe to your Personalized 7-Day Thali Plan</h4>
          <p className="text-xs text-emerald-100 font-medium">
            Get daily chef-prepared, RD-verified clinical meals delivered fresh to your doorstep.
          </p>
        </div>

        <Link
          href={`/checkout?plan=7day_precision&price=${plan.totalPlanPricePaise}`}
          className="px-6 py-3 rounded-2xl bg-white text-emerald-950 font-black text-xs uppercase tracking-wider shadow-lg hover:bg-emerald-50 transition-all shrink-0 flex items-center gap-2"
        >
          <ShoppingBag className="w-4 h-4 text-emerald-600" />
          <span>Checkout 7-Day Plan (₹{Math.round(plan.totalPlanPricePaise / 100)})</span>
        </Link>
      </div>
    </div>
  );
};
