"use client";
import React, { useState, useEffect } from 'react';
import { Droplets } from 'lucide-react';
import { getToday, logWater, getActiveFasting, type NutritionLog } from '@/lib/wellnessApi';
import { FastingClock, FASTING_MODES, type FastingMode } from './FastingClock';
import { HydrationLogger } from './HydrationLogger';

export { FASTING_MODES };
export type { FastingMode };

export const HydrationCircadianTracker: React.FC = () => {
  const [dailyGoalMl, setDailyGoalMl] = useState<number>(3000);
  const [waterLogs, setWaterLogs] = useState<NutritionLog[]>([]);
  const [customMlInput, setCustomMlInput] = useState<string>('');

  const [selectedFastingMode, setSelectedFastingMode] = useState<FastingMode>(FASTING_MODES[0]!);
  const [isFastingActive, setIsFastingActive] = useState<boolean>(false);
  const [fastingSecondsElapsed, setFastingSecondsElapsed] = useState<number>(0);

  useEffect(() => {
    // Load today's hydration
    getToday().then((res) => {
      setDailyGoalMl(res.targets.waterTargetMl);
      const todayWater = res.logs.filter((l: NutritionLog) => l.source === 'water');
      setWaterLogs(todayWater);
    }).catch(console.error);

    // Load active fast
    getActiveFasting().then((res) => {
      if (res.log) {
        const activeLog = res.log;
        setIsFastingActive(true);
        const mode = FASTING_MODES.find((m) => m.fastingHours === activeLog.targetHours) || FASTING_MODES[0]!;
        setSelectedFastingMode(mode);
        const start = new Date(activeLog.startTime).getTime();
        setFastingSecondsElapsed(Math.floor((Date.now() - start) / 1000));
      }
    }).catch(console.error);
  }, []);

  // Timer Tick Interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isFastingActive) {
      interval = setInterval(() => {
        setFastingSecondsElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isFastingActive]);

  // Log Water Intake
  const handleAddWater = (amountMl: number) => {
    logWater(amountMl).then((res: { log: NutritionLog }) => {
      setWaterLogs(prev => [...prev, res.log]);
    }).catch(console.error);
  };

  const handleCustomAddWater = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customMlInput);
    if (val > 0) {
      handleAddWater(val);
      setCustomMlInput('');
    }
  };

  const handleRemoveLog = (id: number) => {
    setWaterLogs(prev => prev.filter(l => l.id !== id));
  };

  const handleResetWater = () => {
    setWaterLogs([]);
  };

  // Calculations
  const totalWaterLoggedMl = waterLogs.reduce((sum, log) => sum + log.waterMl, 0);
  const hydrationPercentage = Math.min(100, Math.round((totalWaterLoggedMl / dailyGoalMl) * 100));

  // Fasting Calculations
  const totalFastingGoalSeconds = selectedFastingMode.fastingHours * 3600;
  const remainingFastingSeconds = Math.max(0, totalFastingGoalSeconds - fastingSecondsElapsed);

  const formatTimeHHMMSS = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Metabolic Stage Determination
  const elapsedHours = fastingSecondsElapsed / 3600;
  let metabolicStage = {
    title: 'Anabolic Digestion Stage',
    desc: 'Blood sugar is being normalized and glucose is stored as glycogen.',
    color: 'text-[var(--gold-text)]'
  };

  if (elapsedHours >= 12) {
    metabolicStage = {
      title: 'Autophagy & Cellular Repair Active',
      desc: 'Damaged cellular proteins are cleared & mitochondrial biogenesis is triggered!',
      color: 'text-sage-text'
    };
  } else if (elapsedHours >= 8) {
    metabolicStage = {
      title: 'Ketosis & Accelerated Fat Oxidation',
      desc: 'Glycogen is depleted and liver synthesizes ketone bodies for energy.',
      color: 'text-[var(--gold-text)]'
    };
  } else if (elapsedHours >= 4) {
    metabolicStage = {
      title: 'Insulin Drop & Glycogen Depletion',
      desc: 'Circulating insulin levels drop, enabling fat stores to be unlocked.',
      color: 'text-[var(--gold)]'
    };
  }

  return (
    <div className="space-y-8">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-[var(--gold)]/15 via-[var(--gold)]/10 to-[var(--surface)] text-ink p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden border border-[var(--gold)]/30">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gold/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-gold/20 text-[var(--gold-text)] font-extrabold text-xs border border-[var(--gold)]/30 flex items-center gap-1.5 shadow-sm">
                <Droplets className="w-3.5 h-3.5 text-[var(--gold-text)]" /> Circadian Rhythm & Electrolyte Studio
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-heading tracking-tight">
              AI Hydration & Circadian Timing Tracker
            </h2>
            <p className="text-xs sm:text-sm text-ink-faint font-medium max-w-xl">
              Track daily hydration, log water intake, monitor intermittent fasting metabolic stages, and optimize your digestive circadian rhythm with ICMR clinical guidelines.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-surface-raised p-4 rounded-2xl border border-line backdrop-blur-md shrink-0">
            <Droplets className="w-8 h-8 text-[var(--gold-text)] animate-bounce" />
            <div>
              <strong className="text-2xl font-black text-ink font-heading block">{totalWaterLoggedMl} <span className="text-xs text-[var(--gold-text)]">/ {dailyGoalMl} mL</span></strong>
              <span className="text-3xs text-ink-faint uppercase tracking-wider font-bold">Daily Hydration Index: {hydrationPercentage}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <HydrationLogger
          dailyGoalMl={dailyGoalMl}
          waterLogs={waterLogs}
          totalWaterLoggedMl={totalWaterLoggedMl}
          hydrationPercentage={hydrationPercentage}
          customMlInput={customMlInput}
          setCustomMlInput={setCustomMlInput}
          handleAddWater={handleAddWater}
          handleCustomAddWater={handleCustomAddWater}
          handleResetWater={handleResetWater}
          handleRemoveLog={handleRemoveLog}
        />

        <FastingClock
          selectedFastingMode={selectedFastingMode}
          setSelectedFastingMode={setSelectedFastingMode}
          isFastingActive={isFastingActive}
          setIsFastingActive={setIsFastingActive}
          fastingSecondsElapsed={fastingSecondsElapsed}
          setFastingSecondsElapsed={setFastingSecondsElapsed}
          remainingFastingSeconds={remainingFastingSeconds}
          formatTimeHHMMSS={formatTimeHHMMSS}
          metabolicStage={metabolicStage}
        />
      </div>
    </div>
  );
};
