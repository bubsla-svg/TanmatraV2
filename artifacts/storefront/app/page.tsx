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
import { fetchMenu } from "@/lib/catalog";
import { formatPaise } from "@/lib/format";
import { SafeImage } from "@/components/primitives/SafeImage";
import { DishCard } from "@/components/DishCard";
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
  
  const { dishes } = await fetchMenu();
  const featuredDishes = dishes.slice(0, 5);

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

        <section className="px-gutter">
          <div className="flex justify-between items-end mb-6">
            <h2 className="font-headline-md text-headline-md text-ink-primary">Curated for today</h2>
            <a href="/menu" className="font-label-caps text-label-caps text-primary uppercase tracking-widest hover:opacity-80">View menu</a>
          </div>
          <div className="flex gap-4 overflow-x-auto snap-x no-scrollbar pb-4 -mx-gutter px-gutter">
            {featuredDishes.map((dish) => (
              <div key={dish.id} className="flex-none w-[280px] snap-start">
                <DishCard dish={dish} compact />
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

        {/* No ServiceabilityBar here. The Header's is the only instance allowed
            to exist — its verdict/pincode is per-instance state read from
            localStorage once at mount with no `storage` listener, so a second
            copy desynced permanently from sm up: check a pincode in one and
            the other kept saying "Select your location" all session. */}
        <Section02QualificationChips />

        <Section04ProtocolsGrid />

        <Section04bMarketplace />

        {/* Pillar 9: On-page assessment stepper — main door for the hero's
            "60-second assessment" CTA, which only dispatches
            open_tanmatra_assessment and relies on this mounting to listen. */}
        <Section09AssessmentSection />

        {/* Recipes Bridge: DIY vs Done-for-You */}
        <Section09bRecipesBridge />

        {/* Proofs: Macros, RD Panel & Certified Kitchen */}
        <div id="proofs" className="flex flex-col gap-10 sm:gap-16">
          <Section05ProofMacros />
          <Section06ProofRdPanel />
          <Section07ProofKitchen />
        </div>

        {/* Supporting Pillars: B2B Enterprise & Telehealth */}
        <Section03B2BEnterprise />
        <Section04TelehealthTracking />
        <Section05LogisticsMoat />
        <Section03AgitationPanel />

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

        {/* FAQ Accordion */}
        <Section10FaqAccordion />
      </div>
    </div>
  );
}
