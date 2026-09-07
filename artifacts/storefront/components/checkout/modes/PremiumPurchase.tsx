"use client";
// Client island: the Premium money path, hosted on /checkout. "use client"
// because the price is a session-gated read and the runner beneath owns the
// Razorpay modal.
import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { getPremium } from "@/lib/premiumApi";
import { premiumSteps } from "@/lib/purchaseSteps";
import { PhoneAuth } from "../PhoneAuth";
import { PurchaseRunner } from "../PurchaseRunner";
import { PurchaseSummary } from "./PurchaseSummary";

/**
 * Joining Tanmatra Premium. The Join button on /premium used to open Razorpay
 * where it stood, with no captured-but-unverified state at all: a verify blip
 * left the customer charged, un-activated, and looking at a Join button that
 * had re-enabled itself. Routing it through the shared checkout fixes that by
 * construction.
 */
export function PremiumPurchase() {
  const premium = useQuery({ queryKey: ["account", "premium"], queryFn: () => getPremium() });
  const price = premium.data?.pricePaise;
  const steps = useMemo(
    () => premiumSteps(price === undefined ? "Join Premium" : `Pay ${formatPaise(price)}`),
    [price],
  );

  if (premium.error instanceof ApiError && premium.error.status === 401) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-ink-muted">Sign in to join Tanmatra Premium.</p>
        <PhoneAuth startExpanded onVerified={() => void premium.refetch()} />
      </div>
    );
  }

  if (premium.isPending) {
    return (
      <div aria-busy className="rounded-2xl border border-line bg-surface p-5">
        <p className="sr-only">Loading Premium…</p>
        <div aria-hidden className="h-24 animate-pulse rounded-lg bg-secondary" />
      </div>
    );
  }

  if (premium.isError) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm font-semibold text-danger">Couldn&rsquo;t load Premium</p>
        <button
          type="button"
          onClick={() => void premium.refetch()}
          className="mt-3 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-primary transition-opacity hover:opacity-80"
        >
          Try again
        </button>
      </div>
    );
  }

  // Already a member — there is nothing to charge for, and the checkout must
  // say so rather than offering a second month up front.
  if (premium.data.isPremium) {
    return (
      <PurchaseSummary title="You're already a member" lines={[]}>
        <Link href="/premium" className="text-sm font-semibold text-primary hover:underline">
          Manage your membership
        </Link>
      </PurchaseSummary>
    );
  }

  return (
    <>
      <PurchaseSummary
        title="Tanmatra Premium"
        lines={[{ label: "Monthly membership", value: formatPaise(premium.data.pricePaise) }]}
        note="Renews monthly. Cancel anytime — you keep the period you've paid for."
      />
      <PurchaseRunner
        steps={steps}
        description="Tanmatra Premium"
        amountPaise={premium.data.pricePaise}
        kind="premium"
        authPrompt="Sign in to join Tanmatra Premium."
      />
    </>
  );
}
