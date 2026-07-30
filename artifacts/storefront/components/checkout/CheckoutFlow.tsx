"use client";
// Client: the checkout is a screen state machine with the sticky total held
// identical across screens (CLS = 0) — inherently interactive.

import { useState } from "react";
import Link from "next/link";
import { screensForUser, type CheckoutUser } from "@/lib/checkout";
import { emitFunnel } from "@/lib/funnel";
import { formatPaise } from "@/lib/format";
import { LIVE_CHECKOUT_ENABLED } from "@/lib/flags";
import { CheckoutIdentity } from "./CheckoutIdentity";
import { CheckoutAddress } from "./CheckoutAddress";
import { CheckoutPay } from "./CheckoutPay";
import { EveningAddOffer } from "./EveningAddOffer";

interface Props {
  planId: string;
  planSummary: string;
  totalPaise: number;
  futureLine: string;
  user: CheckoutUser;
  /** Trial creditback applied to this bill (paise). 0 = none. The server is the
   *  authority on eligibility (#287); this is the applied amount to display. */
  creditPaise?: number;
  /** Evening Add price (paise) when the plan permits it — offered post-purchase
   *  on the confirmation screen (02d stage 8). null = not offered. */
  eveningAddPaise?: number | null;
}

/**
 * Breeze checkout orchestrator (02c). Walks the user's screen set (new = 3,
 * returning = 1), one decision per screen. OTP / address / UPI are stubbed to
 * advance — those are the live-env seams (real WebOTP, serviceability, and the
 * OS UPI intent land with the api-server + gateway wiring).
 */
export function CheckoutFlow({
  planId,
  planSummary,
  totalPaise,
  futureLine,
  user,
  creditPaise = 0,
  eveningAddPaise = null,
}: Props) {
  const screens = screensForUser(user);
  const [i, setI] = useState(0);
  const [paid, setPaid] = useState(false);
  const [notLive, setNotLive] = useState(false);
  const advance = () => setI((n) => Math.min(n + 1, screens.length - 1));

  function pay() {
    if (LIVE_CHECKOUT_ENABLED) {
      // The plan-purchase money path (createSubscription + members intake +
      // FLAG_PLAN_V2 + Razorpay) lands in the plan-v2 wave. Behind the live
      // flag we must never fabricate a receipt — fail LOUD and point at the
      // à-la-carte path that IS live. (The skeleton receipt below only renders
      // in a flag-dark preview build.)
      setNotLive(true);
      return;
    }
    emitFunnel("cuj_paid", { planId, total: totalPaise });
    setPaid(true);
  }

  if (notLive) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-xl font-semibold text-ink">Plan checkout is finishing its wiring</h1>
        <p className="text-sm text-ink-muted">
          Subscription purchase goes live in the next wave. Ordering individual
          dishes from the menu is live now.
        </p>
        <Link href="/menu" className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]">
          Order from the menu
        </Link>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-mono tabular text-2xl font-semibold text-ink">{formatPaise(totalPaise)} paid.</h1>
          <p className="text-sm text-ink-muted">First lunch next weekday, 12:30&ndash;1:30. {futureLine}</p>
        </div>
        {eveningAddPaise != null && <EveningAddOffer pricePaise={eveningAddPaise} />}
        <a href="/plans" className="-m-2 self-start p-2 text-sm font-medium text-gold-text">
          Manage your plan &rarr;
        </a>
      </div>
    );
  }

  const screen = screens[i];
  const step = i + 1;
  const total = screens.length;

  if (screen === "identity") {
    return <CheckoutIdentity planSummary={planSummary} step={step} total={total} onSubmitPhone={advance} />;
  }
  if (screen === "address") {
    return <CheckoutAddress step={step} total={total} onDeliver={advance} />;
  }
  return (
    <CheckoutPay
      step={step}
      stepCount={total}
      totalPaise={totalPaise}
      planSummary={planSummary}
      futureLine={futureLine}
      creditPaise={creditPaise}
      onPay={pay}
    />
  );
}
