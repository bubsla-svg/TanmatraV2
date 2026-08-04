import React, { useState } from "react";
import { GlobalLayout } from "../components/Layouts";
import { ClinicalBadge } from "../components/Badges";
import { PrimaryCTA, SecondaryCTA } from "../components/CTA";
import { SubscriptionManagementService } from "../services/SubscriptionManagementService";

interface SubscriptionsManagerPageProps {
  onNavigate: (route: string) => void;
}

export const SubscriptionsManagerPage: React.FC<SubscriptionsManagerPageProps> = ({ onNavigate }) => {
  const [sub, setSub] = useState(() => SubscriptionManagementService.getActiveSubscription());
  const [msg, setMsg] = useState<string | null>(null);

  const handleTogglePause = () => {
    const updated = SubscriptionManagementService.togglePause();
    setSub(updated);
    setMsg(updated.status === "paused" ? "Subscription paused. Future dispatches suspended." : "Subscription resumed. Next delivery scheduled for tomorrow.");
  };

  const handleRenewalChange = (pref: "auto-renew" | "fixed-term" | "decide-later") => {
    const updated = SubscriptionManagementService.updateRenewal(pref);
    setSub(updated);
    setMsg(`Renewal preference updated to: ${pref}`);
  };

  return (
    <GlobalLayout activeTab="account" currentRoute="/account/subscriptions" onNavigate={onNavigate}>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Subscription Management</h1>
          <p className="text-xs text-slate-400 mt-1">Manage active plan status, delivery dates, renewal preferences, and cancellation</p>
        </div>

        {msg && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex justify-between items-center">
            <span>{msg}</span>
            <button onClick={() => setMsg(null)} className="text-slate-400">✕</button>
          </div>
        )}

        {/* Active Subscription Status Card */}
        <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="flex gap-2 mb-1">
                <ClinicalBadge label={sub.status.toUpperCase()} variant={sub.status === "active" ? "emerald" : "amber"} />
                <ClinicalBadge label="30-Day Reset" variant="gold" />
              </div>
              <h2 className="text-xl font-bold text-slate-100">Metabolic Glycemic Reset Plan</h2>
            </div>
            <SecondaryCTA onClick={handleTogglePause} className="!px-4 !py-2 text-xs">
              {sub.status === "active" ? "⏸ Pause Plan" : "▶ Resume Plan"}
            </SecondaryCTA>
          </div>

          {/* Plan Health & Parameters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="block text-slate-500">Start Date</span>
              <span className="font-bold text-slate-200">{sub.startDate}</span>
            </div>
            <div>
              <span className="block text-slate-500">End Date</span>
              <span className="font-bold text-slate-200">{sub.endDate || "Ongoing"}</span>
            </div>
            <div>
              <span className="block text-slate-500">Daily Cutoff</span>
              <span className="font-bold text-amber-400">10:00 PM</span>
            </div>
            <div>
              <span className="block text-slate-500">Plan Health</span>
              <span className="font-bold text-emerald-400">100% Compliant</span>
            </div>
          </div>
        </div>

        {/* Renewal Controls */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
          <h3 className="text-base font-bold text-slate-100">Renewal Preference</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "auto-renew", label: "Auto-Renew (20% Off)", desc: "Renews monthly with discount" },
              { id: "fixed-term", label: "Fixed-Term (30 Days)", desc: "Ends after 30 days without charge" },
              { id: "decide-later", label: "Decide Later", desc: "Alert 3 days before completion" }
            ].map(r => (
              <button
                key={r.id}
                onClick={() => handleRenewalChange(r.id as any)}
                className={`p-4 rounded-2xl border text-left transition-all min-h-[44px] ${
                  sub.renewalPreference === r.id
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/40"
                    : "bg-slate-950 text-slate-400 border-slate-800"
                }`}
              >
                <div className="text-xs font-bold">{r.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};
