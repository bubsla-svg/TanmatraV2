import React, { useState } from "react";
import { GlobalLayout } from "../components/Layouts";
import { ClinicalBadge } from "../components/Badges";
import { PrimaryCTA, SecondaryCTA } from "../components/CTA";
import { WearableConnectionService } from "../services/WearableConnectionService";

interface WearableConnectionsPageProps {
  onNavigate: (route: string) => void;
}

export const WearableConnectionsPage: React.FC<WearableConnectionsPageProps> = ({ onNavigate }) => {
  const [conn, setConn] = useState(() => WearableConnectionService.getConnectionStatus());
  const [telemetry, setTelemetry] = useState(() => WearableConnectionService.getTelemetrySummary());
  const [recommendation, setRecommendation] = useState(() => WearableConnectionService.getExplainableRecommendation());
  const [msg, setMsg] = useState<string | null>(null);

  const handleConnect = (platform: "apple-health" | "health-connect") => {
    const updated = WearableConnectionService.connect(platform);
    setConn(updated);
    setTelemetry(WearableConnectionService.getTelemetrySummary());
    setRecommendation(WearableConnectionService.getExplainableRecommendation());
    setMsg(`Successfully connected to ${platform === "apple-health" ? "Apple Health" : "Health Connect"}`);
  };

  const handleDisconnect = () => {
    const updated = WearableConnectionService.disconnect();
    setConn(updated);
    setTelemetry(null);
    setRecommendation(null);
    setMsg("Wearable platform disconnected.");
  };

  const handleApplyRecommendation = () => {
    setMsg("Recommendation applied with user confirmation: Protein portion increased by +15g.");
  };

  return (
    <GlobalLayout activeTab="account" currentRoute="/account/connections" onNavigate={onNavigate}>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Wearable Health Connections</h1>
          <p className="text-xs text-slate-400 mt-1">Connect Apple Health or Health Connect for explainable meal recommendations</p>
        </div>

        {msg && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex justify-between items-center">
            <span>{msg}</span>
            <button onClick={() => setMsg(null)} className="text-slate-400">✕</button>
          </div>
        )}

        {/* Connection Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Apple Health */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🍎</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Apple Health</h3>
                  <p className="text-[10px] text-slate-400">iOS HealthKit Integration</p>
                </div>
              </div>
              <ClinicalBadge 
                label={conn.platform === "apple-health" && conn.status === "connected" ? "Connected" : "Optional"} 
                variant={conn.platform === "apple-health" && conn.status === "connected" ? "emerald" : "slate"} 
              />
            </div>

            {conn.platform === "apple-health" && conn.status === "connected" ? (
              <SecondaryCTA onClick={handleDisconnect} className="w-full !py-2 text-xs">
                Disconnect Apple Health
              </SecondaryCTA>
            ) : (
              <PrimaryCTA onClick={() => handleConnect("apple-health")} className="w-full !py-2 text-xs">
                Connect Apple Health
              </PrimaryCTA>
            )}
          </div>

          {/* Health Connect */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Health Connect</h3>
                  <p className="text-[10px] text-slate-400">Android Health Connect Integration</p>
                </div>
              </div>
              <ClinicalBadge 
                label={conn.platform === "health-connect" && conn.status === "connected" ? "Connected" : "Optional"} 
                variant={conn.platform === "health-connect" && conn.status === "connected" ? "emerald" : "slate"} 
              />
            </div>

            {conn.platform === "health-connect" && conn.status === "connected" ? (
              <SecondaryCTA onClick={handleDisconnect} className="w-full !py-2 text-xs">
                Disconnect Health Connect
              </SecondaryCTA>
            ) : (
              <PrimaryCTA onClick={() => handleConnect("health-connect")} className="w-full !py-2 text-xs">
                Connect Health Connect
              </PrimaryCTA>
            )}
          </div>
        </div>

        {/* Telemetry Summary & Explainable Recommendation */}
        {telemetry && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
            <h3 className="text-base font-bold text-slate-100 border-b border-slate-800 pb-3">Synced Telemetry Data</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Daily Steps</span>
                <span className="text-lg font-bold text-slate-100">{telemetry.dailySteps.toLocaleString()}</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Active Energy</span>
                <span className="text-lg font-bold text-slate-100">{telemetry.activeEnergyKcal} kcal</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Sleep Duration</span>
                <span className="text-lg font-bold text-slate-100">{telemetry.sleepHours} hrs</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Workout Time</span>
                <span className="text-lg font-bold text-slate-100">{telemetry.workoutMinutes} mins</span>
              </div>
            </div>

            {/* Explainable Recommendation Safeguard */}
            {recommendation && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold text-xs">💡 Explainable Recommendation</span>
                  <ClinicalBadge label="Requires Confirmation" variant="gold" />
                </div>
                <p className="text-xs text-amber-200">{recommendation.signal}</p>
                <p className="text-xs font-bold text-slate-100">{recommendation.recommendation}</p>

                <PrimaryCTA onClick={handleApplyRecommendation} className="!px-4 !py-2 text-xs">
                  Apply Portion Boost
                </PrimaryCTA>
              </div>
            )}
          </div>
        )}
      </div>
    </GlobalLayout>
  );
};
