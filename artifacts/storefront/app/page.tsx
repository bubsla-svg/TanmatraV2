import { cookies } from "next/headers";
// Stitch dark scope — route-scoped theme for the total-redesign programme.
// Flips every token in this subtree via color-scheme + pinned Stitch values;
// see lib/themes/stitch.css and docs/stitch/DESIGN.md.
import "@/lib/themes/stitch.css";
import { Section01ClinicalHero } from "@/components/landing/Section01ClinicalHero";
import { deriveHeroContent } from "@/lib/heroContent";
import { Section02QualificationChips } from "@/components/landing/Section02QualificationChips";
import { ServiceabilityBar } from "@/components/onboarding/ServiceabilityBar";
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
    <div data-stitch="dark" className="relative min-h-screen bg-[var(--bg)] text-ink pb-20 sm:pb-24">
      <main className="flex flex-col gap-10 sm:gap-16 lg:gap-20">
        {/* Pillar 1 Hero: Food-First D2C Hook with Hero Meal Photo & Dual CTAs */}
        <Section01ClinicalHero hero={heroData} />

        {/* Front-door Serviceability Check (Hidden on mobile to eliminate header redundancy) */}
        <div className="hidden sm:block mx-auto max-w-5xl px-4">
          <ServiceabilityBar placement="hero" />
        </div>
        <Section02QualificationChips />

        {/* D2C Food Tech Core 1: Choose Your Therapeutic Protocol */}
        <Section04ProtocolsGrid />

        {/* D2C Food Tech Core 2: Dietitian-Approved Marketplace Pantry */}
        <Section04bMarketplace />

        {/* Interactive 60-Second Metabolic Assessment Stepper */}
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

        {/* FAQ Accordion */}
        <Section10FaqAccordion />
      </main>
    </div>
  );
}
