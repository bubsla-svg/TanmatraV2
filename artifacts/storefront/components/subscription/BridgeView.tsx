"use client";
// Client: interactive conversion bridge for 3-day trial pack graduates.
// Real, server-verified gate — never claims a credit is reserved without
// confirming (a) the caller owns this subscription and (b) it's still a
// live/eligible trial. 401 → inline PhoneAuth, never a redirect.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { TRIAL_CREDITBACK_PAISE } from "@/lib/trial";
import { trialRecap } from "@/lib/subscriptionsApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

type BridgeState =
  | { status: "loading" }
  | { status: "needs-auth" }
  | { status: "not-found" }
  | { status: "ineligible" }
  | { status: "error"; message: string }
  | { status: "ready" };

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
    return <p className="text-sm text-ink-muted">Checking your trial status…</p>;
  }

  if (state.status === "needs-auth") {
    return (
      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-3">
        <p className="text-sm text-ink-muted">Sign in to see your trial credit status.</p>
        <PhoneAuth onVerified={() => load()} />
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">We couldn&rsquo;t find that trial</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          Check your <Link href="/account/subscriptions" className="font-medium text-gold-text hover:underline">subscriptions</Link> for your current trial status.
        </p>
      </div>
    );
  }

  if (state.status === "ineligible") {
    return (
      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">This trial credit isn&rsquo;t available anymore</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          It&rsquo;s already been redeemed or the trial has ended. See your <Link href="/account/subscriptions" className="font-medium text-gold-text hover:underline">active plan</Link>.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-3">
        <p className="text-sm font-medium text-[var(--danger)]">{state.message}</p>
        <button type="button" onClick={() => load()} className="self-start rounded-lg border border-line px-4 py-2 text-xs font-semibold text-gold-text hover:opacity-80">
          Try again
        </button>
      </div>
    );
  }

  const creditLabel = formatPaise(TRIAL_CREDITBACK_PAISE);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-3">
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

      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink">What unlocks with your full subscription</h3>
        <ul className="flex flex-col gap-2.5 text-sm text-ink-muted">
          <li className="flex items-start gap-2">
            <span className="text-gold-text font-bold">&check;</span>
            <span>Dedicated Registered Dietitian consultation & weekly meal schedule oversight.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-text font-bold">&check;</span>
            <span>Flexible pause and calendar skipping up to 24 hours before delivery.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-text font-bold">&check;</span>
            <span>Strict macro calorie targets and medical condition contraindication gates.</span>
          </li>
        </ul>

        <Link
          href="/plans"
          className="mt-2 flex w-full items-center justify-center rounded-xl bg-gold py-3.5 text-sm font-semibold text-[var(--gold-ink)] shadow-sm hover:bg-gold/90 transition-colors"
        >
          Explore Dietitian Meal Plans &mdash; Claim {creditLabel} Credit
        </Link>
      </div>
    </div>
  );
}
