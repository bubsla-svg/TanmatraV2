import { Sparkle, SealCheck, ShieldCheck, ArrowRight } from "@phosphor-icons/react";

interface HomeHeroProps {
  onStartAssessment: () => void;
  onExploreMeals: () => void;
}

export default function HomeHero({ onStartAssessment, onExploreMeals }: HomeHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[var(--tnm-surface-ink)] pt-20 pb-12 px-4 md:px-6">
      {/* Background visual - decorative gradient & image */}
      <div className="absolute inset-0 z-0 opacity-40">
        <picture>
          <source srcSet="/hero-bg.webp" type="image/webp" />
          <img
            src="/hero-bg.jpg"
            alt="Clinical meals selection background"
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--tnm-surface-ink)]/60 via-[var(--tnm-surface-ink)]/90 to-[var(--tnm-surface-ink)]" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center text-center mt-6">
        {/* Floating chips container */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <div className="bg-[var(--tnm-surface-ink-2)] border border-white/5 rounded-full px-3.5 py-1.5 flex items-center gap-1.5 shadow-md">
            <span className="tnm-data text-xs font-semibold text-[var(--tnm-action)]">32g</span>
            <span className="text-[11px] text-white/60 font-medium">Protein</span>
          </div>
          <div className="bg-[var(--tnm-surface-ink-2)] border border-white/5 rounded-full px-3.5 py-1.5 flex items-center gap-1.5 shadow-md">
            <span className="text-xs font-semibold text-[var(--tnm-sage)] uppercase tracking-wider">Low GI</span>
          </div>
          <div className="bg-[var(--tnm-surface-ink-2)] border border-white/5 rounded-full px-3.5 py-1.5 flex items-center gap-1.5 shadow-md">
            <span className="text-xs font-semibold text-white/80">RD Reviewed</span>
          </div>
        </div>

        {/* Clinical Headline and Subhead */}
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
          Therapeutic meals designed by registered dietitians.
        </h2>
        <p className="text-sm md:text-base text-white/70 mt-3 max-w-md leading-relaxed">
          Chef-crafted meals with full macro transparency, personalized to your metabolic health, delivered fresh in Noida, Delhi & Gurgaon.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-8 w-full sm:w-auto">
          <button
            onClick={onStartAssessment}
            className="btn btn-p btn-lg w-full sm:w-auto"
            style={{
              background: "var(--tnm-action)",
              color: "black",
              minHeight: 52,
            }}
          >
            Find My Plan <ArrowRight className="w-4 h-4 ml-1" weight="bold" />
          </button>
          
          <button
            onClick={onExploreMeals}
            className="btn btn-g btn-lg w-full sm:w-auto border border-white/10 text-white hover:bg-white/5"
            style={{ minHeight: 52 }}
          >
            Explore Meals
          </button>
        </div>

        {/* Trust Row */}
        <div className="flex items-center justify-center gap-6 mt-10 w-full border-t border-white/5 pt-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--tnm-sage)]" weight="fill" />
            <span className="text-xs text-white/60 font-medium">ISO 22000:2018 certified kitchen</span>
          </div>
          <div className="flex items-center gap-2">
            <SealCheck className="w-5 h-5 text-[var(--tnm-sage)]" weight="fill" />
            <span className="text-xs text-white/60 font-medium">Pause Anytime</span>
          </div>
        </div>
      </div>
    </section>
  );
}
