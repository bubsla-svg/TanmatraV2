/**
 * The onward path out of any "we don't deliver there" surface.
 *
 * "We don't deliver to your pincode" with nothing to do next is a dead end,
 * and it is the LAST thing a visitor sees before they leave. The marketplace
 * ships shelf-stable items nationwide, so it is a real offer rather than a
 * consolation link — the delivery radius gates hot meals, not the whole
 * catalogue.
 *
 * Extracted from `NotifyMeForm` when a SECOND out-of-zone surface appeared
 * (the ambient address bar's undeliverable state). One definition means the
 * no-dead-end rule cannot be honoured on one surface and quietly missed on
 * the other — which is exactly how the 404-degraded branch went without it.
 *
 * Secondary styling, not gold: gold is the sole ACTION colour, and on every
 * surface that renders this the primary action is something else (capture the
 * number, or switch to a deliverable address). This is the alternative route
 * and it should read as one.
 */
import Link from "next/link";
export function MarketplaceFallbackCta() {
  return (
    <Link
      href="/marketplace"
      className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-line-strong hover:bg-surface-raised"
    >
      Shop the marketplace
      <span aria-hidden="true">&rarr;</span>
    </Link>
  );
}
