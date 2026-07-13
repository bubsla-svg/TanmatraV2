import { SealCheck, ShieldCheck, ArrowRight } from "@phosphor-icons/react";
import { DISHES } from "@/lib/menuData";
import { formatPriceRounded } from "@/lib/api/adapter";

// Starting price is derived from the live catalog (never a hardcoded literal —
// keeps the price-lint gate green and the anchor honest).
const FROM_PRICE = formatPriceRounded(
  Math.min(...DISHES.filter((d) => d.isAvailable && d.price > 0).map((d) => d.price)),
);

interface HomeHeroProps {
  onSeeMenu: () => void;
  onHelpChoose: () => void;
}

export default function HomeHero({ onSeeMenu, onHelpChoose }: HomeHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[var(--tnm-surface-ink)] pt-20 pb-10 px-4 md:px-6">
      {/* Background visual - decorative gradient & image */}
      <div className="absolute inset-0 z-0 opacity-40">
        <picture>
          <source srcSet="/hero-bg.webp" type="image/webp" />
          <img
            src="/hero-bg.jpg"
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--tnm-surface-ink)]/60 via-[var(--tnm-surface-ink)]/90 to-[var(--tnm-surface-ink)]" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center text-center mt-4">
        {/* Plain headline — no clinical jargon */}
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
          Dietitian-designed meals, delivered fresh in Noida, Delhi &amp; Gurgaon
        </h2>
        {/* Price / time / transparency in the first three seconds */}
        <p className="text-sm md:text-base text-white/75 mt-3 max-w-md leading-relaxed">
          From {FROM_PRICE} · 25–40 min · Calories, protein and allergens listed on every dish.
        </p>

        {/* One primary CTA + one optional text link */}
        <div className="flex flex-col items-center gap-3 mt-7 w-full sm:w-auto">
          <button
            onClick={onSeeMenu}
            className="btn btn-p btn-lg w-full sm:w-auto"
            style={{ background: "var(--tnm-action)", color: "black", minHeight: 52 }}
          >
            See the menu <ArrowRight className="w-4 h-4 ml-1" weight="bold" />
          </button>

          <button
            onClick={onHelpChoose}
            className="text-sm text-white/70 hover:text-white underline underline-offset-4 decoration-white/30"
            style={{ minHeight: 44 }}
          >
            Not sure what to eat? <span className="text-[var(--tnm-action)] font-semibold">Help me choose</span>
          </button>
        </div>

        {/* Trust Row — non-interactive */}
        <div className="flex items-center justify-center gap-6 mt-9 w-full border-t border-white/5 pt-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--tnm-sage)]" weight="fill" />
            <span className="text-xs text-white/60 font-medium">ISO 22000 kitchen · FSSAI licensed</span>
          </div>
          <div className="flex items-center gap-2">
            <SealCheck className="w-5 h-5 text-[var(--tnm-sage)]" weight="fill" />
            <span className="text-xs text-white/60 font-medium">Dietitian designed</span>
          </div>
        </div>
      </div>
    </section>
  );
}
