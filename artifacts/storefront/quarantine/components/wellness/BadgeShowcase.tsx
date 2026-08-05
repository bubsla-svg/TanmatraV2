"use client";
import React from 'react';
import { Award, Gift } from 'lucide-react';

export interface Badge {
  id: string;
  title: string;
  icon: string;
  description: string;
  unlocked: boolean;
  color: string;
}

export const BADGES_CATALOG: Badge[] = [
  { id: 'b1', title: 'Hydration Master', icon: '💧', description: 'Logged 3.0L water for 7 consecutive days', unlocked: true, color: 'from-cyan-500 to-blue-600' },
  { id: 'b2', title: 'Streak Titan 🔥', icon: '🔥', description: 'Maintained a 14-day daily habit streak', unlocked: true, color: 'from-sky-900 to-indigo-600' },
  { id: 'b3', title: 'Clean Eating Champion', icon: '🥗', description: '100% ICMR balanced meal plate assembly', unlocked: true, color: 'from-emerald-500 to-teal-600' },
  { id: 'b4', title: 'Biomarker Hero', icon: '🩸', description: 'Uploaded blood diagnostic report for OCR analysis', unlocked: true, color: 'from-purple-500 to-indigo-600' },
  { id: 'b5', title: 'Telehealth Pioneer', icon: '👨‍⚕️', description: 'Consulted verified clinical doctor online', unlocked: false, color: 'from-sky-900 to-cyan-600' },
  { id: 'b6', title: 'Pantry Master', icon: '🛒', description: 'Scanned refrigerator & pantry for recipe swaps', unlocked: false, color: 'from-amber-500 to-orange-600' }
];

export const BadgeShowcase: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Achievements & Badges Showcase */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading">Badge Showcase</h3>
            <span className="text-xs text-slate-500 font-medium">Unlocked Health Achievements</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {BADGES_CATALOG.map(b => (
            <div
              key={b.id}
              className={`p-3.5 rounded-2xl border text-center space-y-1.5 transition-all ${
                b.unlocked 
                  ? 'bg-slate-50 dark:bg-slate-950 border-amber-400/40 shadow-sm' 
                  : 'bg-slate-100/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-50 grayscale'
              }`}
            >
              <span className="text-2xl block">{b.icon}</span>
              <strong className="text-xs font-bold text-slate-900 dark:text-white block font-heading">{b.title}</strong>
              <p className="text-[10px] text-slate-500 leading-tight font-medium">{b.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Unlockable Rewards Pass */}
      <div className="bg-gradient-to-br from-sky-900 to-slate-900 text-white p-6 rounded-3xl border border-sky-800/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-400" />
            <h4 className="text-sm font-bold font-heading text-white">Family Milestone Reward</h4>
          </div>
          <span className="text-xs font-black text-amber-300">1,450 / 2,000 Pts</span>
        </div>

        <div className="space-y-1">
          <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
            <div className="bg-amber-400 h-full" style={{ width: '72.5%' }}></div>
          </div>
          <p className="text-[10px] text-slate-300 font-medium">Earn 550 more points to unlock Free Doctor Consultation Pass!</p>
        </div>

        <button className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all">
          Claim Family Rewards Pass
        </button>
      </div>
    </div>
  );
};
