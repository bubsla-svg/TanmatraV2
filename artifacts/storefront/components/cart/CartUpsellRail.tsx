"use client";

import { formatPaise } from "@/lib/format";
import type { CartLine } from "@/lib/cartStore";

export interface UpsellCandidate {
  dishId: number;
  kind: "marketplace";
  slug: string;
  name: string;
  pricePaise: number;
  tagline: string;
}

export const UPSELL_CANDIDATES: UpsellCandidate[] = [
  {
    dishId: 901,
    kind: "marketplace",
    slug: "marine-collagen-shot",
    name: "Marine Collagen Elixir",
    pricePaise: 14900,
    tagline: "Skin & Joint Elasticity",
  },
  {
    dishId: 902,
    kind: "marketplace",
    slug: "digestive-kombucha-tonic",
    name: "Botanical Gut Tonic",
    pricePaise: 12900,
    tagline: "Prebiotic & Microbiome Support",
  },
  {
    dishId: 903,
    kind: "marketplace",
    slug: "whey-isolate-snack-pack",
    name: "High-Protein Energy Crunch",
    pricePaise: 9900,
    tagline: "15g Protein Quick Fuel",
  },
  {
    dishId: 904,
    kind: "marketplace",
    slug: "electrolyte-hydration-powder",
    name: "Cellular Hydration Electrolytes",
    pricePaise: 7900,
    tagline: "Zero-Sugar Minerals",
  },
];

export function filterUpsellCandidates(existingLines: CartLine[]): UpsellCandidate[] {
  const existingIds = new Set(existingLines.map((l) => l.dishId));
  return UPSELL_CANDIDATES.filter((item) => !existingIds.has(item.dishId)).slice(0, 3);
}

export function CartUpsellRail({
  cartLines,
  onAdd,
}: {
  cartLines: CartLine[];
  onAdd: (item: UpsellCandidate) => void;
}) {
  const candidates = filterUpsellCandidates(cartLines);
  if (candidates.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface-raised p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-gold-text">
        Recommended Add-ons
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {candidates.map((item) => (
          <div
            key={item.dishId}
            className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface p-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
              <p className="truncate text-[10px] text-ink-muted">{item.tagline}</p>
              <p className="tabular text-xs font-medium text-gold-text">
                {formatPaise(item.pricePaise)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAdd(item)}
              className="shrink-0 rounded-md bg-gold px-3 py-1.5 text-xs font-bold text-[var(--gold-ink)] transition-transform active:scale-95 hover:opacity-90"
            >
              + Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
