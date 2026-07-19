import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router";
import { track } from "@/lib/analytics";
const IntakeQuiz = lazy(() => import("@/components/preferences/IntakeQuiz"));

// Modularized Homepage Components
import HomeHeader from "@/components/home/HomeHeader";
import HomeHero from "@/components/home/HomeHero";
import HomeRecommendedPlans from "@/components/home/HomeRecommendedPlans";
import HomeMealsRail from "@/components/home/HomeMealsRail";
import HomeTrustWall from "@/components/home/HomeTrustWall";
import HomePricing from "@/components/home/HomePricing";
import HomeDietitian from "@/components/home/HomeDietitian";
import HomeFAQ from "@/components/home/HomeFAQ";
import HomeFooter from "@/components/home/HomeFooter";
import HomeFeaturedMeal from "@/components/home/HomeFeaturedMeal";
import StickyBottomBar from "@/components/layout/StickyBottomBar";

const HOW_STEPS = [
  {
    icon: "ph-clipboard-text",
    step: "01",
    title: "Dietitians design every dish",
    desc: "Registered dietitians build each recipe around a health goal — steady blood sugar, more protein, lighter meals — not flavour alone.",
  },
  {
    icon: "ph-seal-check",
    step: "02",
    title: "Pick what fits you",
    desc: "Browse the menu, filter by your goal, and see calories, protein and allergens on every dish before you add it.",
  },
  {
    icon: "ph-calendar",
    step: "03",
    title: "Delivered fresh daily",
    desc: "Meals are cooked fresh in an ISO 22000 kitchen and delivered in scheduled windows across Noida.",
  },
];

export default function V2Home() {
  const navigate = useNavigate();
  // The assessment is optional and user-initiated — the single "Help me choose
  // meals" entry point. No unsolicited modal opens on load.
  const [quizOpen, setQuizOpen] = useState(false);

  useEffect(() => {
    track("view_home");
  }, []);

  return (
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white select-none">
      <h1 className="sr-only">
        Tanmatra — Dietitian-designed meal delivery in Noida
      </h1>

      {/* 2.1 Sticky scroll transition Header (no CTA — see §S1) */}
      <HomeHeader />

      {/* 2.2 Full-width hero — lives OUTSIDE the 480px content column so the
          desktop photo-split can breathe; it stacks on mobile. */}
      <HomeHero
        onSeeMenu={() => navigate("/menu")}
        onHelpChoose={() => setQuizOpen(true)}
      />

      <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 88 }}>
        {/* 2.5 Recommended plans rail */}
        <HomeRecommendedPlans />

        {/* 2.6 Dietitian-selected meals rail */}
        <HomeMealsRail />

        {/* 2.6b Featured meal teaser card */}
        <HomeFeaturedMeal />

        {/* 2.7 How It Works */}
        <section className="padx mt-10">
          <div className="secrow px-0">
            <span className="sh text-base font-bold tracking-tight text-white/95">
              How Tanmatra works
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {HOW_STEPS.map((s) => (
              <div
                key={s.step}
                className="p-4 rounded-2xl bg-neutral-900/80 border border-white/[0.06] backdrop-blur-xl flex gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all"
              >
                <div className="text-amber-400 shrink-0 mt-0.5">
                  <i className={`ph-bold ${s.icon} text-lg`} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase font-mono tracking-widest text-white/40">
                    Step {s.step}
                  </div>
                  <div className="text-xs font-semibold tracking-tight text-white/90 mt-1">{s.title}</div>
                  <div className="fine text-white/60 mt-1 leading-relaxed">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 2.9 Verifiable Trust wall */}
        <HomeTrustWall />

        {/* 2.11 Pricing cards with flexibility checklist */}
        <HomePricing />

        {/* 2.12 Dietitian profile and governance block */}
        <HomeDietitian />

        {/* 2.13 FAQ Accordion */}
        <HomeFAQ />

        {/* 2.14 NCR-compliant Footer */}
        <HomeFooter />
      </div>

      {/* 6. Sticky bottom bar — cart state only (empty cart renders nothing). */}
      <StickyBottomBar context="homepage" />

      {/* Optional, user-initiated "Help me choose meals" assessment. */}
      {quizOpen && (
              <Suspense fallback={null}>
                <IntakeQuiz open={quizOpen} onOpenChange={setQuizOpen} />
              </Suspense>
            )}
    </div>
  );
}
