"use client";
// Client: per-subscription loyalty progress. Read-only — the credit itself
// is issued by a server-side sweep (loyaltyEngine.checkLoyalty), never
// triggered from this page. Joins GET /loyalty/progress (delivery counters)
// with GET /subscriptions (cadence label + this plan's OWN
// pricePerDeliveryPaise, which is exactly the free-delivery reward's value —
// checkLoyalty credits that same field — so this never invents a number the
// server doesn't also bill from).
import { useEffect, useState } from "react";
import { formatPaise } from "@/lib/format";
import { getSubscriptions, type Subscription } from "@/lib/subscriptionsApi";
import { getLoyaltyProgress, type SubscriptionLoyaltyProgress } from "@/lib/loyaltyApi";

interface Row {
  sub: Subscription;
  progress: SubscriptionLoyaltyProgress;
}

export function LoyaltyProgressPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [{ subscriptions }, { progress }] = await Promise.all([getSubscriptions(), getLoyaltyProgress()]);
        const byId = new Map(subscriptions.map((s) => [s.id, s]));
        setRows(
          progress
            .map((p) => {
              const sub = byId.get(p.subscriptionId);
              return sub ? { sub, progress: p } : null;
            })
            .filter((r): r is Row => r !== null),
        );
      } catch {
        // Best-effort secondary panel — a failure here shouldn't block the
        // referral panel above it from being useful.
        setError("Couldn't load your plan rewards.");
      }
    })();
  }, []);

  if (error) return <p className="text-xs text-ink-faint">{error}</p>;
  if (rows === null) return <p className="text-sm text-ink-muted">Loading your plan rewards…</p>;
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Plan rewards</p>
      <ul className="flex flex-col gap-3">
        {rows.map(({ sub, progress: p }) => (
          <li key={p.subscriptionId} className="rounded-xl border border-line bg-surface p-5">
            <p className="text-base font-semibold text-ink">
              {sub.cadence} · {sub.mealsPerDelivery} meals / delivery
            </p>
            <p className="tabular mt-1.5 text-sm text-ink-muted">{p.deliveredCount} delivered</p>
            <p className="mt-1 text-sm text-ink-muted">
              {p.deliveriesUntilFree} more for a free delivery ({formatPaise(sub.pricePerDeliveryPaise)})
            </p>
            {p.premiumUnlocked ? (
              <span className="mt-3 inline-block rounded-full bg-sage-soft px-3 py-1 text-xs font-medium text-sage-text">
                One-time loyalty bonus earned
              </span>
            ) : (
              <p className="mt-1 text-xs text-ink-muted">{p.deliveriesUntilPremium} more for a one-time loyalty bonus</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
