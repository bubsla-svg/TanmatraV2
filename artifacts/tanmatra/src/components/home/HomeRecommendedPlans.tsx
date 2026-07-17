import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { subscriptionsApi } from "@/lib/subscriptionsApi";
import { formatPriceRounded } from "@/lib/api/adapter";
import { Sparkle, Barbell, Heart } from "@phosphor-icons/react";

interface PlanPreset {
  slug: string;
  name: string;
  desc: string;
  badge: string;
  icon: typeof Sparkle;
  meals: number;
  macrosText: string;
}

const PLAN_PRESETS: PlanPreset[] = [
  {
    slug: "weight-loss-jumpstart",
    name: "Weight-Loss Jumpstart",
    desc: "Lighter, high-fibre meals to support weight loss without feeling hungry.",
    badge: "Weight Loss",
    icon: Sparkle,
    meals: 5,
    macrosText: "Avg 32g Protein · 25g+ Fiber",
  },
  {
    slug: "lean-muscle-builder",
    name: "Lean Muscle Builder",
    desc: "Calorie surplus & high protein to fuel muscle growth and accelerate recovery.",
    badge: "Lean Muscle",
    icon: Barbell,
    meals: 10,
    macrosText: "Avg 45g Protein · 30g+ Fiber",
  },
  {
    slug: "pcos-balance",
    name: "PCOS Hormone Balance",
    desc: "Balanced, high-fibre meals designed to support steady blood sugar.",
    badge: "Hormone Health",
    icon: Heart,
    meals: 5,
    macrosText: "Avg 34g Protein · Low GI",
  },
];

export default function HomeRecommendedPlans() {
  return (
    <section className="padx mt-8">
      <div className="secrow px-0"><span className="sh">Recommended programs</span></div>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
        {PLAN_PRESETS.map((preset) => (
          <PlanCard key={preset.slug} preset={preset} />
        ))}
      </div>
    </section>
  );
}

function PlanCard({ preset }: { preset: PlanPreset }) {
  const Icon = preset.icon;

  // Fetch live price quote from server quote API
  const { data: quote, isLoading } = useQuery({
    queryKey: ["subscription-quote", preset.slug, preset.meals],
    queryFn: () =>
      subscriptionsApi.quote({
        cadence: "weekly",
        mealsPerDelivery: preset.meals,
        planType: "standard",
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const displayPrice = quote ? formatPriceRounded(quote.totalPaise) : null;

  return (
    <div
      className="card snap-start shrink-0 w-[290px] flex flex-col justify-between"
      style={{ minHeight: 250 }}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="pill bg-[var(--tnm-action)]/10 text-[var(--tnm-action)] border border-[var(--tnm-action)]/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            {preset.badge}
          </span>
          <span className="text-xs text-white/50 font-medium">Weekly plan</span>
        </div>

        <h4 className="tt mt-3 flex items-center gap-1.5 text-white/95">
          <Icon className="w-4 h-4 text-[var(--tnm-action)]" />
          {preset.name}
        </h4>
        <p className="fine mt-2 text-white/60 leading-relaxed clamp3">{preset.desc}</p>
      </div>

      <div className="border-t border-white/5 pt-3 mt-4">
        <div className="flex items-baseline justify-between mb-3">
          <span className="tnm-data text-[10px] uppercase tracking-wider text-white/45">
            {preset.macrosText}
          </span>
          {isLoading ? (
            <span className="w-16 h-5 rounded bg-white/5 animate-pulse" />
          ) : (
            <span className="flex flex-col items-end">
              <span className="price text-sm text-[var(--tnm-action)] font-semibold">
                {displayPrice} <span className="text-[10px] text-white/50 font-normal">/wk</span>
              </span>
              {quote ? (
                <span className="text-[10px] text-white/45 font-normal">
                  ≈ {formatPriceRounded(quote.totalPaise / preset.meals)}/meal
                </span>
              ) : null}
            </span>
          )}
        </div>

        <Link
          to={`/subscribe?plan=${preset.slug}`}
          className="btn btn-p btn-blk text-center text-xs font-bold"
          style={{ height: 38 }}
        >
          Start This Program
        </Link>
      </div>
    </div>
  );
}
