"use client";
import React, { useState } from "react";

export interface HybridWorkToggleProps {
  subscriptionId: number;
  currentLocation?: string;
  onLocationChange?: (location: string) => void;
}

/**
  CUJ 2: Hybrid-Work Subscription Delivery Routing Toggle.
  Allows Noida commuters to switch between Sector 135 Office and Sector 150 Home
  with explicit 9 PM cut-off SLA transparency to eliminate delivery routing churn.
 */
export function HybridWorkToggle({
  subscriptionId,
  currentLocation = "Sector 150 Home",
  onLocationChange,
}: HybridWorkToggleProps) {
  const [selected, setSelected] = useState<"office" | "home">(
    currentLocation.toLowerCase().includes("office") ? "office" : "home",
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleToggle = (target: "office" | "home") => {
    if (target === selected || isUpdating) return;
    setIsUpdating(true);
    const locationName = target === "office" ? "Sector 135 Office" : "Sector 150 Home";
    
    // Simulate API update & acknowledge 9 PM cutoff invariant
    setTimeout(() => {
      setSelected(target);
      setIsUpdating(false);
      setNotice(`Route updated to ${locationName} for tomorrow's dispatch (Lock at 9:00 PM tonight).`);
      onLocationChange?.(locationName);
    }, 300);
  };

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-raised p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink">
          Where are you eating tomorrow?
        </span>
        <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] font-bold text-sage-text">
          9 PM Route Cutoff SLA
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleToggle("home")}
          disabled={isUpdating}
          className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold transition-all ${
            selected === "home"
              ? "border-gold-text bg-gold/10 text-gold-text shadow-xs"
              : "border-line bg-surface text-ink-muted hover:border-line-strong"
          }`}
        >
          <span>🏠 Sector 150 Home</span>
          {selected === "home" && <span>✓</span>}
        </button>

        <button
          type="button"
          onClick={() => handleToggle("office")}
          disabled={isUpdating}
          className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold transition-all ${
            selected === "office"
              ? "border-gold-text bg-gold/10 text-gold-text shadow-xs"
              : "border-line bg-surface text-ink-muted hover:border-line-strong"
          }`}
        >
          <span>🏢 Sector 135 Office</span>
          {selected === "office" && <span>✓</span>}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        {notice ?? "Algorithmic routing active: Switch address between home & office anytime before 9:00 PM the night prior."}
      </p>
    </div>
  );
}
