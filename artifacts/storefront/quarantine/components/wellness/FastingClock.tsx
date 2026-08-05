"use client";
import React from 'react';
import { Clock, Play, Pause, RotateCcw, Flame, Activity, Award } from 'lucide-react';
import { startFasting, endFasting } from '@/lib/wellnessApi';

export interface FastingMode {
  id: string;
  name: string;
  fastingHours: number;
  eatingHours: number;
  description: string;
  icon: string;
}

export const FASTING_MODES: FastingMode[] = [
  {
    id: '16-8',
    name: '16:8 LeanGains (Recommended)',
    fastingHours: 16,
    eatingHours: 8,
    description: '16 hours fasting & 8 hours eating window. Ideal for fat loss & glycemic control.',
    icon: '⚡'
  },
  {
    id: '14-10',
    name: '14:10 Gentle Circadian',
    fastingHours: 14,
    eatingHours: 10,
    description: '14 hours fasting & 10 hours eating window. Perfect for beginners and busy schedules.',
    icon: '🌅'
  },
  {
    id: '18-6',
    name: '18:6 Autophagy Focus',
    fastingHours: 18,
    eatingHours: 6,
    description: '18 hours fasting & 6 hours eating window. Triggers cellular repair & deep autophagy.',
    icon: '🔥'
  },
  {
    id: '12-12',
    name: '12:12 Balanced Daily',
    fastingHours: 12,
    eatingHours: 12,
    description: '12 hours fasting & 12 hours eating window. Natural overnight digestive rest.',
    icon: '🍃'
  }
];

interface FastingClockProps {
  selectedFastingMode: FastingMode;
  setSelectedFastingMode: (mode: FastingMode) => void;
  isFastingActive: boolean;
  setIsFastingActive: (active: boolean) => void;
  fastingSecondsElapsed: number;
  setFastingSecondsElapsed: React.Dispatch<React.SetStateAction<number>>;
  remainingFastingSeconds: number;
  formatTimeHHMMSS: (sec: number) => string;
  metabolicStage: { title: string; desc: string; color: string };
}

export const FastingClock: React.FC<FastingClockProps> = ({
  selectedFastingMode,
  setSelectedFastingMode,
  isFastingActive,
  setIsFastingActive,
  fastingSecondsElapsed,
  setFastingSecondsElapsed,
  remainingFastingSeconds,
  formatTimeHHMMSS,
  metabolicStage,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading">Circadian Intermittent Fasting</h3>
            <span className="text-xs text-slate-500 font-medium">Metabolic Stage & Digestive Reset</span>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-black border border-amber-500/20">
          {selectedFastingMode.name.split(' ')[0]}
        </span>
      </div>

      {/* Mode Selector */}
      <div className="space-y-2">
        <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">Select Fasting Protocol:</label>
        <div className="grid grid-cols-2 gap-2">
          {FASTING_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => {
                setSelectedFastingMode(mode);
                setFastingSecondsElapsed(0);
                setIsFastingActive(false);
              }}
              className={`p-3 rounded-2xl text-left transition-all border ${
                selectedFastingMode.id === mode.id
                  ? 'bg-sky-900 text-white border-sky-900 shadow-md'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-sky-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{mode.icon}</span>
                <strong className="text-xs font-bold block">{mode.name.split(' ')[0]}</strong>
              </div>
              <span className="text-[10px] opacity-80 block mt-1">{mode.fastingHours}h Fast • {mode.eatingHours}h Eat</span>
            </button>
          ))}
        </div>
      </div>

      {/* Timer Visual Display */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 rounded-3xl border border-slate-800 text-center space-y-4 relative overflow-hidden">
        <div className="space-y-1">
          <span className="text-[11px] text-amber-400 font-extrabold uppercase tracking-widest flex items-center justify-center gap-1">
            <Flame className="w-3.5 h-3.5" /> Fasting Timer Clock
          </span>
          <strong className="text-4xl sm:text-5xl font-black font-heading tracking-tight text-white block">
            {formatTimeHHMMSS(fastingSecondsElapsed)}
          </strong>
          <span className="text-xs text-slate-400 font-medium block">
            {remainingFastingSeconds > 0 
              ? `${formatTimeHHMMSS(remainingFastingSeconds)} remaining until eating window`
              : '🎉 Fasting goal completed! Eating window open.'}
          </span>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              if (isFastingActive) {
                endFasting().then(() => {
                  setIsFastingActive(false);
                  setFastingSecondsElapsed(0);
                }).catch(console.error);
              } else {
                startFasting(selectedFastingMode.fastingHours).then(() => {
                  setIsFastingActive(true);
                  setFastingSecondsElapsed(0);
                }).catch(console.error);
              }
            }}
            className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all ${
              isFastingActive 
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
            }`}
          >
            {isFastingActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isFastingActive ? 'End Fasting' : 'Start Fasting'}</span>
          </button>

          <button
            onClick={() => {
              if (isFastingActive) {
                endFasting().catch(console.error);
              }
              setFastingSecondsElapsed(0);
              setIsFastingActive(false);
            }}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300"
            title="Reset Clock"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Current Metabolic Stage Card */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <strong className={`text-xs font-bold ${metabolicStage.color}`}>
            Current Stage: {metabolicStage.title}
          </strong>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
          {metabolicStage.desc}
        </p>
      </div>

      {/* ICMR Electrolyte Tip */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
        <Award className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block font-heading">ICMR Electrolyte Clinical Tip</strong>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed font-medium">
            During 14+ hour fasting windows, sip tender coconut water or lemon water with a pinch of Himalayan pink salt to maintain sodium/potassium electrolyte balance.
          </p>
        </div>
      </div>
    </div>
  );
};
