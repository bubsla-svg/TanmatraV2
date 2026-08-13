"use client";
import React, { useState, useEffect } from 'react';
import { Trophy, Flame } from 'lucide-react';

import { getFamilyLeaderboard, type FamilyMember } from '@/lib/wellnessApi';
import { LeaderboardTable } from './LeaderboardTable';
import { DailyQuestsCard, type Quest } from './DailyQuestsCard';
import { BadgeShowcase, BADGES_CATALOG, type Badge } from './BadgeShowcase';

export { BADGES_CATALOG };
export type { Quest, Badge };

export const DEFAULT_FAMILY_MEMBERS: FamilyMember[] = [
  {
    id: '1',
    name: 'Engineer Ankita Badadhe',
    relation: 'You (Self)',
    avatar: '👩‍💻',
    healthScore: 9.4,
    streakDays: 14,
    hydrationPercent: 92,
    proteinPercent: 88,
    points: 1450,
    badge: '🥇 Health Champion',
    rank: 1
  },
  {
    id: '2',
    name: 'Sandeep Sahani',
    relation: 'Spouse',
    avatar: '👨‍💼',
    healthScore: 8.9,
    streakDays: 10,
    hydrationPercent: 85,
    proteinPercent: 79,
    points: 1180,
    badge: '🥈 Hydration Titan',
    rank: 2
  },
  {
    id: '3',
    name: 'Trupti Badadhe',
    relation: 'Sister',
    avatar: '👩',
    healthScore: 9.1,
    streakDays: 8,
    hydrationPercent: 100,
    proteinPercent: 90,
    points: 980,
    badge: '🥉 Active Explorer',
    rank: 3
  },
  {
    id: '4',
    name: 'Alka Badadhe',
    relation: 'Mother',
    avatar: '👵',
    healthScore: 8.7,
    streakDays: 6,
    hydrationPercent: 78,
    proteinPercent: 82,
    points: 750,
    badge: '⭐ Wellness Ambassador',
    rank: 4
  }
];

export const DAILY_QUESTS: Quest[] = [
  { id: 'q1', title: 'Log 3.0 Liters Daily Water Intake', points: 100, completed: true, category: 'Hydration' },
  { id: 'q2', title: 'Complete 16:8 Circadian Fasting Window', points: 150, completed: true, category: 'Fasting' },
  { id: 'q3', title: 'Hit Daily Protein Target (50g+)', points: 120, completed: false, category: 'Nutrition' },
  { id: 'q4', title: 'Scan Pantry or Upload Food Image', points: 80, completed: false, category: 'Diagnostics' },
  { id: 'q5', title: 'Maintain 7-Day Habit Streak', points: 200, completed: true, category: 'Nutrition' }
];

export const FamilyLeaderboardView: React.FC = () => {
  const [members, setMembers] = useState<FamilyMember[]>(DEFAULT_FAMILY_MEMBERS);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    getFamilyLeaderboard()
      .then((res: { members: FamilyMember[] }) => {
        if (res.members && res.members.length > 0) {
          setMembers(res.members);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const [quests, setQuests] = useState<Quest[]>(DAILY_QUESTS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRelation, setNewMemberRelation] = useState('Family Member');
  const [newMemberAvatar, setNewMemberAvatar] = useState('🧑');

  // Toggle Quest
  const handleToggleQuest = (questId: string) => {
    setQuests(prev => prev.map(q => {
      if (q.id !== questId) return q;
      const updatedStatus = !q.completed;
      
      // Update self member points
      if (updatedStatus) {
        setMembers(mList => mList.map(m => m.id === '1' ? { ...m, points: m.points + q.points } : m));
      } else {
        setMembers(mList => mList.map(m => m.id === '1' ? { ...m, points: Math.max(0, m.points - q.points) } : m));
      }

      return { ...q, completed: updatedStatus };
    }));
  };

  // Add Family Member
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    const newM: FamilyMember = {
      id: 'fam-' + Date.now(),
      name: newMemberName,
      relation: newMemberRelation,
      avatar: newMemberAvatar,
      healthScore: 8.8,
      streakDays: 1,
      hydrationPercent: 70,
      proteinPercent: 75,
      points: 500,
      badge: '🌟 New Member',
      rank: members.length + 1
    };

    setMembers(prev => [...prev, newM]);
    setNewMemberName('');
    setIsAddModalOpen(false);
  };

  // Remove Family Member
  const handleRemoveMember = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  // Sort Members by Points
  const sortedMembers = [...members].sort((a, b) => b.points - a.points);
  const totalFamilyPoints = members.reduce((sum, m) => sum + m.points, 0);

  return (
    <div className="space-y-8">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-[var(--gold)]/15 via-[var(--gold)]/10 to-[var(--surface)] text-ink p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden border border-[var(--gold)]/30">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gold/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-gold/20 text-[var(--gold-text)] font-extrabold text-xs border border-[var(--gold)]/30 flex items-center gap-1.5 shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-[var(--gold-text)]" /> Family Health Gamification Engine
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-heading tracking-tight">
              Family Health Leaderboard & Daily Streaks
            </h2>
            <p className="text-xs sm:text-sm text-ink-faint font-medium max-w-xl">
              Compete with family members, complete daily nutrition quests, maintain daily habit streaks, and unlock ICMR wellness rewards!
            </p>
          </div>

          <div className="flex items-center gap-4 bg-surface-raised p-4 rounded-2xl border border-line backdrop-blur-md shrink-0">
            <Flame className="w-8 h-8 text-[var(--gold-text)] animate-pulse" />
            <div>
              <strong className="text-2xl font-black text-[var(--gold-text)] font-heading block">{sortedMembers[0]?.streakDays || 14} Days 🔥</strong>
              <span className="text-3xs text-ink-faint uppercase tracking-wider font-bold">Top Family Habit Streak</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Leaderboard Table & Quests */}
        <div className="lg:col-span-2 space-y-8">
          <LeaderboardTable
            sortedMembers={sortedMembers}
            totalFamilyPoints={totalFamilyPoints}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onRemoveMember={handleRemoveMember}
          />
          <DailyQuestsCard quests={quests} onToggleQuest={handleToggleQuest} />
        </div>

        {/* Right 1 Col: Badges & Rewards */}
        <div className="space-y-8">
          <BadgeShowcase />
        </div>
      </div>

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setIsAddModalOpen(false)} className="fixed inset-0 bg-surface/80 backdrop-blur-md z-[99]" />
          
          <div className="relative z-[100] bg-surface rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-line space-y-4">
            <h3 className="text-lg font-black font-heading text-ink">Add Family Member</h3>
            
            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-ink-muted block mb-1">Member Name</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-surface-subtle border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-[var(--gold)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink-muted block mb-1">Relationship</label>
                <select
                  value={newMemberRelation}
                  onChange={(e) => setNewMemberRelation(e.target.value)}
                  className="w-full bg-surface-subtle border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-[var(--gold)]"
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Sister">Sister</option>
                  <option value="Brother">Brother</option>
                  <option value="Son">Son</option>
                  <option value="Daughter">Daughter</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Grandparent">Grandparent</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-ink-muted block mb-1">Avatar Icon</label>
                <div className="flex gap-2">
                  {['👨‍💼', '👩‍💼', '👦', '👧', '👴', '👵'].map(av => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setNewMemberAvatar(av)}
                      className={`text-2xl p-2 rounded-xl border ${newMemberAvatar === av ? 'border-[var(--gold)] bg-gold/10' : 'border-line'}`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-subtle text-ink-muted text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gold text-[var(--gold-ink)] text-xs font-bold shadow-md"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
