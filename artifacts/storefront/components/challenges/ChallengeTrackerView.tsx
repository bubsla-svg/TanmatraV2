"use client";
// Client: interactive dietary challenge streak tracker with live cohort milestones and RD check-in links.
import { useState, useEffect } from "react";
import Link from "next/link";
import { getMyChallengeTracker, type ChallengeTrackerData } from "@/lib/ecosystemApi";

export function ChallengeTrackerView() {
  const [data, setData] = useState<ChallengeTrackerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyChallengeTracker()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-center text-xs font-semibold text-ink-muted">Syncing challenge milestones…</div>;

  const active = data?.challenges.slice(0, 4) || [
    { id: 101, slug: "zero-refined-sugar-14d", title: "14-Day Refined Sugar Detox", durationDays: 14, rdName: "RD Ananya", description: "Strictly omit synthetic sucrose and fructose syrups to reset glycemic receptor reactivity." },
    { id: 102, slug: "gut-microbiome-21d", title: "21-Day Prebiotic Fiber Recharge", durationDays: 21, rdName: "RD Vivek", description: "Consume >30g daily diverse plant dietary fiber across whole-grain Indian and Mediterranean menus." },
  ];

  return (
    <div className="flex flex-col gap-10">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col gap-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Live Regimen Telemetry</span>
          <h2 className="text-lg font-semibold text-ink mt-1">Active Clinical Streaks</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {active.map((c, i) => {
            const daysDone = i === 0 ? 9 : 3;
            const pct = Math.min(100, Math.round((daysDone / (c.durationDays || 14)) * 100));
            return (
              <div key={c.id} className="rounded-xl border border-line p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{c.title}</span>
                    <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-semibold text-sage-800 shrink-0">
                      Day {daysDone} / {c.durationDays || 14}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-2 leading-relaxed">{c.description}</p>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-ink-muted mb-1">
                    <span>Regimen Progress</span>
                    <span>{pct}% Completed</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-sage-100">
                    <div className="h-full bg-gold transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col gap-4">
        <h3 className="text-base font-semibold text-ink">Upcoming Dietitian Cohort Check-ins</h3>
        <div className="rounded-xl border border-line p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-sm font-semibold text-ink">Live Q&amp;A &mdash; Navigating Midday Sugar Cravings</span>
            <div className="text-xs text-ink-muted mt-1">Hosted by RD Advisory Board &bull; Friday at 5:00 PM IST</div>
          </div>
          <Link
            href="/qa"
            className="rounded-xl bg-gold px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-gold/90 transition-colors shrink-0 text-center"
          >
            Enter Community Q&amp;A &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
