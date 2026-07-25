import Link from "next/link";
import { formatPaise } from "@/lib/format";

export interface ChefBundle {
  id: string;
  title: string;
  badge: string;
  desc: string;
  mealCount: number;
  estTotalPaise: number;
  savingsLabel: string;
  planSlug: string;
}

const BUNDLES: ChefBundle[] = [
  {
    id: "metabolic-reset-5d",
    title: "5-Day Metabolic Reset Bundle",
    badge: "Most Popular Value",
    desc: "Five consecutive weekday therapeutic lunches designed for blood sugar stability and sustained midday focus.",
    mealCount: 5,
    estTotalPaise: 165000, // ₹1,650
    savingsLabel: "Save up to ₹200 vs standard à-la-carte delivery billing",
    planSlug: "weight-loss-jumpstart",
  },
  {
    id: "hypertrophy-protein-10d",
    title: "10-Meal Fortnightly Muscle Pack",
    badge: "Maximum Protein per Rupee",
    desc: "Ten high-protein meal deliveries (>30g per bowl) paired with complimentary post-workout probiotic coolers.",
    mealCount: 10,
    estTotalPaise: 320000, // ₹3,200
    savingsLabel: "Includes free RD intro consultation & waived delivery charges",
    planSlug: "lean-muscle-builder",
  },
  {
    id: "pcos-balance-bundle",
    title: "Clinical Hormone Balance Pack",
    badge: "Low-GI Certified",
    desc: "Strict low-glycemic Mediterranean and Indian clinical lunches engineered for insulin resilience and satiety.",
    mealCount: 5,
    estTotalPaise: 175000, // ₹1,750
    savingsLabel: "Automatically applies ₹399 trial creditback on signup",
    planSlug: "pcos-balance",
  },
];

export function BundleOfferCard({ bundle }: { bundle?: ChefBundle }) {
  const items = bundle ? [bundle] : BUNDLES;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {items.map((b) => (
        <div
          key={b.id}
          className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between gap-5 transition-all duration-200 hover:border-gold/40"
        >
          <div className="flex flex-col gap-3">
            <span className="inline-block rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-semibold text-sage-800 tracking-wide w-fit">
              {b.badge}
            </span>
            <h3 className="text-lg font-semibold text-ink leading-snug">{b.title}</h3>
            <p className="text-xs text-ink-muted leading-relaxed">{b.desc}</p>
            <div className="rounded-xl bg-gold/5 border border-gold/20 p-2.5 text-[11px] font-semibold text-gold-text">
              &starf; {b.savingsLabel}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-ink-muted">Server Authoritative Quote:</span>
              <span className="text-base font-bold text-ink">{formatPaise(b.estTotalPaise)} / cycle</span>
            </div>
            <Link
              href={`/plan/${b.planSlug}`}
              className="flex w-full items-center justify-center rounded-xl bg-gold py-3 text-xs font-semibold text-white shadow-sm hover:bg-gold/90 transition-colors"
            >
              Select &mdash; Configure Deliveries &rarr;
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
