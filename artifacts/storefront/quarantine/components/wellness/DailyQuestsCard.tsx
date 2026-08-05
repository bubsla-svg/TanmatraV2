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
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading">Daily Wellness Quests</h3>
            <span className="text-xs text-slate-500 font-medium">Complete daily actions to earn points & badges</span>
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
                ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20' 
                : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 hover:border-emerald-500/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                quest.completed ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
              }`}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className={`text-xs font-bold ${quest.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                {quest.title}
              </span>
            </div>

            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-black shrink-0">
              +{quest.points} Pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
