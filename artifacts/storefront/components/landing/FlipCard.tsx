"use client"; // Interactive card flip and state management
// Tap-to-flip clinical dish photo card revealing specification sheet
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/format";
import { emitLpEvent } from "@/lib/lpEvents";
import { PLAN_PRICE_TABLE } from "@workspace/subscription-rules";
import { SpecSheetCard, type ClinicalDishSpec } from "./SpecSheetCard";
import { SafeImage } from "@/components/ui/SafeImage";

export interface FlipCardProps {
  spec?: ClinicalDishSpec;
  initialFlipped?: boolean;
}

const DEFAULT_SPEC: ClinicalDishSpec = {
  id: "steady_sample_01",
  name: "Glazed Salmon & Quinoa Bowl",
  image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop",
  isVeg: false,
  price:
    PLAN_PRICE_TABLE.steady.nonveg.perMealPaise ??
    PLAN_PRICE_TABLE.protein_build.veg.perMealPaise!,
  macros: {
    calories: 460,
    protein: 38,
    carbs: 42,
    fat: 16,
    fiber: 7,
  },
  giClass: "Low GI (<55) — Steady Predicate",
  rdVerified: true,
  rdNote: "Formulated for post-prandial glucose stability with high omega-3 lipid profile.",
  category: "mains",
};

export function FlipCard({ spec = DEFAULT_SPEC, initialFlipped = false }: FlipCardProps) {
  const [flipped, setFlipped] = useState(initialFlipped);

  function toggleFlip(newFlipped: boolean) {
    setFlipped(newFlipped);
    if (newFlipped) {
      emitLpEvent("spec_card_flip", {
        dish: spec.name,
        id: spec.id,
        giClass: spec.giClass ?? "unclassified",
      });
    }
  }

  if (flipped) {
    return (
      <div className="h-full w-full transition-all duration-300">
        <SpecSheetCard spec={spec} onFlipBack={() => toggleFlip(false)} />
      </div>
    );
  }

  const est = spec.macros ? "~" : "";

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
      <button
        type="button"
        onClick={() => toggleFlip(true)}
        className="flex w-full flex-col text-left outline-none"
        aria-label={`View clinical spec sheet for ${spec.name}`}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-raised">
          {spec.image && (
            <SafeImage
              src={spec.image}
              alt={spec.name}
              className="h-full w-full"
              imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
            />
          )}
          <span
            role="img"
            aria-label={spec.isVeg ? "Vegetarian" : "Non-vegetarian"}
            className={`absolute left-2 top-2 inline-block h-3 w-3 ring-2 ring-white ${
              spec.isVeg ? "rounded-full" : "rounded-[2px]"
            }`}
            style={{ backgroundColor: spec.isVeg ? "var(--sage)" : "var(--danger)" }}
          />
          <span className="absolute bottom-2 right-2 rounded-md border border-line bg-surface px-2 py-1 text-2xs font-semibold text-ink shadow">
            Tap for Specs ➔
          </span>
        </div>
        <div className="flex flex-col gap-1.5 p-3 pb-0">
          <h3 className="text-sm font-semibold leading-snug text-ink">{spec.name}</h3>
          <p className="text-2xs font-semibold text-ink-muted">
            {spec.giClass ?? "Clinical Macro Monitored"}
          </p>
          <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {spec.rdNote ??
              "Precision macro balanced meal designed by certified clinical dietitians."}
          </p>
        </div>
      </button>

      <div className="mt-auto flex items-center justify-between gap-2 p-3 pt-2">
        <div className="flex flex-col">
          <span className="tabular text-sm font-semibold text-ink">
            {formatPaise(spec.price)}
          </span>
          <span className="tabular text-2xs text-ink-faint">
            {est}
            {spec.macros.calories} kcal · {est}
            {spec.macros.protein}g P
          </span>
        </div>
        <Button
          type="button"
          onClick={() => toggleFlip(true)}
          shape="xl" size="fluid" className="px-3 py-1.5 text-xs font-semibold"
        >
          View Specs
        </Button>
      </div>
    </article>
  );
}
