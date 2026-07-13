import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { subscriptionsApi } from "@/lib/subscriptionsApi";
import { formatPrice } from "@/lib/api/adapter";
import { Check } from "@phosphor-icons/react";

interface PricingPreset {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  meals: number;
  cadence: "weekly" | "fortnightly" | "monthly";
  planType: "standard" | "trial";
  ctaText: string;
  to: string;
  priceLabel: string;
}

const PRICING_PRESETS: PricingPreset[] = [
  {
    id: "trial",
    title: "3-Day Trial Pack",
    desc: "Perfect to test the waters. 3 lunches delivered on consecutive days. No auto-renewal.",
    meals: 3,
    cadence: "weekly",
    planType: "trial",
    ctaText: "Start Trial",
    to: "/subscribe?trial=1",
    priceLabel: "one-time",
  },
  {
    id: "weekly",
    title: "Weekly Plan",
    desc: "Daily lunches. Pause, skip, or swap anytime. Delivery included, renews weekly.",
    badge: "Recommended",
    meals: 5,
    cadence: "weekly",
    planType: "standard",
    ctaText: "Start Week",
    to: "/subscribe?plan=healthy-everyday-plan&cadence=weekly",
    priceLabel: "/week",
  },
  {
    id: "six-week",
    title: "6-Week Reset",
    desc: "Complete metabolic reset protocol. 30 lunches, dietitian advisory, commitment discount.",
    meals: 30,
    cadence: "monthly",
    planType: "standard",
    ctaText: "View Program",
    to: "/subscribe?plan=healthy-everyday-plan&cadence=monthly",
    priceLabel: "total commitment",
  },
];

const FLEXIBILITY_ITEMS = [
  "Swap meals up to 24h before delivery",
  "Pause or skip individual days online",
  "No hidden fees, cancel in one tap",
];

export default function HomePricing() {
  return (
    <section className="padx mt-12 mb-12">
      <div className="secrow px-0 text-center flex-col items-center gap-2">
        <span className="sh text-2xl">Simple, flexible pricing</span>
        <p className="fine max-w-[340px] text-white/60 mx-auto">
          Choose a plan that fits your metabolic goals. Scale up or down as you go.
        </p>
      </div>

      {/* Flexibility Module */}
      <div className="card my-6 border border-white/5" style={{ background: "var(--tnm-surface-ink-2)" }}>
        <ul className="flex flex-col gap-2.5">
          {FLEXIBILITY_ITEMS.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-xs text-white/80 leading-snug">
              <span className="shrink-0 w-4 h-4 rounded-full bg-[var(--tnm-action)]/10 flex items-center justify-center mt-0.5">
                <Check className="w-2.5 h-2.5 text-[var(--tnm-action)]" weight="bold" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4">
        {PRICING_PRESETS.map((preset) => (
          <PricingCard key={preset.id} preset={preset} />
        ))}
      </div>
    </section>
  );
}

function PricingCard({ preset }: { preset: PricingPreset }) {
  const { data: quote, isLoading } = useQuery({
    queryKey: ["pricing-quote", preset.id, preset.meals, preset.cadence, preset.planType],
    queryFn: () =>
      subscriptionsApi.quote({
        cadence: preset.cadence,
        mealsPerDelivery: preset.meals,
        planType: preset.planType,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const displayPrice = quote ? formatPrice(quote.totalPaise) : null;
  const weeklyEquivalent =
    preset.id === "six-week" && quote
      ? formatPrice(Math.round(quote.totalPaise / 6))
      : null;

  return (
    <div
      className={`card flex flex-col justify-between relative border border-white/5 ${
        preset.badge ? "border-[var(--tnm-action)] border-[1.5px]" : ""
      }`}
      style={{ background: "var(--tnm-surface-ink-2)" }}
    >
      {preset.badge && (
        <span
          className="absolute top-0 right-4 -translate-y-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[var(--tnm-action)] text-black"
        >
          {preset.badge}
        </span>
      )}

      <div>
        <h4 className="text-base font-bold text-white/95">{preset.title}</h4>
        <p className="fine mt-1.5 text-white/60 leading-relaxed">{preset.desc}</p>
      </div>

      <div className="mt-5 border-t border-white/5 pt-4 flex items-center justify-between">
        <div className="flex flex-col">
          {isLoading ? (
            <div className="w-20 h-6 bg-white/5 rounded animate-pulse" />
          ) : (
            <div className="flex flex-col">
              <span className="price text-xl text-[var(--tnm-action)] font-bold leading-none">
                {displayPrice}
                <span className="text-[10px] text-white/55 font-normal ml-1">
                  {preset.priceLabel}
                </span>
              </span>
              {weeklyEquivalent && (
                <span className="text-[10px] text-white/45 mt-1 font-medium">
                  Equivalent to {weeklyEquivalent}/wk
                </span>
              )}
            </div>
          )}
        </div>

        <Link
          to={preset.to}
          className={`btn btn-s text-xs font-bold px-5 ${
            preset.badge ? "btn-p bg-[var(--tnm-action)] text-black" : "btn-blk"
          }`}
          style={{ height: 36 }}
        >
          {preset.ctaText}
        </Link>
      </div>
    </div>
  );
}
