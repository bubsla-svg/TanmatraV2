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
  { id: 'b1', title: 'Hydration Master', icon: '💧', description: 'Logged 3.0L water for 7 consecutive days', unlocked: true, color: 'from-[var(--blue)] to-[var(--blue)]/60' },
  { id: 'b2', title: 'Streak Titan 🔥', icon: '🔥', description: 'Maintained a 14-day daily habit streak', unlocked: true, color: 'from-[var(--gold)] to-[var(--gold)]/60' },
  { id: 'b3', title: 'Clean Eating Champion', icon: '🥗', description: '100% ICMR balanced meal plate assembly', unlocked: true, color: 'from-[var(--sage)] to-[var(--sage)]/60' },
  { id: 'b4', title: 'Biomarker Hero', icon: '🩸', description: 'Uploaded blood diagnostic report for OCR analysis', unlocked: true, color: 'from-[var(--danger)] to-[var(--danger)]/60' },
  { id: 'b5', title: 'Telehealth Pioneer', icon: '👨‍⚕️', description: 'Consulted verified clinical doctor online', unlocked: false, color: 'from-[var(--blue)] to-[var(--blue)]/60' },
  { id: 'b6', title: 'Pantry Master', icon: '🛒', description: 'Scanned refrigerator & pantry for recipe swaps', unlocked: false, color: 'from-[var(--gold)] to-[var(--gold)]/60' }
];

export const BadgeShowcase: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Achievements & Badges Showcase */}
      <div className="bg-surface rounded-2xl p-6 sm:p-8 border border-line space-y-6">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <div className="w-10 h-10 rounded-2xl bg-gold/10 text-accent flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold leading-tight text-primary">Badge Showcase</h3>
            <span className="text-xs text-ink-muted font-medium">Unlocked Health Achievements</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {BADGES_CATALOG.map(b => (
            <div
              key={b.id}
              className={`p-3.5 rounded-2xl border text-center space-y-1.5 transition-all ${
                b.unlocked 
                  ? 'bg-secondary border-gold/40'
                  : 'bg-secondary border-line opacity-50 grayscale'
              }`}
            >
              <span className="text-2xl block">{b.icon}</span>
              <strong className="text-xs font-bold text-ink block font-heading">{b.title}</strong>
              <p className="text-2xs text-ink-muted leading-tight font-medium">{b.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Unlockable Rewards Pass */}
      <div className="bg-secondary text-ink p-6 rounded-2xl border border-line space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-accent" />
            <h4 className="font-display text-sm font-semibold text-ink">Family Milestone Reward</h4>
          </div>
          <span className="font-data text-xs font-bold text-primary">1,450 / 2,000 Pts</span>
        </div>

        <div className="space-y-1">
          <div className="w-full bg-line h-2 rounded-full overflow-hidden">
            <div className="bg-gold h-full" style={{ width: '72.5%' }}></div>
          </div>
          <p className="text-2xs text-ink-faint font-medium">Earn 550 more points to unlock Free Doctor Consultation Pass!</p>
        </div>

        <button className="w-full py-2.5 rounded-xl bg-gold hover:brightness-110 text-[var(--gold-ink)] font-black text-xs uppercase tracking-wider shadow-md transition-all">
          Claim Family Rewards Pass
        </button>
      </div>
    </div>
  );
};
