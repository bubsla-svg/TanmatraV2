import { cookies } from "next/headers";
import { Section01ClinicalHero } from "@/components/landing/Section01ClinicalHero";
import { deriveHeroContent } from "@/lib/heroContent";
import { Section02QualificationChips } from "@/components/landing/Section02QualificationChips";
import { Section03AgitationPanel } from "@/components/landing/Section03AgitationPanel";
import { Section04bMarketplace } from "@/components/landing/Section04bMarketplace";
import { Section04ProtocolsGrid } from "@/components/landing/Section04ProtocolsGrid";
import { Section03B2BEnterprise } from "@/components/landing/Section03B2BEnterprise";
import { Section04TelehealthTracking } from "@/components/landing/Section04TelehealthTracking";
import { Section05LogisticsMoat } from "@/components/landing/Section05LogisticsMoat";
import { Section05ProofMacros } from "@/components/landing/Section05ProofMacros";
import { Section06ProofRdPanel } from "@/components/landing/Section06ProofRdPanel";
import { Section07ProofKitchen } from "@/components/landing/Section07ProofKitchen";
import { Section09AssessmentSection } from "@/components/landing/Section09AssessmentSection";
import { Section09bRecipesBridge } from "@/components/landing/Section09bRecipesBridge";
import { Section10FaqAccordion } from "@/components/landing/Section10FaqAccordion";
/**
 * Consumer Home — 3-Pillar Revenue Architecture.
 * Server Component implementing DTR (Dynamic Tailored Referrals) personalization,
 * assembling D2C Subscriptions, B2B Corporate Volume, Telehealth & Noida IoT Logistics Moat.
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const refCookie = cookieStore.get("tnm_ref")?.value;
  const heroData = deriveHeroContent(refCookie);

  return (
    <div 
      data-ui-generation="stitch-74" 
      data-screen-id="MOB-10-Home-Dark" 
      className="relative min-h-dvh pb-20 sm:pb-24"
    >
      {/* A <div>, not a <main>: app/layout.tsx already opens `<main id="main">`
          around children, and nesting a second one is invalid HTML — screen
          readers announced two main regions on the entry route and the skip
          link landed on the outer one. */}
      <div className="flex flex-col gap-10 sm:gap-16 lg:gap-20">
        {/* Pillar 1 Hero: Food-First D2C Hook with Hero Meal Photo & Dual CTAs */}
        <Section01ClinicalHero hero={heroData} />

        {/* Horizontal rail: "Curated for today" */}
        <section className="px-gutter">
          <div className="flex justify-between items-end mb-6">
            <h2 className="font-headline-md text-headline-md text-ink-primary">Curated for today</h2>
            <a href="/menu" className="font-label-caps text-label-caps text-primary uppercase tracking-widest hover:opacity-80">View menu</a>
          </div>
          <div className="flex gap-4 overflow-x-auto snap-x no-scrollbar pb-4 -mx-gutter px-gutter">
            {/* We render placeholders for 3 dish cards as per spec to signal horizontal scrolling. In a real dynamic feed, these would be fetched from getToday() or getRecipes() */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-none w-[280px] snap-start">
                <div className="group flex flex-col rounded-2xl border border-line bg-surface p-3 transition-transform active:scale-[0.98]">
                  <div className="relative h-[210px] w-full shrink-0 overflow-hidden rounded-xl border border-line bg-surface-raised mb-4">
                    <div className="absolute top-2 left-2 flex gap-1 z-10">
                      <span className="px-2 py-1 rounded-full bg-sage-soft/90 backdrop-blur-md border border-sage-strong/20 font-label-caps text-[9px] text-sage-text uppercase tracking-widest">High Protein</span>
                    </div>
                    {/* Placeholder image that respects the 4:3 image rule from the spec */}
                    <div className="w-full h-full bg-surface-container-high animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="font-bold text-body-lg text-ink-primary truncate">Grilled Salmon Bowl {i}</h3>
                    <span className="font-mono text-[11px] text-ink-muted">450 kcal · 32g P</span>
                    <div className="flex justify-between items-center mt-3">
                      <span className="font-clinical-data text-ink-primary">₹499</span>
                      <button className="px-4 py-1.5 rounded-full border border-line bg-surface-raised font-label-caps text-[10px] text-ink-primary hover:bg-line transition-colors">ADD</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Horizontal need-state rail */}
        <section className="px-gutter py-8">
          <div className="flex gap-3 overflow-x-auto snap-x no-scrollbar -mx-gutter px-gutter">
            {['Fat loss', 'Glucose steady', 'PCOS support', 'High protein'].map((need) => (
              <button key={need} className="flex-none px-6 py-3 rounded-full border border-line bg-surface-container hover:border-primary/50 hover:bg-surface-raised transition-all snap-start">
                <span className="font-clinical-data text-ink-primary tracking-wide">{need}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Horizontal section: "Built for longer goals" */}
        <section className="px-gutter py-6">
          <h2 className="font-headline-md text-headline-md text-ink-primary mb-6">Built for longer goals</h2>
          <div className="flex gap-4 overflow-x-auto snap-x no-scrollbar pb-4 -mx-gutter px-gutter">
            {['Metabolic Reset', 'Performance Protocol'].map((plan, i) => (
              <div key={i} className="flex-none w-[300px] snap-start rounded-3xl border border-line bg-surface p-6">
                <div className="font-label-caps text-label-caps text-primary mb-2">SUBSCRIPTION</div>
                <h3 className="font-headline-md text-ink-primary mb-2">{plan}</h3>
                <p className="text-ink-secondary text-sm mb-6">4-week targeted clinical intervention with daily deliveries.</p>
                <a href="/plans" className="inline-block w-full text-center px-4 py-3 rounded-full border border-line font-label-caps text-label-caps text-ink-primary hover:bg-surface-raised transition-colors">Explore Plan</a>
              </div>
            ))}
          </div>
        </section>

        {/* Compact AI recommendation card */}
        <section className="px-gutter pb-8">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex gap-3 items-center mb-4">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
              <span className="font-label-caps text-label-caps text-primary uppercase tracking-widest">Smart Match</span>
            </div>
            <h3 className="font-headline-md text-ink-primary mb-2">Optimize your Afternoon</h3>
            <p className="text-ink-secondary text-sm mb-6">Based on your goals, adding the Matcha Focus protocol will stabilize your 3PM glucose dip.</p>
            <button className="px-6 py-2.5 rounded-full bg-primary text-ink-on-gold font-label-caps text-label-caps hover:opacity-90 active:scale-[0.98] transition-all">Add to Today</button>
          </div>
        </section>
      </div>
    </div>
  );
}
