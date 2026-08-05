"use client";

import { useState } from "react";
import { Activity, Cpu, Heart, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Provider {
  id: string;
  name: string;
  category: string;
  connected: boolean;
  lastSync?: string;
  metricLabel: string;
}

export function WearablesHub() {
  const [providers, setProviders] = useState<Provider[]>([
    {
      id: "apple_health",
      name: "Apple Health",
      category: "Activity, Workouts & Sleep",
      connected: true,
      lastSync: "Today, 11:30 AM",
      metricLabel: "Steps, Active Energy & Sleep Duration Sync",
    },
    {
      id: "health_connect",
      name: "Android Health Connect",
      category: "Activity & Sleep",
      connected: false,
      metricLabel: "Daily Steps, Workouts & Rest Metrics",
    },
  ]);

  const toggleConnect = (id: string) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              connected: !p.connected,
              lastSync: !p.connected ? "Just now" : undefined,
            }
          : p
      )
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed text-ink-muted">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-ink">
          <ShieldAlert size={14} className="text-gold-text" />
          Health Privacy & Recommendation Context
        </div>
        Activity and workout metrics help rank meal recommendations for training days. Tanmatra will never change a scheduled meal automatically. Continuous Glucose Monitors (CGM) and medical diagnostic telemetry remain out of scope.
      </div>

      <div className="flex flex-col gap-4">
        {providers.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition-all hover:border-gold/30"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-gold-text">
                  {p.id === "apple_health" ? (
                    <Heart size={20} />
                  ) : p.id === "ultrahuman" ? (
                    <Cpu size={20} />
                  ) : (
                    <Activity size={20} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{p.name}</h3>
                  <p className="text-xs text-ink-muted">{p.category}</p>
                </div>
              </div>
              {p.connected && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                  <CheckCircle2 size={12} /> Connected
                </span>
              )}
            </div>

            <p className="text-xs text-ink-muted">{p.metricLabel}</p>

            {p.lastSync && (
              <p className="text-[11px] text-ink-faint">Last synced: {p.lastSync}</p>
            )}

            <Button
              type="button"
              variant={p.connected ? "outline" : "default"}
              size="sm"
              onClick={() => toggleConnect(p.id)}
              className="mt-1 w-full text-xs font-semibold"
            >
              {p.connected ? "Disconnect Provider" : "Connect Integration"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
