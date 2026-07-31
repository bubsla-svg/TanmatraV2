"use client";
// Client: interactive conversion bridge for 3-day trial pack graduates.
// Real, server-verified gate — never claims a credit is reserved without
// confirming (a) the caller owns this subscription and (b) it's still a
// live/eligible trial. 401 → inline PhoneAuth, never a redirect.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Ban, CheckCircle2, Loader2, Lock, SearchX } from "lucide-react";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { TRIAL_CREDITBACK_PAISE } from "@/lib/trial";
import { trialRecap } from "@/lib/subscriptionsApi";
import { Button } from "@/components/ui/button";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

type BridgeState =
  | { status: "loading" }
  | { status: "needs-auth" }
  | { status: "not-found" }
  | { status: "ineligible" }
  | { status: "error"; message: string }
  | { status: "ready" };

// Shared dark-scope card shell (data-stitch="dark" on the page wrapper — see
// AlacarteDetails.tsx for the same pattern). Every non-"ready" state renders
// inside one of these two variants so the five honest states read as one
// coherent screen rather than five ad-hoc looks.
const CARD = "rounded-2xl border border-line bg-surface p-6 flex flex-col gap-3";
const CARD_CENTERED = `${CARD} items-center gap-2 text-center`;

export function BridgeView() {
  const searchParams = useSearchParams();
  const subscriptionId = searchParams.get("subscription_id");
  const [state, setState] = useState<BridgeState>({ status: "loading" });

  const load = useCallback(() => {
    if (!subscriptionId) {
      setState({ status: "not-found" });
      return;
    }
    const id = Number(subscriptionId);
    setState({ status: "loading" });
    trialRecap(id)
      .then(() => setState({ status: "ready" }))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) setState({ status: "needs-auth" });
        else if (e instanceof ApiError && e.status === 404) setState({ status: "not-found" });
        else if (e instanceof ApiError && e.status === 400) setState({ status: "ineligible" });
        else setState({ status: "error", message: e instanceof ApiError ? e.message : "Couldn't load your trial status." });
      });
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  if (state.status === "loading") {
    return (
      <div className={CARD_CENTERED}>
        <Loader2 className="size-6 animate-spin text-gold-text" aria-hidden="true" />
        <p className="text-sm text-ink-muted">Checking your trial status…</p>
      </div>
    );
  }

  if (state.status === "needs-auth") {
    return (
      <div className={CARD}>
        <div className="flex items-center gap-2">
          <Lock className="size-5 shrink-0 text-gold-text" aria-hidden="true" />
          <p className="text-sm font-medium text-ink">Sign in to see your trial credit status.</p>
        </div>
        <PhoneAuth onVerified={() => load()} />
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className={CARD_CENTERED}>
        <SearchX className="size-7 text-ink-faint" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-ink">We couldn&rsquo;t find that trial</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          Check your <Link href="/account/subscriptions" className="font-medium text-gold-text hover:underline">subscriptions</Link> for your current trial status.
        </p>
      </div>
    );
  }

  if (state.status === "ineligible") {
    return (
      <div className={CARD_CENTERED}>
        <Ban className="size-7 text-ink-faint" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-ink">This trial credit isn&rsquo;t available anymore</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          It&rsquo;s already been redeemed or the trial has ended. See your <Link href="/account/subscriptions" className="font-medium text-gold-text hover:underline">active plan</Link>.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={CARD}>
        <div className="flex items-center gap-2">
          <AlertCircle className="size-5 shrink-0 text-[var(--danger)]" aria-hidden="true" />
          <p className="text-sm font-medium text-[var(--danger)]">{state.message}</p>
        </div>
        <button type="button" onClick={() => load()} className="self-start rounded-full border border-line px-4 py-2 text-xs font-semibold text-gold-text hover:opacity-80">
          Try again
        </button>
      </div>
    );
  }

  const creditLabel = formatPaise(TRIAL_CREDITBACK_PAISE);

  return (
    <div className="flex flex-col gap-6">
      <div className={CARD}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
            Trial Complete &mdash; Step Up
          </span>
          {subscriptionId && (
            <span className="tabular text-xs text-ink-muted">Ref: #{subscriptionId}</span>
          )}
        </div>
        <h2 className="text-xl font-semibold text-ink">
          Your {creditLabel} Trial Credit is Reserved
        </h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          You have successfully experienced our clinical culinary standards. When you activate your monthly or fortnightly meal subscription today, your full trial payment of {creditLabel} will automatically be credited against your very first bill.
        </p>
      </div>

      <div className={`${CARD} gap-4`}>
        <h3 className="text-sm font-semibold text-ink border-b border-line pb-3">What unlocks with your full subscription</h3>
        <ul className="flex flex-col gap-3 text-sm text-ink-muted">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden="true" />
            <span>Dedicated Registered Dietitian consultation & weekly meal schedule oversight.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden="true" />
            <span>Flexible pause and calendar skipping up to 24 hours before delivery.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden="true" />
            <span>Strict macro calorie targets and medical condition contraindication gates.</span>
          </li>
        </ul>
      </div>

      {/* Glass sticky footer — the ONE money-bearing CTA on this screen
          (Batch 4/Brief 23 vocabulary, same treatment as /trial's TrialStart
          and /checkout's CheckoutPay). bottom-16/md:bottom-0 clears the
          global MobileBottomNav band on mobile. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:bottom-0">
        <div className="mx-auto max-w-md px-4 py-3">
          <Button
            asChild
            shape="pill"
            size="fluid"
            className="flex w-full items-center justify-center px-8 py-4 text-center font-semibold"
          >
            <Link href="/plans">
              Explore Dietitian Meal Plans &mdash; Claim {creditLabel} Credit
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
