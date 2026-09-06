"use client";
// Client: renders a coach action card. book_rd → the /rd booking surface;
// add_to_cart → the dish's PDP (the server card carries the slug but not the
// numeric dish id the cart line needs, so we route to the PDP where the real
// one-tap Add lives — honest, no fabricated cart line).
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CoachAction } from "@/lib/coachApi";
import { RD_SERVICES_ENABLED } from "@/lib/flags";

export function CoachActionCard({ action }: { action: CoachAction }) {
  // The coach may still emit book_rd; we just do not surface a booking for a
  // service nobody can deliver yet (lib/flags.ts).
  if (action.kind === "book_rd") {
    if (!RD_SERVICES_ENABLED) return null;
    const consults = action.premiumConsultsRemaining;
    return (
      <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">Talk to a registered dietitian</p>
          <p className="mt-1 text-xs text-ink-muted">
            {action.urgency === "soon" ? "Worth booking soon — " : "They can review your situation properly."}
            {consults != null ? ` You have ${consults} free consult${consults === 1 ? "" : "s"}.` : ""}
          </p>
        </div>
        <Button asChild shape="pill" size="fluid" className="gap-1 self-start px-4 py-2 text-xs font-semibold sm:self-center">
          <Link href={action.href}>Book a consult &rarr;</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">{action.name}</p>
        <p className="mt-1 font-data text-xs font-bold text-primary">
          {action.priceLabel}
          {action.target === "next_delivery" ? " · for your next delivery" : ""}
        </p>
        {action.reasoning && <p className="mt-1 text-xs text-ink-muted">{action.reasoning}</p>}
      </div>
      <Button asChild shape="pill" size="fluid" className="gap-1 self-start px-4 py-2 text-xs font-semibold sm:self-center">
        <Link href={`/menu?dish=${action.slug}`}>View &amp; add &rarr;</Link>
      </Button>
    </div>
  );
}
