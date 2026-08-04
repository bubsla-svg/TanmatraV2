import React, { useState } from "react";
import { GlobalLayout } from "../components/Layouts";
import { ClinicalBadge } from "../components/Badges";
import { PrimaryCTA, SecondaryCTA } from "../components/CTA";
import { FeedbackService, FeedbackRating, FeedbackReason } from "../services/FeedbackService";

interface AccountHubPageProps {
  onNavigate: (route: string) => void;
}

const REASON_OPTIONS: FeedbackReason[] = ["Taste", "Portion", "Spice", "Texture", "Too heavy", "Too light", "Ingredient", "Packaging"];

export const AccountHubPage: React.FC<AccountHubPageProps> = ({ onNavigate }) => {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState<FeedbackRating>("loved-it");
  const [selectedReasons, setSelectedReasons] = useState<FeedbackReason[]>([]);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const handleToggleReason = (r: FeedbackReason) => {
    setSelectedReasons(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const handleSubmitFeedback = () => {
    FeedbackService.submitFeedback("m1_last_meal", selectedRating, selectedReasons);
    setFeedbackSuccess(true);
    setTimeout(() => {
      setFeedbackSuccess(false);
      setIsFeedbackOpen(false);
    }, 1500);
  };

  return (
    <GlobalLayout activeTab="account" currentRoute="/account" onNavigate={onNavigate}>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Member Account Hub</h1>
          <p className="text-xs text-slate-400 mt-1">Manage active plans, view delivery tracking, appointments, and meal feedback</p>
        </div>

        {/* Priority 1: Required Action Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-amber-400 text-lg">⚠️</span>
            <div>
              <p className="text-xs font-bold text-amber-300">Daily Cutoff Window Closing</p>
              <p className="text-[11px] text-amber-400/80">Confirm tomorrow's meal lineup before 10:00 PM</p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate("/meal-planner")}
            className="px-3 py-1.5 rounded-xl bg-[#D4AF37] text-slate-950 font-bold text-xs shadow-md shadow-amber-500/10"
          >
            Review Lineup
          </button>
        </div>

        {/* Priority 2: Active Subscription Card */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100">Active Plan</h3>
            <ClinicalBadge label="30-Day Reset" variant="gold" />
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-base font-bold text-slate-100">Metabolic Glycemic Reset Plan</p>
              <p className="text-xs text-slate-400 mt-0.5">Next Delivery: Tomorrow at 12:00 PM</p>
            </div>
            <SecondaryCTA onClick={() => onNavigate("/account/subscriptions")} className="!px-3 !py-1.5 text-xs">
              Manage Settings
            </SecondaryCTA>
          </div>
        </div>

        {/* Priority 3: Recent Meal Feedback Launcher */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Leave Meal Feedback</h3>
            <p className="text-xs text-slate-400 mt-0.5">Rate yesterday's "Golden Glycemic Quinoa Bowl"</p>
          </div>
          <PrimaryCTA onClick={() => setIsFeedbackOpen(true)} className="!px-4 !py-2 text-xs">
            ⭐ Rate Meal
          </PrimaryCTA>
        </div>

        {/* Account Links Hub Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Orders & History", route: "/account/orders", icon: "📦" },
            { label: "RD Appointments", route: "/account/appointments", icon: "🩺" },
            { label: "Addresses", route: "/account/addresses", icon: "📍" },
            { label: "Wellness Telemetry", route: "/account/wellness", icon: "📊" },
          ].map((item) => (
            <div
              key={item.label}
              onClick={() => onNavigate(item.route)}
              className="bg-slate-900 border border-slate-800 p-5 rounded-2xl cursor-pointer hover:border-amber-500/30 transition-all text-center space-y-2"
            >
              <span className="text-2xl block">{item.icon}</span>
              <span className="text-xs font-bold text-slate-200 block">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Meal Feedback Modal */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100">Meal Feedback</h3>
              <button onClick={() => setIsFeedbackOpen(false)} className="text-slate-400">✕</button>
            </div>

            {feedbackSuccess ? (
              <div className="text-center py-6 text-emerald-400 font-bold text-sm">
                ✓ Thank you! Your feedback will calibrate future recommendations.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Rating Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Overall Rating</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "loved-it", label: "Loved it ❤️" },
                      { id: "it-was-okay", label: "It was okay 👍" },
                      { id: "not-for-me", label: "Not for me 👎" }
                    ].map(r => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRating(r.id as any)}
                        className={`p-3 rounded-xl border text-xs font-bold text-center min-h-[44px] ${
                          selectedRating === r.id
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/40"
                            : "bg-slate-950 text-slate-400 border-slate-800"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Structured Reasons */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Structured Reasons (Optional)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {REASON_OPTIONS.map(r => {
                      const isSel = selectedReasons.includes(r);
                      return (
                        <button
                          key={r}
                          onClick={() => handleToggleReason(r)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold text-left min-h-[44px] ${
                            isSel ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-slate-950 text-slate-400 border-slate-800"
                          }`}
                        >
                          {isSel ? "✓ " : "+ "}{r}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <PrimaryCTA onClick={handleSubmitFeedback} className="w-full">
                  Submit Feedback
                </PrimaryCTA>
              </div>
            )}
          </div>
        </div>
      )}
    </GlobalLayout>
  );
};
