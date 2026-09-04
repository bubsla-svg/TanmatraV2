"use client";
import React from 'react';
import { Zap, CheckCircle2 } from 'lucide-react';

export interface Quest {
  id: string;
  title: string;
  points: number;
  completed: boolean;
  category: 'Hydration' | 'Nutrition' | 'Fasting' | 'Diagnostics';
}

interface DailyQuestsCardProps {
  quests: Quest[];
  onToggleQuest: (questId: string) => void;
}

export const DailyQuestsCard: React.FC<DailyQuestsCardProps> = ({ quests, onToggleQuest }) => {
  return (
    <div className="bg-surface rounded-2xl p-6 sm:p-8 border border-line space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sage/10 text-sage-text flex items-center justify-center font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold leading-tight text-primary">Daily Wellness Quests</h3>
            <span className="text-xs text-ink-muted font-medium">Complete daily actions to earn points & badges</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {quests.map(quest => (
          <div
            key={quest.id}
            onClick={() => onToggleQuest(quest.id)}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-4 ${
              quest.completed 
                ? 'border-sage/50 bg-sage-soft'
                : 'border-line bg-secondary hover:border-sage/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                quest.completed ? 'bg-sage text-[var(--sage-ink)]' : 'bg-surface-raised text-ink-faint'
              }`}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className={`text-xs font-bold ${quest.completed ? 'line-through text-ink-faint' : 'text-ink'}`}>
                {quest.title}
              </span>
            </div>

            <span className="px-3 py-1 rounded-full bg-secondary text-primary text-xs font-data font-bold shrink-0">
              +{quest.points} Pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
