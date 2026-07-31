"use client";
// Client: owns the ONE session gate shared by the referral + loyalty-progress
// panels (mirrors SubscriptionManager's 401 → inline PhoneAuth) so a lapsed
// session shows a single sign-in prompt, not two independent ones. Fetch is
// via TanStack Query.
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { getMyReferral } from "@/lib/referralApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { ReferralPanel } from "./ReferralPanel";
import { LoyaltyProgressPanel } from "./LoyaltyProgressPanel";

const REFERRAL_KEY = ["account", "loyalty"] as const;

/**
 * Loading / error / empty are three distinct states (audit #17) — a failed
 * fetch used to render as plain muted text, visually indistinguishable from
 * "still loading", with no way to retry short of a full page reload.
 */
export function LoyaltyHub() {
  const {
    data: referral,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: REFERRAL_KEY,
    queryFn: () => getMyReferral(),
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-6" aria-hidden>
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 401) {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted">Sign in to see your referral code and loyalty rewards.</p>
          <PhoneAuth onVerified={() => void refetch()} />
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load your rewards</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">
          Something went wrong on our end — this usually clears up on retry.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-opacity hover:opacity-80"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ReferralPanel data={referral} />
      <LoyaltyProgressPanel />
    </div>
  );
}
