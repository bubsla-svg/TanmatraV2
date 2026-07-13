import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { type WellnessGoal } from "@/lib/preferencesApi";
import IntakeQuiz from "@/components/preferences/IntakeQuiz";

// Modularized Homepage Components
import HomeHeader from "@/components/home/HomeHeader";
import HomeHero from "@/components/home/HomeHero";
import HomeGoalSelection from "@/components/home/HomeGoalSelection";
import HomeAssessmentPreview from "@/components/home/HomeAssessmentPreview";
import HomeRecommendedPlans from "@/components/home/HomeRecommendedPlans";
import HomeMealsRail from "@/components/home/HomeMealsRail";
import HomeTrustWall from "@/components/home/HomeTrustWall";
import HomePricing from "@/components/home/HomePricing";
import HomeDietitian from "@/components/home/HomeDietitian";
import HomeFAQ from "@/components/home/HomeFAQ";
import HomeFooter from "@/components/home/HomeFooter";
import StickyBottomBar from "@/components/layout/StickyBottomBar";

const HOW_STEPS = [
  {
    icon: "ph-clipboard-text",
    step: "01",
    title: "RDs design every dish",
    desc: "Registered dietitians formulate each recipe around a therapeutic goal — blood sugar control, protein synthesis, anti-inflammation. Never flavor-first.",
  },
  {
    icon: "ph-seal-check",
    step: "02",
    title: "Your profile shapes the menu",
    desc: "Take the 60-second metabolic assessment and the menu re-ranks around your goal, restrictions, and micro targets.",
  },
  {
    icon: "ph-calendar",
    step: "03",
    title: "Delivered fresh daily",
    desc: "Meals are prepared fresh in ISO 22000 kitchens and delivered in daily capacity-controlled scheduled windows across Noida, Delhi & Gurgaon.",
  },
];

export default function V2Home() {
  const [quizOpen, setQuizOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<WellnessGoal | null>(null);

  useEffect(() => {
    track("view_home");
  }, []);

  const handleSelectGoal = (goal: WellnessGoal, _condition?: string) => {
    setSelectedGoal(goal);
    setQuizOpen(true);
  };

  return (
    <div className="tnm2 min-h-screen bg-[var(--tnm-surface-ink)] text-white select-none">
      <h1 className="sr-only">
        Tanmatra — Clinical-grade Therapeutic Meal Delivery in Noida, Delhi & Gurgaon
      </h1>

      {/* 2.1 Sticky scroll transition Header */}
      <HomeHeader onStartAssessment={() => setQuizOpen(true)} />

      <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 88 }}>
        {/* 2.2 Hero with headline, macro chips, and slide CTAs */}
        <HomeHero
          onStartAssessment={() => setQuizOpen(true)}
          onExploreMeals={() => {
            document.getElementById("dietitian-meals")?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* 2.3 Goal selection cards */}
        <HomeGoalSelection onSelectGoal={handleSelectGoal} />

        {/* 2.4 Assessment stage preview */}
        <HomeAssessmentPreview onStart={() => setQuizOpen(true)} />

        {/* 2.5 Recommended plans rail */}
        <HomeRecommendedPlans />

        {/* 2.6 Dietitian-selected meals rail */}
        <HomeMealsRail />

        {/* 2.7 How It Works */}
        <section className="padx mt-10">
          <div className="secrow px-0">
            <span className="sh text-base font-bold text-white/95">
              Not just a meal — a protocol on a plate
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {HOW_STEPS.map((s) => (
              <div
                key={s.step}
                className="card flex gap-4 border border-white/5"
                style={{ background: "var(--tnm-surface-ink-2)", padding: 14 }}
              >
                <div className="text-[var(--tnm-action)] shrink-0 mt-0.5">
                  <i className={`ph-bold ${s.icon} text-lg`} />
                </div>
                <div className="f1">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-white/40">
                    Step {s.step}
                  </div>
                  <div className="text-xs font-bold text-white/90 mt-1">{s.title}</div>
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

      {/* 6. Consolidated sticky bottom bar (state machine context: homepage) */}
      <StickyBottomBar context="homepage" onContinue={() => setQuizOpen(true)} />

      {/* Metabolic Assessment Quiz Overlay */}
      <IntakeQuiz
        open={quizOpen}
        onOpenChange={setQuizOpen}
        initialGoal={selectedGoal || undefined}
      />
    </div>
  );
}
