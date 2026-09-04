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
    <div className="bg-surface rounded-2xl p-6 sm:p-8 border border-line space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gold/10 text-primary flex items-center justify-center font-bold">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold leading-tight text-primary">Water & Fluid Logger</h3>
            <span className="text-xs text-ink-muted font-medium">Daily Goal: 3.0 Liters (3,000 mL)</span>
          </div>
        </div>

        {waterLogs.length > 0 && (
          <button 
            onClick={handleResetWater}
            className="text-xs font-bold text-ink-faint hover:text-[var(--danger)] transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      {/* Visual Hydration Meter Ring */}
      <div className="bg-gradient-to-br from-[var(--gold)]/10 to-[var(--gold)]/10 p-6 rounded-2xl border border-[var(--gold)] text-center space-y-4 relative overflow-hidden">
        <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" className="text-ink-faint" fill="transparent" />
            <circle 
              cx="50" cy="50" r="42" 
              stroke="currentColor" 
              strokeWidth="8" 
              strokeDasharray="263.89" 
              strokeDashoffset={263.89 - (263.89 * hydrationPercentage) / 100}
              strokeLinecap="round"
              className="text-[var(--gold-text)] transition-all duration-700 ease-out" 
              fill="transparent" 
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <strong className="font-data text-3xl font-bold text-primary">{hydrationPercentage}%</strong>
            <span className="font-data text-2xs font-bold text-primary mt-0.5">{totalWaterLoggedMl} mL Logged</span>
          </div>
        </div>

        <p className="text-xs text-ink-muted font-medium">
          {hydrationPercentage >= 100 
            ? '🎉 Congratulations! You have achieved 100% of your daily clinical hydration goal!' 
            : `Drink ${dailyGoalMl - totalWaterLoggedMl} mL more to reach optimal hydration.`}
        </p>
      </div>

      {/* Quick Add Buttons */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted block">Quick Log Presets:</label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleAddWater(250)}
            className="p-3 rounded-2xl border border-transparent bg-secondary text-ink-muted transition-all text-center space-y-1 group"
          >
            <span className="text-xl block group-hover:scale-110 transition-transform">🥛</span>
            <strong className="font-data text-xs font-bold text-primary block">+250 mL</strong>
            <span className="text-2xs text-ink-muted group-hover:text-primary block">Glass</span>
          </button>

          <button
            onClick={() => handleAddWater(500)}
            className="p-3 rounded-2xl border border-transparent bg-secondary text-ink-muted transition-all text-center space-y-1 group"
          >
            <span className="text-xl block group-hover:scale-110 transition-transform">🧴</span>
            <strong className="font-data text-xs font-bold text-primary block">+500 mL</strong>
            <span className="text-2xs text-ink-muted group-hover:text-primary block">Sports Bottle</span>
          </button>

          <button
            onClick={() => handleAddWater(1000)}
            className="p-3 rounded-2xl border border-transparent bg-secondary text-ink-muted transition-all text-center space-y-1 group"
          >
            <span className="text-xl block group-hover:scale-110 transition-transform">🫖</span>
            <strong className="font-data text-xs font-bold text-primary block">+1,000 mL</strong>
            <span className="text-2xs text-ink-muted group-hover:text-primary block">Jug</span>
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
          className="min-h-[50px] flex-1 rounded-2xl border border-line bg-surface px-4 py-3 text-xs text-ink focus:outline-none focus-visible:border-primary"
        />
        <button
          type="submit"
          disabled={!customMlInput}
          className="min-h-[50px] px-4 py-3 rounded-2xl bg-gold hover:brightness-110 disabled:opacity-50 text-[var(--gold-ink)] text-xs font-bold transition-all flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Log
        </button>
      </form>

      {/* Water Log History Feed */}
      {waterLogs.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-line">
          <span className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted block">Today&apos;s Log History:</span>
          <div className="max-h-40 overflow-y-auto space-y-2 pr-1 no-scrollbar">
            {waterLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-secondary border border-line text-xs">
                <div className="flex items-center gap-2">
                  <Droplets className="w-3.5 h-3.5 text-primary" />
                  <span className="font-data font-bold text-primary">{log.waterMl} mL Logged</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-data text-2xs text-ink-faint font-medium">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button onClick={() => handleRemoveLog(log.id)} className="text-ink-faint hover:text-[var(--danger)]">
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
