import type { Metadata } from "next";
import Link from "next/link";
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
      <section className="mx-auto max-w-xl px-4 py-10">
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
          className="mt-6 inline-block rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Back to the menu
        </Link>
      </section>
    );
  }

  const { status, etaMinutes } = result.status;
  const tone = statusTone(status);
  // Allowlist, fails safe — see TRACKABLE_STATUSES in lib/orderStatus. A
  // delivered or cancelled order gets no dead Track CTA.
  const trackable = TRACKABLE_STATUSES.has(status);
  return (
    <section className="mx-auto max-w-xl px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-wider text-sage-text">
        Order confirmed
      </p>
      <h1 className={`mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight ${TONE_TEXT[tone]}`}>
        {tone === "live" && (
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-sage" />
        )}
        {statusLabel(status)}
      </h1>
      <p className="tabular mt-1 text-sm text-ink-muted">#{orderId}</p>
      {trackable && (
        <p className="mt-3 text-sm text-ink-muted">
          Estimated arrival in{" "}
          <span className="tabular font-semibold text-ink">{etaMinutes} min</span>
        </p>
      )}
      {tone === "failed" && (
        <p className="mt-3 text-sm font-semibold text-destructive">
          This order did not complete — you have not been charged for it.
        </p>
      )}
      <div className="mt-6 flex gap-3">
        {trackable && (
          <Link
            href={`/track/${encodeURIComponent(orderId)}`}
            className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Track live
          </Link>
        )}
        <Link
          href="/menu"
          className="rounded-lg border border-line-strong px-5 py-3 text-sm font-semibold text-ink"
        >
          Back to the menu
        </Link>
      </div>
      <PlanPerks orderId={orderId} />
      <ThankYouRecommendations />
    </section>
  );
}
