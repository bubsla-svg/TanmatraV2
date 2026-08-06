"use client";
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { emitLpEvent } from "@/lib/lpEvents";
import { formatPaise } from "@/lib/format";

/**
 * Section 3: The Corporate Wellness Integration (Revenue Stream 2 - B2B Volume).
 * Highlights cafeteria health wallet integration, productivity gains, and pilot requests.
 */
export function Section03B2BEnterprise() {
  const handleClick = () => {
    emitLpEvent("hero_cta_click", { page: "/", label: "Calculate ROI & Request Pilot" });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="rounded-3xl border-2 border-gold/30 bg-surface-raised p-8 shadow-sm lg:p-12">
        {/* min-w-0 on both grid items: a CSS grid item's default min-width is
            `auto` (its content's min-content size), not 0 — so on narrow
            viewports the track refused to shrink below the graphic card's
            intrinsic width and pushed this whole section past the viewport
            edge (measured: 469px content in a 360px viewport). min-w-0 lets
            the track — and the text inside it — actually wrap down to fit. */}
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
              Corporate Wellness &amp; Team Lunches
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Keep Your Team Energized and Productive.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted sm:text-base">
              Offer your team healthy, dietitian-approved lunches without the hassle. We integrate with your corporate perks to make healthy eating the easy choice at work.
            </p>

            <ul className="mt-6 flex flex-col gap-3 text-xs text-ink">
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-text font-bold text-[10px]">⚡</span>
                <span>Easy integration with employee benefits and meal allowances</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-text font-bold text-[10px]">⚡</span>
                <span>Fresh, group deliveries straight to your office</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-text font-bold text-[10px]">⚡</span>
                <span>Boost focus and reduce afternoon fatigue for your team</span>
              </li>
            </ul>

            <div className="mt-8">
              {/* whitespace-normal overrides the Button primitive's default
                  nowrap: this label is long enough that nowrap made the
                  button itself the widest thing on the page, dragging the
                  whole section wider than the viewport on mobile. */}
              <Button asChild shape="xl" size="fluid" className="whitespace-normal px-6 py-3.5 font-bold shadow-md">
                <Link href="/corporate-wellness#pilot-form" onClick={handleClick}>
                  Calculate Your Team's ROI &amp; Request a Pilot &rarr;
                </Link>
              </Button>
            </div>
          </div>

          {/* Graphic: Corporate ID badge syncing & bulk thermal delivery */}
          <div className="min-w-0 rounded-2xl border border-line bg-surface p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised text-lg font-bold">
                  🪪
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">Corporate ID Badge Sync</p>
                  <p className="text-[10px] text-ink-faint">Tanmatra Enterprise API Gateway</p>
                </div>
              </div>
              <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[10px] font-bold text-sage-text">
                CONNECTED
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="rounded-xl border border-line/80 bg-surface-raised p-3 text-xs">
                <div className="flex justify-between text-ink-muted font-medium text-[11px]">
                  <span>Daily Subsidy Applied</span>
                  <span className="font-bold text-gold-text">{formatPaise(18000)} / meal</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-line">
                  <div className="h-1.5 w-[75%] rounded-full bg-gold"></div>
                </div>
              </div>

              <div className="rounded-xl border border-line/80 bg-surface-raised p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-ink">Thermal Bulk Dispatch</span>
                  <span className="text-[10px] font-bold text-sage-text">Sector 135 IT Park</span>
                </div>
                <p className="mt-1 text-[10px] text-ink-faint">Arriving at 12:45 PM · Internal Temp 65°C Logged</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
