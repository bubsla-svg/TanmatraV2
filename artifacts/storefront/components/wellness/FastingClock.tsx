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
    <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-line shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gold/10 text-[var(--gold-text)] flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-ink font-heading">Circadian Intermittent Fasting</h3>
            <span className="text-xs text-ink-muted font-medium">Metabolic Stage & Digestive Reset</span>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-gold/10 text-[var(--gold-text)] text-xs font-black border border-[var(--gold)]/20">
          {selectedFastingMode.name.split(' ')[0]}
        </span>
      </div>

      {/* Mode Selector */}
      <div className="space-y-2">
        <label className="text-xs font-extrabold uppercase tracking-wider text-ink-muted block">Select Fasting Protocol:</label>
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
                  ? 'bg-gold text-[var(--gold-ink)] border-[var(--gold)] shadow-md'
                  : 'bg-surface-subtle text-ink-muted border-line hover:border-[var(--gold)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{mode.icon}</span>
                <strong className="text-xs font-bold block">{mode.name.split(' ')[0]}</strong>
              </div>
              <span className="text-3xs opacity-80 block mt-1">{mode.fastingHours}h Fast • {mode.eatingHours}h Eat</span>
            </button>
          ))}
        </div>
      </div>

      {/* Timer Visual Display */}
      <div className="bg-surface text-ink p-6 rounded-3xl border border-line text-center space-y-4 relative overflow-hidden">
        <div className="space-y-1">
          <span className="text-2xs text-[var(--gold-text)] font-extrabold uppercase tracking-widest flex items-center justify-center gap-1">
            <Flame className="w-3.5 h-3.5" /> Fasting Timer Clock
          </span>
          <strong className="text-4xl sm:text-5xl font-black font-heading tracking-tight text-ink block">
            {formatTimeHHMMSS(fastingSecondsElapsed)}
          </strong>
          <span className="text-xs text-ink-faint font-medium block">
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
                ? 'bg-gold hover:brightness-110 text-[var(--gold-ink)]'
                : 'bg-sage hover:brightness-110 text-[var(--sage-ink)]'
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
            className="p-2.5 rounded-2xl bg-surface-raised hover:bg-line text-ink-faint"
            title="Reset Clock"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Current Metabolic Stage Card */}
      <div className="p-4 rounded-2xl bg-surface-subtle border border-line space-y-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sage-text" />
          <strong className={`text-xs font-bold ${metabolicStage.color}`}>
            Current Stage: {metabolicStage.title}
          </strong>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed font-medium">
          {metabolicStage.desc}
        </p>
      </div>

      {/* ICMR Electrolyte Tip */}
      <div className="p-4 rounded-2xl bg-sage/10 border border-[var(--sage)]/30 flex items-start gap-3">
        <Award className="w-5 h-5 text-sage-text shrink-0 mt-0.5" />
        <div>
          <strong className="text-xs font-bold text-sage-text block font-heading">ICMR Electrolyte Clinical Tip</strong>
          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed font-medium">
            During 14+ hour fasting windows, sip tender coconut water or lemon water with a pinch of Himalayan pink salt to maintain sodium/potassium electrolyte balance.
          </p>
        </div>
      </div>
    </div>
  );
};
