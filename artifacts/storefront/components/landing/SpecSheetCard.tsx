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
  /**
   * Macros are ingredient-derived estimates, not lab values — the readout
   * prefixes them with "~". Off by default: a hedge is opt-in, so an exact
   * number is never silently marked approximate.
   */
  macrosEstimated?: boolean;
  /**
   * Macros are an unresolved placeholder, not a measurement of this dish. The
   * readout shows "being verified" instead of the figures — a bucket value
   * printed confidently is worse than no value on a clinical surface.
   */
  macrosProvisional?: boolean;
  /**
   * Glycemic classification, when the catalog actually knows it. No dish
   * carries this today, so the row simply does not render — see the comment
   * at its render site for why that is the point.
   */
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
  // Every number and claim below is the dish's own or it does not render.
  //
  // Two house sentences used to stand in when the data was missing: a
  // glycemic label defaulting to "Low-Medium GI (Steady Predicate)" and an RD
  // comment defaulting to "Formulated for glycemic stability & sustained
  // amino acid delivery." They read as per-dish findings. They were not: no
  // catalog dish carries a GI classification, and no catalog dish carries an
  // RD note at all — so under real data those two sentences would have
  // appeared, identically, beneath EVERY dish, on a card headed "Clinical
  // Spec Sheet". A defaulted clinical claim is a fabricated one.
  const est = spec.macrosEstimated ? "≈" : "";
  const showRdBlock = spec.rdVerified === true || Boolean(spec.rdNote);

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">
            Clinical Spec Sheet
          </span>
          <h3 className="font-display text-base font-semibold text-primary">{spec.name}</h3>
        </div>
        <span className="font-data text-sm font-bold text-primary">
          {formatPaise(spec.price)}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2.5 text-xs text-ink">
        {/* Renders only for a dish that actually has a classification. None
            do today, so this row is currently absent everywhere — which is
            the honest state, and it reappears by itself the day the catalog
            carries real GI data. */}
        {spec.giClass && (
          <div className="flex items-center justify-between rounded-md border border-line bg-secondary p-2">
            <span className="font-semibold text-ink-muted">Glycemic Index</span>
            <span className="font-semibold text-ink">{spec.giClass}</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-1 rounded-md border border-line bg-surface p-2 text-center">
          <div className="flex flex-col">
            <span className="text-2xs text-ink-faint">KCAL</span>
            <span className="font-data font-semibold text-ink">{est}{spec.macros.calories}</span>
          </div>
          <div className="flex flex-col border-l border-line">
            <span className="text-2xs text-ink-faint">PRO</span>
            <span className="font-data font-semibold text-ink">{est}{spec.macros.protein}g</span>
          </div>
          <div className="flex flex-col border-l border-line">
            <span className="text-2xs text-ink-faint">CARB</span>
            <span className="font-data font-semibold text-ink">{est}{spec.macros.carbs}g</span>
          </div>
          <div className="flex flex-col border-l border-line">
            <span className="text-2xs text-ink-faint">FAT</span>
            <span className="font-data font-semibold text-ink">{est}{spec.macros.fat}g</span>
          </div>
        </div>

        {/* Fails CLOSED. The badge used to show unless rdVerified was
            explicitly `false`, so an unknown verification status rendered as
            "Verified" — the one direction a trust badge must never guess. */}
        {showRdBlock && (
          <div className="flex flex-col gap-1 rounded-md border border-line bg-secondary p-2">
            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-semibold text-ink">RD Protocol Verification</span>
              {spec.rdVerified === true && (
                <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-2xs font-semibold text-ink-muted">
                  Verified
                </span>
              )}
            </div>
            {spec.rdNote && (
              <p className="line-clamp-2 text-2xs leading-relaxed text-ink-muted">
                {spec.rdNote}
              </p>
            )}
          </div>
        )}
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
