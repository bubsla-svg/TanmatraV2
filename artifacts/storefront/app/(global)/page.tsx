import { cookies } from "next/headers";
import { Sparkles } from "lucide-react";
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
import { pickPlanPhotos } from "@/lib/planPhotos";
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
  // Real photography for the plan cards, off the catalog we just loaded — the
  // grid is a client component and cannot read it itself. Order matters: each
  // plan claims its dish before the next one picks, so no two cards repeat.
  const planPhotos = pickPlanPhotos(["desk_fuel", "steady", "protein_build"], dishes);

  return (
    <div
      data-ui-generation="stitch-74"
      data-screen-id="5.1"
      data-screen-state="default"
      className="overflow-x-hidden w-full max-w-full relative min-h-dvh pb-20 sm:pb-24"
    >
      {/* A <div>, not a <main>: app/(global)/layout.tsx already opens
          `<main id="main">` around children, and nesting a second one is
          invalid HTML — screen readers announced two main regions on the entry
          route and the skip link landed on the outer one.
          (That sentence used to read "A <main>, not a <main>", because the
          blind div→main replace that put 14 spurious landmarks in this file
          rewrote the very comment warning against them.) */}
      <div className="flex flex-col gap-10 sm:gap-16 lg:gap-20">
        {/* Pillar 1 Hero: Food-First D2C Hook with Hero Meal Photo & Dual CTAs */}
        <Section01ClinicalHero hero={heroData} />

        <section className="px-gutter">
          <div className="flex justify-between items-end mb-6">
            <h2 className="font-bold text-3xl text-ink">Curated for today</h2>
            <a href="/menu" className="font-bold text-xs text-primary uppercase tracking-widest hover:opacity-80">View menu</a>
          </div>
          {/* A real list, so a screen reader announces "5 items" before the
              rail instead of reading five unlabelled groups in a row. */}
          <ul className="flex gap-4 overflow-x-auto snap-x no-scrollbar pb-4 -mx-gutter px-gutter">
            {featuredDishes.map((dish) => (
              <li key={dish.id} className="flex-none w-[280px] snap-start">
                <DishCard dish={dish} compact />
              </li>
            ))}
          </ul>
        </section>

        {/* Horizontal need-state rail */}
        <section className="px-gutter py-8">
          <ul className="flex gap-3 overflow-x-auto snap-x no-scrollbar -mx-gutter px-gutter">
            {['Fat loss', 'Glucose steady', 'PCOS support', 'High protein'].map((need) => (
              <li key={need} className="flex-none snap-start">
                <button className="px-6 py-3 rounded-full border border-line bg-surface hover:border-primary/50 hover:bg-surface-raised transition-all">
                  <span className="font-clinical-data text-ink tracking-wide">{need}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Horizontal section: "Built for longer goals" */}
        <section className="px-gutter py-6">
          <h2 className="font-bold text-3xl text-ink mb-6">Built for longer goals</h2>
          <ul className="flex gap-4 overflow-x-auto snap-x no-scrollbar pb-4 -mx-gutter px-gutter">
            {['Metabolic Reset', 'Performance Protocol'].map((plan, i) => (
              <li key={i} className="flex-none w-[300px] snap-start rounded-3xl border border-line bg-surface p-6">
                <div className="font-bold text-xs text-primary mb-2">SUBSCRIPTION</div>
                <h3 className="text-lg font-bold text-ink mb-2">{plan}</h3>
                <p className="text-ink-muted text-sm mb-6">4-week targeted clinical intervention with daily deliveries.</p>
                <a href="/plans" className="inline-block w-full text-center px-4 py-3 rounded-full border border-line font-bold text-xs text-ink hover:bg-surface-raised transition-colors">Explore Plan</a>
              </li>
            ))}
          </ul>
        </section>

        {/* No ServiceabilityBar here. The Header's is the only instance allowed
            to exist — its verdict/pincode is per-instance state read from
            localStorage once at mount with no `storage` listener, so a second
            copy desynced permanently from sm up: check a pincode in one and
            the other kept saying "Select your location" all session. */}
        <Section02QualificationChips />

        <Section04ProtocolsGrid photos={planPhotos} />

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
            <div aria-hidden className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <div className="flex gap-3 items-center mb-4">
              {/* Was a `material-symbols-outlined` ligature span for a font
                  this app never loads, so it shipped the literal string
                  "auto_awesome" to every visitor on the entry route. */}
              <Sparkles aria-hidden className="h-5 w-5 text-primary" />
              <span className="font-bold text-xs text-primary uppercase tracking-widest">Smart Match</span>
            </div>
            <h3 className="text-lg font-bold text-ink mb-2">Optimize your Afternoon</h3>
            <p className="text-ink-muted text-sm mb-6">Based on your goals, adding the Matcha Focus protocol will stabilize your 3PM glucose dip.</p>
            <button className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 active:scale-[0.98] transition-all">Add to Today</button>
          </div>
        </section>

        {/* FAQ Accordion */}
        <Section10FaqAccordion />
      </div>
    </div>
  );
}
