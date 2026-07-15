import {
  ArrowRight,
  Leaf,
  CookingPot,
  Truck,
  ShieldCheck,
  Scales,
  Barbell,
  Plant,
  Heart,
  type Icon,
} from "@phosphor-icons/react";

interface HomeHeroProps {
  onSeeMenu: () => void;
  onHelpChoose: () => void;
}

const PROGRAM_CHIPS: { icon: Icon; label: string; planSlug: string }[] = [
  { icon: Scales, label: "Weight Loss", planSlug: "weight-loss-jumpstart" },
  { icon: Barbell, label: "Muscle Gain", planSlug: "lean-muscle-builder" },
  { icon: Plant, label: "Keto", planSlug: "keto-reset" },
  { icon: Heart, label: "PCOS", planSlug: "pcos-balance" },
];

const TRUST_GRID: { icon: Icon; label: string }[] = [
  { icon: Leaf, label: "Dietitian Designed" },
  { icon: CookingPot, label: "Freshly Prepared" },
  { icon: Truck, label: "Delivered Fresh" },
  { icon: ShieldCheck, label: "Safe & Hygienic" },
];

export default function HomeHero({ onSeeMenu, onHelpChoose }: HomeHeroProps) {
  return (
    <section className="w-full bg-[var(--tnm-surface-ink)] pt-16 pb-4 px-4 md:px-6">
      <div className="mx-auto max-w-[480px] md:max-w-[768px]">
        {/* Core Hero Card Container matching highlighted layout */}
        <div className="rounded-2xl border border-white/10 bg-[var(--tnm-surface-ink-2)] overflow-hidden shadow-2xl">
          {/* Top Hero Banner with Circular Dish Visual */}
          <div className="relative p-6 pt-8 pb-6 text-center flex flex-col items-center bg-gradient-to-b from-[var(--tnm-surface-ink)] to-[var(--tnm-surface-ink-2)]">
            {/* Top Curved Dish Imagery */}
            <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden border-2 border-[var(--tnm-action)]/30 shadow-xl mb-5 ring-4 ring-black/40">
              <img
                src="/hero-food.jpg"
                alt="Dietitian designed therapeutic meal bowl"
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>

            {/* Headline & Sub-headline */}
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Healthy meals,
              <br />
              <span className="text-[var(--tnm-action)]">made for you.</span>
            </h1>

            <p className="mt-2.5 text-xs md:text-sm text-white/70 leading-relaxed max-w-[320px]">
              Freshly prepared meals crafted by dietitians, delivered to your doorstep in Noida &amp; surrounding areas.
            </p>

            {/* Primary CTAs */}
            <div className="mt-5 w-full max-w-[320px] flex flex-col gap-3">
              <button
                type="button"
                onClick={onSeeMenu}
                className="w-full h-12 rounded-full font-bold text-sm tracking-wide bg-[var(--tnm-action)] text-black hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                Browse Menu
                <ArrowRight className="w-4 h-4" weight="bold" />
              </button>
              <button
                type="button"
                onClick={onHelpChoose}
                className="w-full h-12 rounded-full font-bold text-sm tracking-wide border border-white/20 text-white hover:bg-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Help me choose
              </button>
            </div>
          </div>

          {/* Programs Section */}
          <div className="p-4 border-t border-white/5 bg-black/20">
            <span className="text-xs font-bold text-white/80 uppercase tracking-wider block mb-3 px-1">
              Programs
            </span>

            <div className="grid grid-cols-4 gap-2">
              {PROGRAM_CHIPS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={onHelpChoose}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-white/10 bg-white/5 hover:border-[var(--tnm-action)]/50 hover:bg-white/10 transition-all text-center group"
                >
                  <p.icon className="w-5 h-5 text-[var(--tnm-action)] mb-1 group-hover:scale-110 transition-transform" weight="bold" />
                  <span className="text-[10px] font-semibold text-white/80 leading-tight">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2x2 Trust Grid */}
          <div className="p-4 border-t border-white/5 bg-black/40">
            <div className="grid grid-cols-2 gap-2">
              {TRUST_GRID.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-white/5 bg-white/[0.03]"
                >
                  <t.icon className="w-4 h-4 text-[var(--tnm-action)] shrink-0" weight="bold" />
                  <span className="text-xs font-medium text-white/80">
                    {t.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
