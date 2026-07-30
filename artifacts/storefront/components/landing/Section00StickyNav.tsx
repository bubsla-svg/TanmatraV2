"use client"; // Interactive sticky nav and assessment modal trigger

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { emitLpEvent } from "@/lib/lpEvents";

/**
 * §0: Sticky Navigation Bar with Assessment CTA.
 * Keeps navigation links accessible at top of viewport and provides immediate
 * conversion entry via the primary action gold button.
 */
export function Section00StickyNav() {
  const handleAssessmentClick = () => {
    emitLpEvent("sticky_cta_click", { page: "/", label: "Start Assessment Nav" });
    window.dispatchEvent(new Event("open_tanmatra_assessment"));
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md px-4 py-3 shadow-sm transition-all">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-baseline gap-2 text-lg font-bold tracking-tight text-ink hover:opacity-90 transition-opacity"
        >
          <span>Tanmatra</span>
          <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-ink-muted sm:inline-block">
            Clinical Nutrition
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-xs font-semibold text-ink-muted md:flex" aria-label="Main navigation">
          <a href="#protocols" className="transition-colors hover:text-ink">
            Protocols &amp; Tiers
          </a>
          <a href="#proofs" className="transition-colors hover:text-ink">
            Clinical Proofs
          </a>
          <a href="#pricing" className="transition-colors hover:text-ink">
            Transparent Pricing
          </a>
          <a href="#faq" className="transition-colors hover:text-ink">
            Medical FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/menu"
            className="hidden text-xs font-semibold text-ink transition-colors hover:text-ink-muted sm:inline-block"
          >
            Browse Menu
          </Link>
          <Button
            type="button"
            onClick={handleAssessmentClick}
            shape="xl" size="fluid" className="gap-1.5 px-4 py-2 text-xs font-semibold shadow-sm"
            aria-label="Start interactive clinical nutrition assessment"
          >
            Start Assessment <span aria-hidden>&rarr;</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
