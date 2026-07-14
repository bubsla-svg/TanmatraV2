import {
  ArrowRight,
  Leaf,
  CookingPot,
  Truck,
  ShieldCheck,
  Timer,
  CurrencyInr,
  MapPin,
  Prohibit,
  Sparkle,
  ClipboardText,
  SealCheck,
  type Icon,
} from "@phosphor-icons/react";
import { DISHES } from "@/lib/menuData";
import { formatPriceRounded } from "@/lib/api/adapter";

// Starting price is derived from the live catalog (never a hardcoded ₹ literal —
// keeps the price-lint gate green and the anchor honest).
const FROM_PRICE = formatPriceRounded(
  Math.min(...DISHES.filter((d) => d.isAvailable && d.price > 0).map((d) => d.price)),
);

interface HomeHeroProps {
  onSeeMenu: () => void;
  onHelpChoose: () => void;
}

const TRUST: { icon: Icon; label: string }[] = [
  { icon: Leaf, label: "Dietitian\nDesigned" },
  { icon: CookingPot, label: "Freshly\nPrepared" },
  { icon: Truck, label: "Delivered\nFresh" },
  { icon: ShieldCheck, label: "Safe &\nHygienic" },
];

const STATS: { icon: Icon; big: string; small: string }[] = [
  { icon: Timer, big: "25–40 mins", small: "Delivery Time" },
  { icon: CurrencyInr, big: `Meals from ${FROM_PRICE}`, small: "Value for Health" },
  { icon: MapPin, big: "Noida & Nearby", small: "We Deliver to You" },
];

const BAR: { icon: Icon; label: string }[] = [
  { icon: Prohibit, label: "No Preservatives" },
  { icon: Sparkle, label: "High Quality Ingredients" },
  { icon: ClipboardText, label: "Nutrition Info for Every Meal" },
  { icon: SealCheck, label: "100% Transparency" },
];

export default function HomeHero({ onSeeMenu, onHelpChoose }: HomeHeroProps) {
  return (
    <section className="relative w-full overflow-hidden bg-[var(--tnm-surface-ink)] pt-20 md:pt-24">
      <div className="mx-auto max-w-[1160px] px-5 md:px-8 pb-8 md:pb-10">
        <div className="grid md:grid-cols-2 gap-7 md:gap-10 items-center">
          {/* Copy column */}
          <div className="order-2 md:order-1 flex flex-col">
            <h2 className="text-[34px] leading-[1.04] md:text-[52px] md:leading-[1.02] font-extrabold tracking-tight text-white text-balance">
              Healthy meals,
              <br />
              <span className="text-[var(--tnm-action)]">made for you.</span>
            </h2>

            <p className="mt-5 text-[15px] md:text-base leading-relaxed text-white/70 max-w-[42ch]">
              Freshly prepared meals crafted by dietitians, delivered to your doorstep in Noida &amp;
              surrounding areas.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onSeeMenu}
                className="inline-flex items-center gap-2 rounded-full px-7 text-[15px] font-semibold transition-transform active:scale-[0.98] hover:brightness-105"
                style={{ background: "var(--tnm-action)", color: "black", height: 52 }}
              >
                Browse Menu
                <ArrowRight className="w-4 h-4" weight="bold" />
              </button>
              <button
                type="button"
                onClick={onHelpChoose}
                className="inline-flex items-center gap-2 rounded-full px-7 text-[15px] font-semibold text-white border border-white/15 hover:border-[var(--tnm-sage)] hover:bg-[var(--tnm-sage)]/10 transition-colors"
                style={{ height: 52 }}
              >
                Help me choose meals
              </button>
            </div>

            {/* Trust markers */}
            <div className="mt-9 grid grid-cols-4 border-t border-white/[0.08] pt-5">
              {TRUST.map((t) => (
                <div
                  key={t.label}
                  className="flex flex-col items-center gap-2 px-1 text-center border-l border-white/[0.08] first:border-l-0"
                >
                  <t.icon className="w-6 h-6 text-[var(--tnm-action)]" weight="regular" />
                  <span className="text-[11px] font-semibold leading-tight text-white/60 whitespace-pre-line">
                    {t.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Stat strip */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 rounded-2xl border border-white/[0.08] bg-[var(--tnm-surface-ink-2)] p-4">
              {STATS.map((s) => (
                <div
                  key={s.small}
                  className="flex items-center gap-3 px-3 py-1.5 border-t sm:border-t-0 sm:border-l border-white/[0.08] first:border-t-0 sm:first:border-l-0"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--tnm-action)]/10 text-[var(--tnm-action)]">
                    <s.icon className="w-[18px] h-[18px]" weight="bold" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[15px] font-bold tracking-tight text-white tabular-nums">
                      {s.big}
                    </span>
                    <span className="text-[11px] text-white/45">{s.small}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Food photo tile */}
          <div className="order-1 md:order-2">
            <div className="relative overflow-hidden rounded-[20px] border border-white/[0.14] shadow-2xl ring-1 ring-inset ring-[var(--tnm-action)]/10">
              <picture>
                <source srcSet="/hero-food.webp" type="image/webp" />
                <img
                  src="/hero-food.jpg"
                  alt="A dietitian-designed meal: grilled paneer with quinoa, roasted vegetables, dal, brown rice and salad"
                  className="w-full h-full object-cover aspect-[5/4] md:aspect-square"
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width trust bar */}
      <div className="border-t border-white/[0.08] bg-white/[0.02]">
        <div className="mx-auto max-w-[1160px] grid grid-cols-2 md:grid-cols-4">
          {BAR.map((b) => (
            <div
              key={b.label}
              className="flex items-center justify-center gap-2 px-3 py-3.5 text-center text-[12px] font-semibold text-white/60 border-l border-white/[0.08] first:border-l-0 [&:nth-child(3)]:border-l-0 md:[&:nth-child(3)]:border-l"
            >
              <b.icon className="w-4 h-4 shrink-0 text-[var(--tnm-sage)]" weight="regular" />
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
