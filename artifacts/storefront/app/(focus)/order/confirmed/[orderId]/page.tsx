import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fetchOrderStatus, statusLabel, statusTone, TRACKABLE_STATUSES } from "@/lib/orderStatus";
import { PlanPerks } from "@/components/order/PlanPerks";
import { ThankYouRecommendations } from "@/components/order/ThankYouRecommendations";
import { ClaimOrder } from "@/components/order/ClaimOrder";
import { ReferralShare } from "@/components/order/ReferralShare";

/** Tone → status-label colour — same mapping as route-12's OrderRow, so a
 *  customer landing here straight from checkout and later revisiting via
 *  /account/orders sees one consistent treatment, not two. */
const TONE_TEXT = {
  live: "text-sage-text",
  settled: "text-ink-muted",
  failed: "text-danger",
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
      <div className="min-h-dvh">
        <section className="mx-auto max-w-md px-4 py-10 text-center">
          <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">
            {result.kind === "not_found"
              ? "We can't find that order"
              : "We can't reach the kitchen right now"}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {result.kind === "not_found"
              ? "Check the link from your confirmation message."
              : "Your order is unaffected — try this page again in a moment."}
          </p>
          <Button asChild shape="pill" size="fluid" className="mt-8 inline-block px-6 py-3.5 font-semibold">
            <Link href="/menu">Back to the menu</Link>
          </Button>
        </section>
      </div>
    );
  }

  const { status, timing, etaMinutes, scheduledFor, deliveryWindow } = result.status;
  const tone = statusTone(status);
  // Allowlist, fails safe — see TRACKABLE_STATUSES in lib/orderStatus. A
  // delivered or cancelled order gets no dead Track CTA.
  const trackable = TRACKABLE_STATUSES.has(status);
  const scheduledLabel = scheduledFor
    ? new Date(scheduledFor).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : null;
  return (
    <div data-ui-generation="stitch-74" data-screen-id="8.3" data-screen-state="default" className="min-h-dvh">
      <section className="mx-auto max-w-md px-4 py-10">
        {/* Status card — the single largest, most prominent element on the
            screen. This is a confirmation, not a celebration: no confetti,
            no oversized checkmark, just the status the server actually sent. */}
        <div className="flex flex-col items-center text-center">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">
            Order confirmed
          </p>
          <h1
            className={`mt-3 flex items-center justify-center gap-2.5 font-display text-4xl font-semibold leading-[1] tracking-[-.03em] ${TONE_TEXT[tone]}`}
          >
            {tone === "live" && (
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-sage"
              />
            )}
            {statusLabel(status)}
          </h1>
          <p className="font-data mt-3 text-xs uppercase tracking-[.16em] text-ink-faint">
            #{orderId}
          </p>
          {trackable && timing === "on_demand" && (
            <p className="mt-2 text-sm text-ink-muted">
              Estimated arrival in{" "}
              <span className="font-data font-bold text-primary">{etaMinutes} min</span>
            </p>
          )}
          {trackable && timing === "scheduled" && (
            <p className="mt-2 text-sm text-ink-muted">
              Scheduled for{" "}
              <span className="font-semibold text-primary">{scheduledLabel}</span>
              {deliveryWindow && <span className="font-data"> · {deliveryWindow}</span>}
            </p>
          )}
          {/* Law 9: each of these states ends with what happens next. "pending"
              previously stated only the fact ("Confirming your delivery time.")
              and left the customer with nothing to expect or do; "failed" said
              what did not happen but not how to recover. */}
          {trackable && timing === "pending" && (
            <p className="mt-2 text-sm text-ink-muted">
              Confirming your delivery time — the kitchen usually confirms within a few
              minutes, and we&rsquo;ll text you as soon as it&rsquo;s set. Track live below for
              updates.
            </p>
          )}
          {tone === "failed" && (
            <p className="mt-3 text-sm font-semibold text-danger">
              This order did not complete — you have not been charged for it. Your cart is
              still saved, so you can head back to the menu and try again.
            </p>
          )}
          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
            {trackable && (
              <Button asChild shape="pill" size="fluid" className="flex-1 px-6 py-3.5 text-center font-semibold">
                <Link href={`/track/${encodeURIComponent(orderId)}`}>Track live</Link>
              </Button>
            )}
            <Button asChild variant="outline" shape="pill" size="fluid" className="flex-1 border-line-strong bg-transparent px-6 py-3.5 text-center font-semibold">
              <Link href="/menu">Back to the menu</Link>
            </Button>
          </div>
        </div>

        {/* Secondary, visually subordinate, stacked below a clear break from
            the status block above: perks the money event produced, then the
            generic next-steps grid. ThankYouRecommendations supplies its own
            border-top rule, so this wrapper only adds the gap beneath the hero. */}
        <div className="mt-10">
          <PlanPerks orderId={orderId} />
          {/* Above the recommendations on purpose: keeping the order is about
              the order they just placed, and it stops being offerable the
              moment they navigate away to a suggestion. Renders nothing at all
              for a customer who signed in during checkout — the order is
              already theirs. */}
          <ClaimOrder orderId={orderId} />
          {/* The acquisition loop closes here: the customer who just paid is
              handed their own /r/<code> link on day one, which is the cheapest
              new-customer channel this product has. Below ClaimOrder on
              purpose — a guest has to own the order before there is a code to
              give them, and ReferralShare renders nothing until they do. */}
          <ReferralShare />
          <ThankYouRecommendations />
        </div>
      </section>
    </div>
  );
}
