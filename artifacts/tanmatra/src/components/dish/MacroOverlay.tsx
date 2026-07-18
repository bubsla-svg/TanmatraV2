import { Progress } from "@/components/ui/progress";
import { Flame } from "lucide-react";
import { usePreferences } from "@/lib/preferencesContext";

export interface MacroData {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  calories: number;
}

interface MacroOverlayProps {
  macros: MacroData;
  rdVerified?: boolean;
  compact?: boolean;
  sodiumMg?: number;
}

// NOTE: `rdVerified` is intentionally NOT rendered. No dish carries a reviewer
// id / date record, so an "RD Verified" badge is an unbacked claim (audit T2.1).
// The prop stays for caller compatibility until a real review record exists.
export default function MacroOverlay({ macros, compact = false, sodiumMg }: MacroOverlayProps) {
  const { preferences } = usePreferences();
  const isAssessed = preferences !== null && preferences.quizCompletedAt !== null;
  const total = macros.protein + macros.carbs + macros.fat;
  const proteinPct = total > 0 ? Math.round((macros.protein / total) * 100) : 0;
  const carbsPct = total > 0 ? Math.round((macros.carbs / total) * 100) : 0;
  const fatPct = total > 0 ? Math.round((macros.fat / total) * 100) : 0;

  if (compact) {
    // Circumference of circle with r = 16 is 2 * pi * 16 = 100.53
    const r = 16;
    const C = 2 * Math.PI * r;
    
    const lenP = (proteinPct / 100) * C;
    const lenC = (carbsPct / 100) * C;
    const lenF = (fatPct / 100) * C;

    return (
      <div
        className="flex items-center gap-2.5 p-1.5 rounded-xl bg-nn-bg/85 border border-white/[0.032] backdrop-blur-md"
        role="group"
        aria-label="Macro nutrient distribution ratios"
      >
        {/* SVG Macro Progress Ring */}
        <div className="relative w-10 h-10 shrink-0 group/ring">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            {/* Background circle */}
            <circle
              cx="18"
              cy="18"
              r={r}
              fill="transparent"
              className="stroke-white/5"
              strokeWidth="3"
            />
            {/* Protein segment */}
            {isAssessed && lenP > 0 && (
              <circle
                cx="18"
                cy="18"
                r={r}
                fill="transparent"
                stroke="var(--color-nn-tertiary)"
                strokeWidth="3.5"
                strokeDasharray={`${lenP} ${C}`}
                strokeDashoffset="0"
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            )}
            {/* Carbs segment */}
            {isAssessed && lenC > 0 && (
              <circle
                cx="18"
                cy="18"
                r={r}
                fill="transparent"
                stroke="var(--color-nn-primary)"
                strokeWidth="3.5"
                strokeDasharray={`${lenC} ${C}`}
                strokeDashoffset={`-${lenP}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            )}
            {/* Fat segment */}
            {isAssessed && lenF > 0 && (
              <circle
                cx="18"
                cy="18"
                r={r}
                fill="transparent"
                stroke="var(--color-clinical-sage)"
                strokeWidth="3.5"
                strokeDasharray={`${lenF} ${C}`}
                strokeDashoffset={`-${lenP + lenC}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            )}
          </svg>
          {/* Center Calorie Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <span className="text-[9px] font-bold leading-none tabular-nums">{macros.calories}</span>
            <span className="text-[6px] opacity-60 font-medium uppercase tracking-tight">kcal</span>
          </div>
        </div>

        {/* Precise Nutrient Breakdown Column */}
        <div className="flex flex-col gap-0.5 justify-center">
          <div className="flex items-center gap-1.5 text-[9px] leading-none font-semibold text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-nn-tertiary" />
            <span>P</span>
            <span className="tabular-nums">{macros.protein}g</span>
            {isAssessed && <span className="opacity-40 text-[8px]">({proteinPct}%)</span>}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] leading-none font-semibold text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-nn-primary" />
            <span>C</span>
            <span className="tabular-nums">{macros.carbs}g</span>
            {isAssessed && <span className="opacity-40 text-[8px]">({carbsPct}%)</span>}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] leading-none font-semibold text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-clinical-sage" />
            <span>F</span>
            <span className="tabular-nums">{macros.fat}g</span>
            {isAssessed && <span className="opacity-40 text-[8px]">({fatPct}%)</span>}
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Calorie badge */}
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-400" />
        <span className="tabular-nums text-lg font-semibold text-white">{macros.calories}</span>
        <span className="text-clinical-label">kcal</span>
      </div>

      {/* Macro bars */}
      <div className="space-y-2.5">
        <MacroBar label="Protein" value={macros.protein} pct={proteinPct} barColor="bg-nn-tertiary" unit="g" isAssessed={isAssessed} />
        <MacroBar label="Carbs" value={macros.carbs} pct={carbsPct} barColor="bg-nn-primary" unit="g" isAssessed={isAssessed} />
        <MacroBar label="Fat" value={macros.fat} pct={fatPct} barColor="bg-clinical-sage" unit="g" isAssessed={isAssessed} />
        <MacroBar label="Fiber" value={macros.fiber} pct={Math.min((macros.fiber / 30) * 100, 100)} barColor="bg-emerald-400" unit="g" isAssessed={isAssessed} />
        {typeof sodiumMg === "number" && (
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-nn-on-surface-variant">Sodium</span>
            <span className="tabular-nums text-white font-medium">
              {sodiumMg}mg
              <span className="text-nn-secondary text-[10px] ml-1">
                ({Math.round((sodiumMg / 2300) * 100)}% DV)
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MacroBar({
  label,
  value,
  pct,
  barColor,
  unit,
  isAssessed = true,
}: {
  label: string;
  value: number;
  pct: number;
  barColor: string;
  unit: string;
  isAssessed?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-nn-on-surface-variant flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isAssessed ? barColor : "bg-nn-on-surface-variant/40"}`} />
          {label}
        </span>
        <span className="tabular-nums text-white font-medium">
          {value}
          {unit}
        </span>
      </div>
      <div className="h-1.5 bg-nn-surface-high rounded-full overflow-hidden">
        <div
          className={`h-full ${isAssessed ? barColor : "bg-nn-on-surface-variant/20"} rounded-full transition-all duration-700 ease-out`}
          style={{ width: isAssessed ? `${Math.max(pct, 4)}%` : "0%" }}
        />
      </div>
    </div>
  );
}
