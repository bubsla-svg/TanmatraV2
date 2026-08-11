"use client";
import React from "react";

/**
 * Section 5: The "Noida-Proof" Logistics Moat (Overcoming Local Friction).
 * Demonstrates 45°C heat defiance, IoT cold-chain telemetry, double-slot dispatches & hybrid routing.
 */
export function Section05LogisticsMoat() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-section-py sm:px-6">
      <div className="rounded-3xl border border-line bg-surface-raised p-8 shadow-sm lg:p-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
            Smart Delivery · Noida
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Always Fresh, No Matter the Heat.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted sm:text-base">
            We keep your food at the perfect temperature from our kitchen to your door, even on Noida's hottest days. No soggy salads, no spoiled meals—just fresh food on time.
          </p>
        </div>

        <div className="mt-10 grid grid-flow-dense gap-6 sm:grid-cols-3">
          {/* Feature 1: Thermometer IoT Telemetry */}
          <div className="flex flex-col items-start rounded-2xl border border-line bg-surface p-6 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-2xl">
              🌡️
            </div>
            <h3 className="mt-4 text-base font-bold text-ink">Smart Temperature Tracking</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              We monitor your meal's temperature every step of the way to ensure it arrives fresh and safe.
            </p>
            <span className="mt-4 rounded-full bg-sage-soft px-2.5 py-1 text-[10px] font-bold text-sage-text">
              Freshness Guaranteed
            </span>
          </div>

          {/* Feature 2: Double-Slot Dispatch Clock */}
          <div className="flex flex-col items-start rounded-2xl border border-line bg-surface p-6 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-2xl">
              ⏰
            </div>
            <h3 className="mt-4 text-base font-bold text-ink">On-Time Delivery Windows</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Scheduled lunch and dinner deliveries mean your food arrives exactly when you expect it, ready to eat.
            </p>
            <span className="mt-4 rounded-full bg-gold/10 px-2.5 py-1 text-[10px] font-bold text-gold-text">
              Predictable Slots
            </span>
          </div>

          {/* Feature 3: Hybrid-Routing Address Switch */}
          <div className="flex flex-col items-start rounded-2xl border border-line bg-surface p-6 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-2xl">
              🔀
            </div>
            <h3 className="mt-4 text-base font-bold text-ink">Flexible Delivery Locations</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Easily switch delivery between home and office with one click before 9:00 PM the night before.
            </p>
            <span className="mt-4 rounded-full bg-sage-soft px-2.5 py-1 text-[10px] font-bold text-sage-text">
              Easy Location Switch
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
