import { formatPaise } from "@/lib/format";
import type { ReferralOffer } from "@/lib/referralOfferApi";

/**
 * "Rohit sent you …" — proof that the link was real, stated before any ask.
 *
 * THE AMOUNT IS THE SERVER'S, and that is the point of the whole round trip
 * behind this component. `refereeAwardPaise` is the same
 * `getLoyaltyConstantsSnapshot()` figure the redemption row is written with, so
 * this card cannot promise a number the ledger will not credit.
 *
 * THE TIMING IS THE SERVER'S TOO, and it is stated plainly rather than
 * flattered into an upfront discount. The loyalty engine releases the referee's
 * credit inside `finalizeOrder`, on their first qualifying order — so a landing
 * that showed a struck-through price and a lower total would be describing a
 * discount that does not exist at this checkout. Naming when the credit lands
 * costs a little conversion and keeps the promise true (Law 5).
 *
 * Renders nothing for an unknown code: a friend's mistyped link falls back to
 * the standing offer rather than to an apology (Law 10).
 */
export function ReferralWelcome({ offer }: { offer: ReferralOffer | null }) {
  if (!offer?.valid || offer.refereeAwardPaise <= 0) return null;
  const who = offer.referrerFirstName ?? "A friend";
  return (
    <div className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-center">
      <p className="text-sm font-semibold text-ink">
        {who} sent you {formatPaise(offer.refereeAwardPaise)}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        It lands as credit on your account once your first box is delivered — spend it
        on whatever you order next.
      </p>
    </div>
  );
}
