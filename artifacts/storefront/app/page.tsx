import { cookies } from "next/headers";
import { Section00StickyNav } from "@/components/landing/Section00StickyNav";
import { Section01ClinicalHero } from "@/components/landing/Section01ClinicalHero";
import { deriveHeroContent } from "@/lib/heroContent";
import { Section02QualificationChips } from "@/components/landing/Section02QualificationChips";
import { ServiceabilityBar } from "@/components/onboarding/ServiceabilityBar";
import { Section03AgitationPanel } from "@/components/landing/Section03AgitationPanel";
import { Section04ProtocolsGrid } from "@/components/landing/Section04ProtocolsGrid";
import { Section05ProofMacros } from "@/components/landing/Section05ProofMacros";
import { Section06ProofRdPanel } from "@/components/landing/Section06ProofRdPanel";
import { Section07ProofKitchen } from "@/components/landing/Section07ProofKitchen";
import { Section08PricingStrip } from "@/components/landing/Section08PricingStrip";
import { Section09AssessmentSection } from "@/components/landing/Section09AssessmentSection";
import { Section10FaqAccordion } from "@/components/landing/Section10FaqAccordion";
import { Section11StickyBottomBar } from "@/components/landing/Section11StickyBottomBar";
import { Section12Footer } from "@/components/landing/Section12Footer";

/**
 * Consumer Home (§0 to §12 Clinical Reconstruction).
 * Server Component implementing DTR (Dynamic Tailored Referrals) personalization,
 * inspecting tnm_ref cookie to tailor hero copy for clinical RDs, fitness gyms, or default professionals.
 * Assembles all 13 modular sections under strict filecap and token governance.
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const refCookie = cookieStore.get("tnm_ref")?.value;
  const heroData = deriveHeroContent(refCookie);

  return (
    <div className="relative min-h-screen bg-surface text-ink pb-20 sm:pb-24">
      {/* §0: Sticky Navigation Bar with Assessment CTA */}
      <Section00StickyNav />

      <main className="flex flex-col gap-12 sm:gap-16 lg:gap-20">
        {/* §1: Clinical Hero with Pressure Valve to Desk Fuel */}
        <Section01ClinicalHero hero={heroData} />

        {/* §2: Qualification Chips Strip */}
        {/* OB-2's front-door serviceability check. The M3 layout supersedes the
          L-2 homepage this was mounted on, and none of the §0–§12 sections
          carry it — without this line the merge would silently drop the
          feature. Advisory only: it never blocks browsing. */}
      <div className="mx-auto max-w-5xl px-4">
        <ServiceabilityBar placement="hero" />
      </div>
      <Section02QualificationChips />

        {/* §3: "The 'Healthy' Bowl Problem" Dark Agitation Panel */}
        <Section03AgitationPanel />

        {/* §4: Protocols Tier Grid (Wellness, Performance, Clinical + Spec/Flip/Waitlist) */}
        <Section04ProtocolsGrid />

        {/* §5 to §7: Triple Verification Proofs (Macros, RD Panel, Kitchen Credentials) */}
        <div id="proofs" className="flex flex-col gap-12 sm:gap-16">
          <Section05ProofMacros />
          <Section06ProofRdPanel />
          <Section07ProofKitchen />
        </div>

        {/* §8: Pricing Transparency Strip */}
        <Section08PricingStrip />

        {/* §9: Interactive Assessment Stepper Banner & Modal Root */}
        <Section09AssessmentSection />

        {/* §10: FAQ Accordion with Mandatory Medical Treatment Disclaimer */}
        <Section10FaqAccordion />
      </main>

      {/* §11: Sticky Bottom Conversion Bar */}
      <Section11StickyBottomBar />

      {/* §12: Footer */}
      <Section12Footer />
    </div>
  );
}
