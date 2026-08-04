import React, { useState } from "react";
import { GlobalLayout } from "../components/Layouts";
import { ClinicalBadge } from "../components/Badges";
import { SafeImage } from "../components/SafeImage";
import { PrimaryCTA, SecondaryCTA } from "../components/CTA";
import { SubscriptionManagementService } from "../services/SubscriptionManagementService";

interface MealPlannerPageProps {
  onNavigate: (route: string) => void;
}

const UPCOMING_DELIVERIES = [
  {
    date: "2026-08-05",
    dateLabel: "Tomorrow, Aug 5",
    mealName: "Golden Glycemic Quinoa Bowl",
    imageUrl: "https://picsum.photos/seed/quinoa/400/300",
    calories: 420,
    status: "scheduled",
    isCutoffPassed: false,
  },
  {
    date: "2026-08-06",
    dateLabel: "Thursday, Aug 6",
    mealName: "Nocturnal Recovery Salmon & Asparagus",
    imageUrl: "https://picsum.photos/seed/salmon/400/300",
    calories: 510,
    status: "scheduled",
    isCutoffPassed: false,
  },
  {
    date: "2026-08-07",
    dateLabel: "Friday, Aug 7",
    mealName: "Therapeutic Turmeric Dal & Wild Rice",
    imageUrl: "https://picsum.photos/seed/dal/400/300",
    calories: 380,
    status: "scheduled",
    isCutoffPassed: false,
  }
];

export const MealPlannerPage: React.FC<MealPlannerPageProps> = ({ onNavigate }) => {
  const [deliveries, setDeliveries] = useState(UPCOMING_DELIVERIES);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  const handleSkip = (date: string) => {
    const res = SubscriptionManagementService.skipDelivery(date);
    if (res.success) {
      setDeliveries(prev => prev.map(d => d.date === date ? { ...d, status: "skipped" } : d));
      setActiveNotification(res.message);
    } else {
      setActiveNotification(`⚠️ ${res.message}`);
    }
  };

  return (
    <GlobalLayout activeTab="plan" currentRoute="/meal-planner" onNavigate={onNavigate}>
      {/* Header Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex gap-2 mb-2">
            <ClinicalBadge label="Active Subscription" variant="emerald" />
            <ClinicalBadge label="30-Day Reset" variant="gold" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Active Meal Planner & Deliveries</h1>
          <p className="text-xs text-slate-400 mt-1">Daily Change Cutoff: <span className="font-bold text-amber-400">10:00 PM day prior</span></p>
        </div>

        <SecondaryCTA onClick={() => onNavigate("/account/subscriptions")} className="!px-4 !py-2 text-xs">
          ⚙ Manage Subscription Settings
        </SecondaryCTA>
      </div>

      {activeNotification && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex justify-between items-center">
          <span>{activeNotification}</span>
          <button onClick={() => setActiveNotification(null)} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
      )}

      {/* Deliveries Schedule Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-100">Upcoming Delivery Lineup</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {deliveries.map((del) => (
            <div key={del.date} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold text-slate-300">{del.dateLabel}</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                    del.status === "skipped" 
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}>
                    {del.status}
                  </span>
                </div>

                <SafeImage src={del.imageUrl} alt={del.mealName} aspectRatio="16/9" className="mb-3" />
                <h3 className="text-sm font-bold text-slate-100 mb-1">{del.mealName}</h3>
                <p className="text-[11px] text-slate-400">{del.calories} kcal • Lunch Slot (12:00 PM)</p>
              </div>

              {del.status !== "skipped" && (
                <div className="pt-3 border-t border-slate-800 flex gap-2">
                  <button
                    onClick={() => handleSkip(del.date)}
                    className="flex-1 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold min-h-[44px]"
                  >
                    Skip Date
                  </button>
                  <button
                    onClick={() => setActiveNotification(`Swap initiated for ${del.dateLabel}`)}
                    className="flex-1 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold min-h-[44px]"
                  >
                    Swap Dish
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </GlobalLayout>
  );
};
