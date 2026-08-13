"use client"; // Client presentation module for clinical dish specifications and macro readouts
// Interactive specification sheet card displaying clinical nutrition targets and RD metadata
import { formatPaise } from "@/lib/format";

export interface ClinicalDishSpec {
  id: string | number;
  name: string;
  image?: string;
  isVeg: boolean;
  price: number;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
  giClass?: string;
  rdVerified?: boolean;
  rdNote?: string;
  category?: string;
}

export interface SpecSheetCardProps {
  spec: ClinicalDishSpec;
  onFlipBack?: () => void;
}

export function SpecSheetCard({ spec, onFlipBack }: SpecSheetCardProps) {
  const giLabel = spec.giClass ?? "Low-Medium GI (Steady Predicate)";
  const rdComment =
    spec.rdNote ?? "Formulated for glycemic stability & sustained amino acid delivery.";

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
            Clinical Spec Sheet
          </span>
          <h3 className="text-base font-semibold text-ink">{spec.name}</h3>
        </div>
        <span className="tabular text-sm font-semibold text-ink">
          {formatPaise(spec.price)}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2.5 text-xs text-ink">
        <div className="flex items-center justify-between rounded-md border border-line bg-surface-raised p-2">
          <span className="font-semibold text-ink-muted">Glycemic Index</span>
          <span className="font-semibold text-ink">{giLabel}</span>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-md border border-line bg-surface p-2 text-center">
          <div className="flex flex-col">
            <span className="text-3xs text-ink-faint">KCAL</span>
            <span className="font-semibold text-ink">{spec.macros.calories}</span>
          </div>
          <div className="flex flex-col border-l border-line">
            <span className="text-3xs text-ink-faint">PRO</span>
            <span className="font-semibold text-ink">{spec.macros.protein}g</span>
          </div>
          <div className="flex flex-col border-l border-line">
            <span className="text-3xs text-ink-faint">CARB</span>
            <span className="font-semibold text-ink">{spec.macros.carbs}g</span>
          </div>
          <div className="flex flex-col border-l border-line">
            <span className="text-3xs text-ink-faint">FAT</span>
            <span className="font-semibold text-ink">{spec.macros.fat}g</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-md border border-line bg-surface-raised p-2">
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-semibold text-ink">RD Protocol Verification</span>
            {spec.rdVerified !== false && (
              <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-3xs font-semibold text-ink-muted">
                Verified
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-2xs leading-relaxed text-ink-muted">
            {rdComment}
          </p>
        </div>
      </div>

      {onFlipBack && (
        <button
          type="button"
          onClick={onFlipBack}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-line py-2 text-xs font-semibold text-ink transition-colors hover:border-line-strong"
        >
          View Photo &amp; Summary ➔
        </button>
      )}
    </article>
  );
}
