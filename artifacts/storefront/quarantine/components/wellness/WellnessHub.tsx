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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "precision"
              ? "bg-sky-900 text-white shadow-md"
              : "bg-surface text-ink-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>ICMR Precision Planner</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("blood_ocr")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "blood_ocr"
              ? "bg-sky-900 text-white shadow-md"
              : "bg-surface text-ink-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Activity className="w-4 h-4 text-rose-400" />
          <span>Blood Report AI OCR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pantry_vision")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "pantry_vision"
              ? "bg-sky-900 text-white shadow-md"
              : "bg-surface text-ink-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Camera className="w-4 h-4 text-amber-400" />
          <span>Pantry Vision Scanner</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("hydration")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "hydration"
              ? "bg-sky-900 text-white shadow-md"
              : "bg-surface text-ink-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Droplets className="w-4 h-4 text-cyan-400" />
          <span>Hydration & Fasting</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("leaderboard")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "leaderboard"
              ? "bg-sky-900 text-white shadow-md"
              : "bg-surface text-ink-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Family Leaderboard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("nutrition")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "nutrition"
              ? "bg-sky-900 text-white shadow-md"
              : "bg-surface text-ink-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Utensils className="w-4 h-4 text-emerald-400" />
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
