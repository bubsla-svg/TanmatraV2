"use client";
import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Trophy, Plus, Flame, Trash2 } from 'lucide-react';
import { type FamilyMember } from '@/lib/wellnessApi';

interface LeaderboardTableProps {
  sortedMembers: FamilyMember[];
  totalFamilyPoints: number;
  onOpenAddModal: () => void;
  onRemoveMember: (id: string) => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  sortedMembers,
  totalFamilyPoints,
  onOpenAddModal,
  onRemoveMember,
}) => {
  // WCAG 2.3.3. globals.css's reduced-motion block collapses CSS animation but
  // cannot touch Motion's JS-driven inline transforms. Drop the y-translate and
  // keep the opacity fade: the criterion targets movement, and a cross-fade is
  // the sanctioned non-motion substitute — so rows still resolve in, they just
  // no longer travel.
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-900/10 text-sky-900 dark:text-cyan-400 flex items-center justify-center font-bold">
            <Trophy className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading">Family Wellness Leaderboard</h3>
            <span className="text-xs text-slate-500 font-medium">Total Combined Points: {totalFamilyPoints} Pts</span>
          </div>
        </div>

        <button
          onClick={onOpenAddModal}
          className="px-4 py-2 rounded-xl bg-sky-900 hover:bg-sky-950 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {/* Members Rank List */}
      <div className="space-y-4">
        {sortedMembers.map((member, idx) => (
          <motion.div
            key={member.id}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              idx === 0 
                ? 'border-amber-400/60 bg-gradient-to-r from-amber-50/50 via-slate-50 to-amber-50/30 dark:from-amber-950/20 dark:to-slate-900 shadow-md' 
                : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950'
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Rank Badge */}
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 font-black text-xs text-slate-800 dark:text-white flex items-center justify-center shrink-0">
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
              </div>

              <span className="text-3xl shrink-0">{member.avatar}</span>

              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-sm font-bold text-slate-900 dark:text-white font-heading">{member.name}</strong>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-900/10 text-sky-900 dark:text-cyan-400 font-extrabold">
                    {member.relation}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  <span className="text-amber-500 font-bold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-500" /> {member.streakDays} Day Streak
                  </span>
                  <span>• Health Index: <strong className="text-emerald-500 font-bold">{member.healthScore}/10</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
              <div className="text-right">
                <strong className="text-lg font-black text-sky-900 dark:text-cyan-400 font-heading block">
                  {member.points} <span className="text-xs font-bold">Pts</span>
                </strong>
                <span className="text-[10px] text-slate-400 block font-bold">{member.badge}</span>
              </div>

              {member.id !== '1' && (
                <button onClick={() => onRemoveMember(member.id)} className="text-slate-400 hover:text-rose-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
