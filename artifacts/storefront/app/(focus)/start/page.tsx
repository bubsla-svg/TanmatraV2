import type { Metadata } from "next";
import Link from "next/link";
import { fetchMenu } from "@/lib/catalog";
import { buildSharedMacroKeys } from "@/lib/dishTrust";
import { formatPaise } from "@/lib/format";
import { fetchReferralOffer, type ReferralOffer } from "@/lib/referralOfferApi";
import { PLAN_DELIVERY_DAYS_SENTENCE, PLAN_DELIVERY_WINDOW_LABEL } from "@/lib/planCheckout";
import { normalizeReferralCode } from "@/lib/qrPlacement";
import { TRIAL_PRICE_PAISE } from "@/lib/trial";
import { resolveTrio } from "@/lib/trialTrio";
import { QrStart } from "@/components/start/QrStart";
import { QrTrio } from "@/components/start/QrTrio";
import { ReferralWelcome } from "@/components/start/ReferralWelcome";

export const metadata: Metadata = {
  title: "Three lunches, one price",
  description: "Three chef-cooked lunches delivered to your desk. One trial, never repeats.",
};

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

/**
 * The scan-to-paid landing — where every printed QR in the wild ends up.
 *
 * PROOF BEFORE THE ASK (Law 1), in that literal order down the page: what
 * arrives (three real dishes, real photography, real macros), what it costs
 * (the spine's price, not a number written here), when it comes — and only then
 * one field. A cold scanner has given us nothing and owes us nothing; asking
 * before showing is how that visit ends.
 *
 * SERVER-RENDERED except for the two decisions. The proof half is in the first
 * HTML chunk with no client bundle behind it, because a person standing in
 * front of a poster on mobile data judges this page in about a second. Only
 * `QrStart` — the PIN field and the veg/non-veg toggle — is a client island.
 *
 * NO INTERSTITIAL, NO APP PROMPT. The single most expensive thing this page
 * could do is ask a cold visitor to install something.
 */
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; src?: string }>;
}) {
  const { ref } = await searchParams;

  // The trio and the referral offer are independent reads — a slow referral
  // lookup must not delay the food, which is the part that sells.
  const code = ref ? normalizeReferralCode(ref) : null;
  const [{ dishes }, offer] = await Promise.all([
    fetchMenu(),
    code
      ? fetchReferralOffer(code, API_BASE).catch<ReferralOffer | null>(() => null)
      : Promise.resolve<ReferralOffer | null>(null),
  ]);
  const sharedMacroKeys = buildSharedMacroKeys(dishes);
  // Veg is shown to a visitor who has told us nothing, because it is the trio
  // everyone can eat — the toggle below re-renders nothing (both trios would
  // cost a second catalogue pass and a client bundle for a decision that only
  // changes three thumbnails after the PIN gate anyway).
  const trio = resolveTrio("veg", dishes, sharedMacroKeys);

  return (
    <div className="min-h-dvh">
      <section className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-8 pb-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-text">
            This week&rsquo;s taste test
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Three lunches for {formatPaise(TRIAL_PRICE_PAISE)}
          </h1>
          <p className="max-w-[300px] text-sm leading-relaxed text-ink-muted">
            All in — cooking, packaging and delivery included. Nothing added at checkout.
          </p>
        </div>

        <ReferralWelcome offer={offer} />

        <QrTrio dishes={trio} />

        {/* Law 1: what arrives, and when, stated before the field. Both
            constants are the ones `buildSubscriptionInput` books the delivery
            with, so this cannot drift from what is actually scheduled. */}
        <p className="text-center text-xs text-ink-muted">
          Delivered {PLAN_DELIVERY_DAYS_SENTENCE}, {PLAN_DELIVERY_WINDOW_LABEL}.
        </p>

        <QrStart pricePaise={TRIAL_PRICE_PAISE} />

        {/* "registered", not "licensed": the certificate on file is an FSSAI
            *Registration* (petty-FBO tier), and a Registration and a Licence
            are distinct instruments — declaring a Licence against a
            Registration number is a false declaration under §61 of the FSS
            Act. Same wording as TrialStart's trust line and the footer;
            lib/fssaiClaims.test.ts fails the build on any other spelling. */}
        <p className="text-center text-2xs text-ink-faint">
          FSSAI-registered, RD-reviewed kitchen · secure UPI checkout
        </p>

        {/* Law 3, in the only direction that exists here. This page is where a
            scan LANDS, so there is no history to go back to — `router.back()`
            would target the /q redirect that sent them here and bounce straight
            forward again. A visitor who is not ready to buy needs a way into
            the rest of the product, not a back button that loops. */}
        <p className="text-center text-xs text-ink-muted">
          Not ready?{" "}
          <Link href="/menu" className="font-medium underline text-gold-text hover:text-ink">
            Browse the full menu
          </Link>
        </p>
      </section>
    </div>
  );
}
