import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { subscriptionsApi } from "@/lib/subscriptionsApi";
import { formatPriceRounded } from "@/lib/api/adapter";
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
    desc: "Weekday lunches (Mon–Fri). Pause, skip, or swap up to 24h before delivery. Delivery included, renews weekly.",
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
    desc: "A six-week reset. 30 lunches, dietitian advisory, commitment discount.",
    meals: 30,
    cadence: "monthly",
    planType: "standard",
    ctaText: "Start Program",
    to: "/subscribe?plan=healthy-everyday-plan&cadence=monthly",
    priceLabel: "total commitment",
  },
];

// Phase A2 — a plan costs more per meal than an à la carte bowl, so the cards
// must make the *added value* explicit or the gap reads as pure markup. Every
// item here is a subscription-only attribute — none of it is available when you
// order a single dish à la carte. (Copy freeze §6: only claims we enforce today.)
const SUBSCRIPTION_ONLY_ITEMS = [
  "A registered dietitian plans your whole week — a rotating, goal-based menu, not a single dish you pick",
  "Portions macro-targeted to your goal (protein / calories) — not one-size à la carte bowls",
  "Delivered on a schedule you set — pause, skip, or swap any day online",
];

export default function HomePricing() {
  return (
    <section className="padx mt-12 mb-12">
      <div className="secrow px-0 text-center flex-col items-center gap-1.5">
        <span className="text-2xl font-semibold tracking-tight text-white">Simple, flexible pricing</span>
        <p className="fine max-w-[340px] text-white/60 mx-auto">
          Choose a plan that fits your goals. Scale up or down as you go.
        </p>
      </div>

      {/* What a plan adds over à la carte */}
      <div className="my-6 p-5 rounded-3xl bg-neutral-900/80 border border-white/[0.06] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <span className="block text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-3">
          What a plan adds over à la carte
        </span>
        <ul className="flex flex-col gap-2.5">
          {SUBSCRIPTION_ONLY_ITEMS.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-xs text-white/80 leading-snug">
              <span className="shrink-0 w-4 h-4 rounded-full bg-amber-400/10 flex items-center justify-center mt-0.5">
                <Check className="w-2.5 h-2.5 text-amber-400" weight="bold" />
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

  const displayPrice = quote ? formatPriceRounded(quote.totalPaise) : null;
  const weeklyEquivalent =
    preset.id === "six-week" && quote
      ? formatPriceRounded(quote.totalPaise / 6)
      : null;

  return (
    <div
      className={`p-5 rounded-2xl relative border flex flex-col justify-between transition-all duration-300 ${
        preset.badge
          ? "border-amber-400/40 bg-amber-400/[0.03] shadow-[0_8px_32px_rgba(251,191,36,0.1)]"
          : "border-white/[0.06] bg-neutral-900/80 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
      }`}
    >
      {preset.badge && (
        <span
          className="absolute top-0 right-4 -translate-y-1/2 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-400 text-black shadow-[0_2px_8px_rgba(251,191,36,0.3)]"
        >
          {preset.badge}
        </span>
      )}

      <div>
        <h4 className="text-base font-semibold tracking-tight text-white/95">{preset.title}</h4>
        <p className="text-xs mt-1.5 text-white/60 leading-relaxed">{preset.desc}</p>
      </div>

      <div className="mt-5 border-t border-white/[0.06] pt-4 flex items-center justify-between">
        <div className="flex flex-col">
          {isLoading ? (
            <div className="w-20 h-6 bg-white/5 rounded-lg animate-pulse" />
          ) : (
            <div className="flex flex-col">
              <span className="price text-xl text-amber-400 font-extrabold tracking-tight leading-none">
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
          className={`min-h-[38px] px-5 rounded-xl text-xs font-semibold flex items-center justify-center active:scale-[0.98] transition-transform duration-200 ${
            preset.badge
              ? "bg-amber-400 text-black font-bold hover:brightness-110 shadow-[0_4px_16px_rgba(251,191,36,0.2)]"
              : "bg-white/10 hover:bg-white/15 border border-white/[0.06] text-white"
          }`}
        >
          {preset.ctaText}
        </Link>
      </div>
    </div>
  );
}
