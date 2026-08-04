import React from "react";
import { GlobalLayout } from "../components/Layouts";
import { SafeImage } from "../components/SafeImage";
import { PrimaryCTA, SecondaryCTA } from "../components/CTA";
import { ClinicalBadge } from "../components/Badges";

interface HomePageProps {
  onNavigate: (route: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <GlobalLayout activeTab="home" currentRoute="/" onNavigate={onNavigate}>
      {/* Cinematic Center Hero Container (Wide H1, 2-line max rule) */}
      <section className="relative py-12 md:py-24 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          Sole-Operator Clinical Food Platform
        </div>

        {/* H1 Flow Rule: Max 2 lines via max-w-5xl */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-100 leading-tight mb-6">
          Therapeutic Meals Precision-Crafted for Your Clinical Goals
        </h1>

        <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
          Zero aggregators. 100% RD-backed metabolic food plans formulated for glycemic stability, gut resilience, and peak physical recovery.
        </p>

        {/* Dual CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <PrimaryCTA onClick={() => onNavigate("/custom-build")}>
            Build Custom Plan
          </PrimaryCTA>
          <SecondaryCTA onClick={() => onNavigate("/menu")}>
            Explore Menu
          </SecondaryCTA>
        </div>

        {/* Hero Ambient Backdrop Wash */}
        <div className="mt-12 rounded-3xl overflow-hidden shadow-2xl border border-slate-800/80">
          <SafeImage 
            src="https://picsum.photos/seed/tanmatra-hero/1200/600" 
            alt="Tanmatra Culinary Showcase" 
            aspectRatio="21/9" 
          />
        </div>
      </section>

      {/* Gapless Bento Grid Matrix (3-Card Layout) */}
      <section className="py-16">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Therapeutic Architecture</h2>
          <p className="text-xs text-slate-400 mt-1">Designed around your biological footprint</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 grid-auto-flow-dense gap-6">
          {/* Card 1: Metabolic Scoring */}
          <div className="col-span-1 md:col-span-2 bg-slate-900/60 border border-slate-800 p-8 rounded-3xl flex flex-col justify-between hover:border-slate-700 transition-colors">
            <div>
              <ClinicalBadge label="Metabolic Guard" variant="emerald" />
              <h3 className="text-2xl font-extrabold text-slate-100 mt-4 mb-2">
                Glycemic Index & Hard Allergen Lock
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
                Every meal generation, shuffle, and substitution strictly respects your clinical restrictions. Zero accidental cross-contamination.
              </p>
            </div>
            <div className="mt-8 flex gap-2">
              <span className="text-xs px-3 py-1 bg-slate-950 text-slate-300 rounded-xl border border-slate-800 font-medium">Low-GI Verified</span>
              <span className="text-xs px-3 py-1 bg-slate-950 text-slate-300 rounded-xl border border-slate-800 font-medium">Gluten-Free Safe</span>
            </div>
          </div>

          {/* Card 2: RD Advisory */}
          <div className="col-span-1 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-3xl flex flex-col justify-between hover:border-amber-500/30 transition-colors">
            <div>
              <ClinicalBadge label="RD Advisory" variant="gold" />
              <h3 className="text-xl font-bold text-slate-100 mt-4 mb-2">
                RD-Reviewed Lineups
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Personalized by algorithms, reviewed by registered dietitians for micro-nutrient balance.
              </p>
            </div>
            <button 
              onClick={() => onNavigate("/plans")} 
              className="mt-6 text-xs font-bold text-[#D4AF37] hover:underline flex items-center gap-1"
            >
              <span>View Recommended Plans</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </section>
    </GlobalLayout>
  );
};
