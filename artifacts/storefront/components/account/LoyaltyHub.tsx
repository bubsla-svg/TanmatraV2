"use client";
// Client: owns the ONE session gate shared by the referral + loyalty-progress
// panels (mirrors SubscriptionManager's 401 → inline PhoneAuth) so a lapsed
// session shows a single sign-in prompt, not two independent ones.
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { getMyReferral, type ReferralMe } from "@/lib/referralApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { ReferralPanel } from "./ReferralPanel";
import { LoyaltyProgressPanel } from "./LoyaltyProgressPanel";

export function LoyaltyHub() {
  const [referral, setReferral] = useState<ReferralMe | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getMyReferral();
      setReferral(data);
      setNeedsAuth(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else setError(e instanceof ApiError ? e.message : "Couldn't load your referral code.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to see your referral code and loyalty rewards.</p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }

  if (referral === null) {
    return <p className="text-sm text-ink-muted">{error ?? "Loading your rewards…"}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      <ReferralPanel data={referral} />
      <LoyaltyProgressPanel />
    </div>
  );
}
