import type { Metadata } from "next";
import Link from "next/link";
// Stitch dark scope (route-scoped) — see lib/themes/stitch.css. This is the
// tail of the checkout funnel; it must read as the same product as /checkout.
import "@/lib/themes/stitch.css";
import { fetchOrderStatus, statusLabel, statusTone, TRACKABLE_STATUSES } from "@/lib/orderStatus";
import { PlanPerks } from "@/components/order/PlanPerks";
import { ThankYouRecommendations } from "@/components/order/ThankYouRecommendations";

/** Tone → status-label colour — same mapping as route-12's OrderRow, so a
 *  customer landing here straight from checkout and later revisiting via
 *  /account/orders sees one consistent treatment, not two. */
const TONE_TEXT = {
  live: "text-sage-text",
  settled: "text-ink-muted",
  failed: "text-destructive",
} as const;

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

/**
 * Post-payment confirmation (SF-06 / CUJ-01 tail). Server-rendered from the
 * guest status endpoint — the totals and status shown are the SERVER's, never
 * client arithmetic. Unknown order → honest not-found, no dead end.
 */
export default async function ConfirmedPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const result = await fetchOrderStatus(orderId, API_BASE);

  if (result.kind !== "ok") {
    return (
      <div data-stitch="dark" className="min-h-screen bg-[var(--bg)] text-ink">
        <section className="mx-auto max-w-md px-4 py-10 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {result.kind === "not_found"
              ? "We can't find that order"
              : "We can't reach the kitchen right now"}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {result.kind === "not_found"
              ? "Check the link from your confirmation message."
              : "Your order is unaffected — try this page again in a moment."}
          </p>
          <Link
            href="/menu"
            className="mt-8 inline-block rounded-full bg-gold px-6 py-3.5 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
          >
            Back to the menu
          </Link>
        </section>
      </div>
    );
  }

  const { status, etaMinutes } = result.status;
  const tone = statusTone(status);
  // Allowlist, fails safe — see TRACKABLE_STATUSES in lib/orderStatus. A
  // delivered or cancelled order gets no dead Track CTA.
  const trackable = TRACKABLE_STATUSES.has(status);
  return (
    <div data-stitch="dark" className="min-h-screen bg-[var(--bg)] text-ink">
      <section className="mx-auto max-w-md px-4 py-10">
        {/* Status card — the single largest, most prominent element on the
            screen. This is a confirmation, not a celebration: no confetti,
            no oversized checkmark, just the status the server actually sent. */}
        <div className="flex flex-col items-center text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-text">
            Order confirmed
          </p>
          <h1
            className={`mt-3 flex items-center justify-center gap-2.5 text-3xl font-semibold tracking-tight ${TONE_TEXT[tone]}`}
          >
            {tone === "live" && (
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-sage"
              />
            )}
            {statusLabel(status)}
          </h1>
          <p className="tabular mt-3 text-xs uppercase tracking-widest text-ink-faint">
            #{orderId}
          </p>
          {trackable && (
            <p className="mt-2 text-sm text-ink-muted">
              Estimated arrival in{" "}
              <span className="tabular font-semibold text-ink">{etaMinutes} min</span>
            </p>
          )}
          {tone === "failed" && (
            <p className="mt-3 text-sm font-semibold text-destructive">
              This order did not complete — you have not been charged for it.
            </p>
          )}
          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
            {trackable && (
              <Link
                href={`/track/${encodeURIComponent(orderId)}`}
                className="flex-1 rounded-full bg-gold px-6 py-3.5 text-center text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
              >
                Track live
              </Link>
            )}
            <Link
              href="/menu"
              className="flex-1 rounded-full border border-line-strong bg-transparent px-6 py-3.5 text-center text-sm font-semibold text-ink transition-colors hover:bg-surface-raised active:scale-[0.98]"
            >
              Back to the menu
            </Link>
          </div>
        </div>

        {/* Secondary, visually subordinate, stacked below a clear break from
            the status block above: perks the money event produced, then the
            generic next-steps grid. ThankYouRecommendations supplies its own
            border-top rule, so this wrapper only adds the gap beneath the hero. */}
        <div className="mt-10">
          <PlanPerks orderId={orderId} />
          <ThankYouRecommendations />
        </div>
      </section>
    </div>
  );
}
