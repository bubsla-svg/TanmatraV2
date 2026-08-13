"use client";
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { emitLpEvent } from "@/lib/lpEvents";

/**
 * Section 4: Telehealth & Clinical Tracking (Revenue Stream 3 - Consultations & Tech).
 * Promotes dietitian consultations and digital metabolic tracking dashboard.
 */
export function Section04TelehealthTracking() {
  const handleClick = () => {
    emitLpEvent("hero_cta_click", { page: "/", label: "Book Intro Consult" });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-section-py sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-8 shadow-sm lg:p-12">

        {/* min-w-0 on both grid items: a CSS grid item's default min-width is
            `auto` (its content's min-content size), not 0 — so on narrow
            viewports the track refused to shrink below the dashboard-preview
            card's intrinsic width and pushed this whole section past the
            viewport edge. min-w-0 lets the track actually shrink to fit. */}
        <div className="grid items-center gap-8 lg:grid-cols-2">
          {/* Visual: Dashboard Preview */}
          <div className="order-2 lg:order-1 min-w-0 rounded-2xl border border-line bg-surface-raised p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-line pb-3 text-xs font-semibold text-ink">
              <span>Tanmatra Health Tracker</span>
              <span className="tabular text-gold-text">Nutrition &amp; Energy Log</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-line bg-surface p-3">
                <span className="text-3xs uppercase font-bold text-ink-faint">Protein Goal</span>
                <p className="tabular text-lg font-bold text-ink">104g / 100g</p>
                <span className="text-3xs text-sage-text font-semibold">✓ Target Met</span>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3">
                <span className="text-3xs uppercase font-bold text-ink-faint">Sugar Control</span>
                <p className="tabular text-lg font-bold text-ink">Balanced</p>
                <span className="text-3xs text-sage-text font-semibold">✓ Steady Energy</span>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-line bg-surface p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-base">👩‍⚕️</span>
                <div>
                  <p className="font-bold text-ink">Dr. Anjali Nair, RD</p>
                  <p className="text-3xs text-ink-muted">ADA Diabetes Educator</p>
                </div>
              </div>
              <span className="rounded-md bg-gold/10 px-2 py-1 text-3xs font-bold text-gold-text">
                Review Synced
              </span>
            </div>
          </div>

          <div className="order-1 lg:order-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
              Expert Guidance &amp; Tracking
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Personal Support from Real Experts.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted sm:text-base">
              Get guidance on your health journey. Book a chat with our Registered Dietitians to personalize your plan, or <Link href="/premium" className="font-bold text-gold-text underline">unlock it FREE with Tanmatra Premium</Link> along with priority delivery and exclusive dishes.
            </p>

            <div className="mt-8">
              {/* whitespace-normal overrides the Button primitive's default
                  nowrap: this label is long enough that nowrap made the
                  button itself the widest thing on the page, dragging the
                  whole section wider than the viewport on mobile. */}
              <Button asChild shape="xl" size="fluid" className="whitespace-normal px-6 py-3.5 font-bold shadow-md">
                <Link href="/rd" onClick={handleClick}>Book Your Free 15-Minute Intro Consult &rarr;</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
