"use client";
import React from "react";

/**
 * Section 5: The "Noida-Proof" Logistics Moat (Overcoming Local Friction).
 * Demonstrates 45°C heat defiance, IoT cold-chain telemetry, double-slot dispatches & hybrid routing.
 */
export function Section05LogisticsMoat() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="rounded-3xl border border-line bg-surface-raised p-8 shadow-sm lg:p-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
            Hyperlocal Infrastructure Moat · Noida
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Heat-Defiant, Schedule-Perfect Delivery.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted sm:text-base">
            Standard 10-minute delivery apps fail when the temperature hits 45°C, leaving your food spoiled and drivers exhausted. Tanmatra utilizes advanced multi-sensor IoT telemetry. We log the internal temperature of your meal every 30 seconds during transit.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {/* Feature 1: Thermometer IoT Telemetry */}
          <div className="flex flex-col items-start rounded-2xl border border-line bg-surface p-6 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-2xl">
              🌡️
            </div>
            <h3 className="mt-4 text-base font-bold text-ink">30s IoT Temp Logging</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Multi-sensor telemetry tracks internal thermal safety boundaries continuously from kitchen pass to your doorstep.
            </p>
            <span className="mt-4 rounded-full bg-sage-soft px-2.5 py-1 text-[10px] font-bold text-sage-text">
              Active Cold-Chain Sealed
            </span>
          </div>

          {/* Feature 2: Double-Slot Dispatch Clock */}
          <div className="flex flex-col items-start rounded-2xl border border-line bg-surface p-6 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-2xl">
              ⏰
            </div>
            <h3 className="mt-4 text-base font-bold text-ink">Double-Slot Dispatch</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Dedicated morning (12:00-1:30 PM) and evening (7:30-9:00 PM) dispatch windows guarantee thermal perfection upon arrival.
            </p>
            <span className="mt-4 rounded-full bg-gold/10 px-2.5 py-1 text-[10px] font-bold text-gold-text">
              Predictable Office Slots
            </span>
          </div>

          {/* Feature 3: Hybrid-Routing Address Switch */}
          <div className="flex flex-col items-start rounded-2xl border border-line bg-surface p-6 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-2xl">
              🔀
            </div>
            <h3 className="mt-4 text-base font-bold text-ink">Hybrid-Work Routing</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              1-click toggle between Sector 135 Office and Sector 150 Home anytime before 9:00 PM the night prior. Zero lock-in churn.
            </p>
            <span className="mt-4 rounded-full bg-sage-soft px-2.5 py-1 text-[10px] font-bold text-sage-text">
              9 PM Cutoff Flexibility
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
