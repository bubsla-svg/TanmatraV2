import { useNavigate } from "react-router";
import {
  ArrowRight,
  Leaf,
  CookingPot,
  Truck,
  ShieldCheck,
  Scales,
  Barbell,
  Drop,
  Heart,
  Sparkle,
  type Icon,
} from "@phosphor-icons/react";

interface HomeHeroProps {
  onSeeMenu: () => void;
  onHelpChoose: () => void;
}

// Slugs must match a real plan in lib/rdPlans.ts — no fabricated programs.
// ("Keto Reset" was dropped; no keto plan exists in the catalog.)
const PROGRAM_CHIPS: { icon: Icon; label: string; planSlug: string }[] = [
  { icon: Scales, label: "Weight Loss", planSlug: "weight-loss-jumpstart" },
  { icon: Barbell, label: "Muscle Gain", planSlug: "lean-muscle-builder" },
  { icon: Drop, label: "Diabetic Friendly", planSlug: "diabetic-friendly" },
  { icon: Heart, label: "PCOS Care", planSlug: "pcos-balance" },
];

const TRUST_GRID: { icon: Icon; label: string }[] = [
  { icon: Leaf, label: "Dietitian Designed" },
  { icon: CookingPot, label: "Freshly Prepared" },
  { icon: Truck, label: "Delivered Fresh" },
  { icon: ShieldCheck, label: "Safe & Hygienic" },
];

export default function HomeHero({ onSeeMenu, onHelpChoose }: HomeHeroProps) {
  const navigate = useNavigate();
  return (
    <section className="w-full bg-[var(--tnm-surface-ink)] pt-32 pb-20 md:pt-36 md:pb-28 px-4 md:px-6 relative overflow-hidden">
      {/* Ambient food-imagery wash — rich but low-contrast so copy stays legible */}
      <img
        src="/hero-food.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover opacity-[0.07] blur-2xl scale-110 pointer-events-none select-none"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--tnm-surface-ink)]/40 via-transparent to-[var(--tnm-surface-ink)] pointer-events-none" />
      {/* Single warm amber glow (no AI-purple mesh) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[var(--tnm-action)]/12 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-[540px] md:max-w-[820px] relative z-10">
        {/* Double-Bezel (Doppelrand) Outer Shell Container */}
        <div className="p-2 rounded-[2.5rem] bg-white/[0.04] border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
          {/* Inner Core Enclosure */}
          <div className="rounded-[calc(2.5rem-0.5rem)] border border-white/10 bg-gradient-to-b from-[var(--tnm-surface-ink)] via-[var(--tnm-surface-ink-2)] to-black/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] overflow-hidden">
            {/* Top Hero Content */}
            <div className="p-8 md:p-12 text-center flex flex-col items-center">
              {/* Eyebrow Badge Tag */}
              <div className="mb-6 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--tnm-action)] flex items-center gap-1.5 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                <Sparkle size={12} weight="fill" className="text-[var(--tnm-action)] shrink-0" />
                <span>Clinical Nutrition Engine</span>
              </div>

              {/* Top Curved Dish Imagery with Nested Ring Bezel */}
              <div className="relative p-1.5 rounded-full bg-white/5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] mb-8 group">
                <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden border border-white/20 ring-4 ring-black/40">
                  <img
                    src="/hero-food.jpg"
                    alt="Dietitian designed therapeutic meal bowl"
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                    loading="eager"
                  />
                </div>
              </div>

              {/* Headline & Sub-headline */}
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.1] max-w-xl">
                Healthy meals,
                <br />
                <span className="bg-gradient-to-r from-[var(--tnm-action)] via-amber-200 to-[var(--tnm-action)] bg-clip-text text-transparent">
                  engineered for you.
                </span>
              </h1>

              <p className="mt-4 text-sm md:text-base text-white/70 leading-relaxed max-w-md font-normal">
                Precision-balanced clinical meals designed by dietitians, cooked fresh daily, and delivered direct to your door.
              </p>

              {/* Primary CTAs with Button-in-Button Trailing Icon Architecture */}
              <div className="mt-8 w-full max-w-md flex flex-col sm:flex-row gap-3.5">
                <button
                  type="button"
                  onClick={onSeeMenu}
                  className="group relative flex-1 min-h-[52px] px-6 py-3.5 rounded-full font-bold text-sm tracking-wide bg-[var(--tnm-action)] text-black hover:brightness-110 active:scale-[0.98] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex items-center justify-between shadow-[0_8px_24px_rgba(251,191,36,0.2)]"
                >
                  <span className="pl-2">Browse Menu</span>
                  <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center group-hover:translate-x-1 group-hover:-translate-y-[1px] transition-transform duration-300">
                    <ArrowRight className="w-4 h-4 text-black" weight="bold" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onHelpChoose}
                  className="flex-1 min-h-[52px] px-6 py-3.5 rounded-full font-semibold text-sm tracking-wide border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:border-white/25 active:scale-[0.98] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex items-center justify-center"
                >
                  Help Me Choose
                </button>
              </div>
            </div>

            {/* Programs Section */}
            <div className="p-6 md:p-8 border-t border-white/5 bg-black/30 backdrop-blur-xl">
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.2em] block mb-4">
                Clinical Health Programs
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PROGRAM_CHIPS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => navigate(`/plans/${p.planSlug}`)}
                    className="p-1 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-[var(--tnm-action)]/30 hover:bg-white/[0.08] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group text-left"
                  >
                    <div className="p-3 rounded-[calc(1rem-0.25rem)] bg-black/20 flex flex-col items-center justify-center text-center">
                      <p.icon className="w-6 h-6 text-[var(--tnm-action)] mb-2 group-hover:scale-110 transition-transform duration-300" weight="bold" />
                      <span className="text-xs font-semibold text-white/90 leading-tight">
                        {p.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2x2 Trust Grid */}
            <div className="p-6 md:p-8 border-t border-white/5 bg-black/50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TRUST_GRID.map((t) => (
                  <div
                    key={t.label}
                    className="p-1 rounded-xl bg-white/[0.02] border border-white/5 flex items-center"
                  >
                    <div className="w-full p-2.5 rounded-[calc(0.75rem-0.25rem)] bg-white/[0.02] flex items-center gap-2.5">
                      <t.icon className="w-4 h-4 text-[var(--tnm-action)] shrink-0" weight="bold" />
                      <span className="text-xs font-medium text-white/80 leading-tight">
                        {t.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
