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
    <div className="bg-surface rounded-2xl p-6 sm:p-8 border border-line space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gold/10 text-accent flex items-center justify-center font-bold">
            <Trophy className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold leading-tight text-primary">Family Wellness Leaderboard</h3>
            <span className="text-xs text-ink-muted font-medium">Total Combined Points: {totalFamilyPoints} Pts</span>
          </div>
        </div>

        <button
          onClick={onOpenAddModal}
          className="px-4 py-2 rounded-xl bg-gold hover:brightness-110 text-[var(--gold-ink)] text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
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
                ? 'border-gold bg-primary/10'
                : 'border-line bg-secondary'
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Rank Badge */}
              <div className="w-8 h-8 rounded-xl bg-surface-raised font-data text-xs font-bold text-ink flex items-center justify-center shrink-0">
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
              </div>

              <span className="text-3xl shrink-0">{member.avatar}</span>

              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-sm font-bold text-ink font-heading">{member.name}</strong>
                  <span className="text-2xs px-2 py-0.5 rounded-full bg-secondary text-accent font-bold">
                    {member.relation}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-ink-muted mt-1 font-medium">
                  <span className="text-gold-text font-bold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 fill-gold text-gold-text" /> {member.streakDays} Day Streak
                  </span>
                  <span>• Health Index: <strong className="text-sage-text font-bold">{member.healthScore}/10</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-line">
              <div className="text-right">
                <strong className="font-data text-lg font-bold text-primary block">
                  {member.points} <span className="text-xs font-bold">Pts</span>
                </strong>
                <span className="text-2xs text-ink-faint block font-bold">{member.badge}</span>
              </div>

              {member.id !== '1' && (
                <button onClick={() => onRemoveMember(member.id)} className="text-ink-faint hover:text-[var(--danger)]">
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
