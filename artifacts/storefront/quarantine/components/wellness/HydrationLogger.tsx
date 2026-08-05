"use client";
import React from 'react';
import { Droplets, Plus, Trash2 } from 'lucide-react';
import { type NutritionLog } from '@/lib/wellnessApi';

interface HydrationLoggerProps {
  dailyGoalMl: number;
  waterLogs: NutritionLog[];
  totalWaterLoggedMl: number;
  hydrationPercentage: number;
  customMlInput: string;
  setCustomMlInput: (val: string) => void;
  handleAddWater: (amountMl: number) => void;
  handleCustomAddWater: (e: React.FormEvent) => void;
  handleResetWater: () => void;
  handleRemoveLog: (id: number) => void;
}

export const HydrationLogger: React.FC<HydrationLoggerProps> = ({
  dailyGoalMl,
  waterLogs,
  totalWaterLoggedMl,
  hydrationPercentage,
  customMlInput,
  setCustomMlInput,
  handleAddWater,
  handleCustomAddWater,
  handleResetWater,
  handleRemoveLog,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center font-bold">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading">Water & Fluid Logger</h3>
            <span className="text-xs text-slate-500 font-medium">Daily Goal: 3.0 Liters (3,000 mL)</span>
          </div>
        </div>

        {waterLogs.length > 0 && (
          <button 
            onClick={handleResetWater}
            className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      {/* Visual Hydration Meter Ring */}
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-6 rounded-3xl border border-cyan-100 dark:border-slate-800 text-center space-y-4 relative overflow-hidden">
        <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-slate-800" fill="transparent" />
            <circle 
              cx="50" cy="50" r="42" 
              stroke="currentColor" 
              strokeWidth="8" 
              strokeDasharray="263.89" 
              strokeDashoffset={263.89 - (263.89 * hydrationPercentage) / 100}
              strokeLinecap="round"
              className="text-cyan-500 transition-all duration-700 ease-out" 
              fill="transparent" 
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <strong className="text-3xl font-black text-slate-900 dark:text-white font-heading">{hydrationPercentage}%</strong>
            <span className="text-[11px] font-extrabold text-cyan-600 dark:text-cyan-400 mt-0.5">{totalWaterLoggedMl} mL Logged</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {hydrationPercentage >= 100 
            ? '🎉 Congratulations! You have achieved 100% of your daily clinical hydration goal!' 
            : `Drink ${dailyGoalMl - totalWaterLoggedMl} mL more to reach optimal hydration.`}
        </p>
      </div>

      {/* Quick Add Buttons */}
      <div className="space-y-3">
        <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">Quick Log Presets:</label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleAddWater(250)}
            className="p-3 rounded-2xl bg-cyan-50 dark:bg-slate-800 hover:bg-cyan-500 hover:text-white text-slate-800 dark:text-slate-200 border border-cyan-200 dark:border-slate-700 transition-all text-center space-y-1 group"
          >
            <span className="text-xl block group-hover:scale-110 transition-transform">🥛</span>
            <strong className="text-xs font-black block">+250 mL</strong>
            <span className="text-[10px] text-slate-500 group-hover:text-cyan-100 block">Glass</span>
          </button>

          <button
            onClick={() => handleAddWater(500)}
            className="p-3 rounded-2xl bg-cyan-50 dark:bg-slate-800 hover:bg-cyan-500 hover:text-white text-slate-800 dark:text-slate-200 border border-cyan-200 dark:border-slate-700 transition-all text-center space-y-1 group"
          >
            <span className="text-xl block group-hover:scale-110 transition-transform">🧴</span>
            <strong className="text-xs font-black block">+500 mL</strong>
            <span className="text-[10px] text-slate-500 group-hover:text-cyan-100 block">Sports Bottle</span>
          </button>

          <button
            onClick={() => handleAddWater(1000)}
            className="p-3 rounded-2xl bg-cyan-50 dark:bg-slate-800 hover:bg-cyan-500 hover:text-white text-slate-800 dark:text-slate-200 border border-cyan-200 dark:border-slate-700 transition-all text-center space-y-1 group"
          >
            <span className="text-xl block group-hover:scale-110 transition-transform">🫖</span>
            <strong className="text-xs font-black block">+1,000 mL</strong>
            <span className="text-[10px] text-slate-500 group-hover:text-cyan-100 block">Jug</span>
          </button>
        </div>
      </div>

      {/* Custom Water Form */}
      <form onSubmit={handleCustomAddWater} className="flex items-center gap-2">
        <input 
          type="number"
          value={customMlInput}
          onChange={(e) => setCustomMlInput(e.target.value)}
          placeholder="Enter custom mL (e.g., 350)..."
          className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={!customMlInput}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Log
        </button>
      </form>

      {/* Water Log History Feed */}
      {waterLogs.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">Today&apos;s Log History:</span>
          <div className="max-h-40 overflow-y-auto space-y-2 pr-1 no-scrollbar">
            {waterLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <Droplets className="w-3.5 h-3.5 text-cyan-500" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">{log.waterMl} mL Logged</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button onClick={() => handleRemoveLog(log.id)} className="text-slate-400 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
