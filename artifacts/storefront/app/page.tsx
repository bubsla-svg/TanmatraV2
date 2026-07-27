import { cookies } from "next/headers";
import { Section01ClinicalHero } from "@/components/landing/Section01ClinicalHero";
import { deriveHeroContent } from "@/lib/heroContent";
import { Section02QualificationChips } from "@/components/landing/Section02QualificationChips";
import { ServiceabilityBar } from "@/components/onboarding/ServiceabilityBar";
import { Section03AgitationPanel } from "@/components/landing/Section03AgitationPanel";
import { Section04ProtocolsGrid } from "@/components/landing/Section04ProtocolsGrid";
import { Section03B2BEnterprise } from "@/components/landing/Section03B2BEnterprise";
import { Section04TelehealthTracking } from "@/components/landing/Section04TelehealthTracking";
import { Section05LogisticsMoat } from "@/components/landing/Section05LogisticsMoat";
import { Section05ProofMacros } from "@/components/landing/Section05ProofMacros";
import { Section06ProofRdPanel } from "@/components/landing/Section06ProofRdPanel";
import { Section07ProofKitchen } from "@/components/landing/Section07ProofKitchen";
import { Section09AssessmentSection } from "@/components/landing/Section09AssessmentSection";
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
    <div className="relative min-h-screen bg-surface text-ink pb-20 sm:pb-24">

      <main className="flex flex-col gap-12 sm:gap-16 lg:gap-20">
        {/* Pillar 1 Hero: Clinical Authority Hook with Dual CTAs & Trust Bar */}
        <Section01ClinicalHero hero={heroData} />

        {/* Front-door Serviceability Check */}
        <div className="mx-auto max-w-5xl px-4">
          <ServiceabilityBar placement="hero" />
        </div>
        <Section02QualificationChips />

        {/* Pillar 1: D2C Therapeutic Subscriptions (Section 2 - Choose Your Protocol) */}
        <Section04ProtocolsGrid />

        {/* Pillar 2: B2B Corporate Wellness Integration (Section 3 - Corporate Volume) */}
        <Section03B2BEnterprise />

        {/* Pillar 3: Telehealth & Clinical Tracking (Section 4 - Consultations & Tech) */}
        <Section04TelehealthTracking />

        {/* Section 5: The "Noida-Proof" IoT Cold-Chain Logistics Moat */}
        <Section05LogisticsMoat />

        {/* Agitation Panel & Triple Verification Proofs */}
        <Section03AgitationPanel />
        <div id="proofs" className="flex flex-col gap-12 sm:gap-16">
          <Section05ProofMacros />
          <Section06ProofRdPanel />
          <Section07ProofKitchen />
        </div>

        {/* Interactive 60-Second Metabolic Assessment Stepper Banner & Modal */}
        <Section09AssessmentSection />

        {/* FAQ Accordion with Mandatory Medical Disclaimer */}
        <Section10FaqAccordion />
      </main>
    </div>
  );
}
