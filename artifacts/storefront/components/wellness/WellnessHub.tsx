"use client";
import { useState } from "react";
import { WellnessTracker } from "./WellnessTracker";
import { HydrationCircadianTracker } from "./HydrationCircadianTracker";
import { FamilyLeaderboardView } from "./FamilyLeaderboardView";
import { PrecisionMealPlanner } from "./PrecisionMealPlanner";
import { PantryVisionScanner } from "./PantryVisionScanner";
import { BloodReportOCR } from "../rd/BloodReportOCR";
import { Droplets, Trophy, Utensils, Sparkles, Activity, Camera } from "lucide-react";

export function WellnessHub() {
  const [activeTab, setActiveTab] = useState<
    "precision" | "blood_ocr" | "pantry_vision" | "hydration" | "leaderboard" | "nutrition"
  >("precision");

  return (
    <div className="space-y-6">
      {/* Sub-header navigation tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("precision")}
          className={`flex items-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "precision"
              ? "border border-gold bg-primary/10 text-primary"
              : "border border-transparent bg-secondary text-ink-muted hover:text-primary"
          }`}
        >
          <Sparkles className="w-4 h-4 text-accent" />
          <span>ICMR Precision Planner</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("blood_ocr")}
          className={`flex items-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "blood_ocr"
              ? "border border-gold bg-primary/10 text-primary"
              : "border border-transparent bg-secondary text-ink-muted hover:text-primary"
          }`}
        >
          <Activity className="w-4 h-4 text-[var(--danger)]" />
          <span>Blood Report AI OCR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pantry_vision")}
          className={`flex items-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "pantry_vision"
              ? "border border-gold bg-primary/10 text-primary"
              : "border border-transparent bg-secondary text-ink-muted hover:text-primary"
          }`}
        >
          <Camera className="w-4 h-4 text-accent" />
          <span>Pantry Vision Scanner</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("hydration")}
          className={`flex items-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "hydration"
              ? "border border-gold bg-primary/10 text-primary"
              : "border border-transparent bg-secondary text-ink-muted hover:text-primary"
          }`}
        >
          <Droplets className="w-4 h-4 text-accent" />
          <span>Hydration & Fasting</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("leaderboard")}
          className={`flex items-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "leaderboard"
              ? "border border-gold bg-primary/10 text-primary"
              : "border border-transparent bg-secondary text-ink-muted hover:text-primary"
          }`}
        >
          <Trophy className="w-4 h-4 text-accent" />
          <span>Family Leaderboard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("nutrition")}
          className={`flex items-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "nutrition"
              ? "border border-gold bg-primary/10 text-primary"
              : "border border-transparent bg-secondary text-ink-muted hover:text-primary"
          }`}
        >
          <Utensils className="w-4 h-4 text-sage-text" />
          <span>Nutrition Tracker</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "precision" && <PrecisionMealPlanner />}
      {activeTab === "blood_ocr" && <BloodReportOCR />}
      {activeTab === "pantry_vision" && <PantryVisionScanner />}
      {activeTab === "hydration" && <HydrationCircadianTracker />}
      {activeTab === "leaderboard" && <FamilyLeaderboardView />}
      {activeTab === "nutrition" && (
        <div className="max-w-lg mx-auto">
          <WellnessTracker />
        </div>
      )}
    </div>
  );
}
