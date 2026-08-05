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

        {/* No ServiceabilityBar here. The Header's is the only instance allowed
            to exist — its verdict/pincode is per-instance state read from
            localStorage once at mount with no `storage` listener, so a second
            copy desynced permanently from sm up: check a pincode in one and
            the other kept saying "Select your location" all session. */}
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
      </div>
    </div>
  );
}
