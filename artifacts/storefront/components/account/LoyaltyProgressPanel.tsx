"use client";
// Client: per-subscription loyalty progress, via TanStack Query. Read-only —
// the credit itself is issued by a server-side sweep (loyaltyEngine.checkLoyalty),
// never triggered from this page. Joins GET /loyalty/progress (delivery counters)
// with GET /subscriptions (cadence label + this plan's OWN
// pricePerDeliveryPaise, which is exactly the free-delivery reward's value —
// checkLoyalty credits that same field — so this never invents a number the
// server doesn't also bill from).
import { useQuery } from "@tanstack/react-query";
import { formatPaise } from "@/lib/format";
import { getSubscriptions, type Subscription } from "@/lib/subscriptionsApi";
import { getLoyaltyProgress, type SubscriptionLoyaltyProgress } from "@/lib/loyaltyApi";
import { Skeleton } from "@/components/ui/skeleton";

interface Row {
  sub: Subscription;
  progress: SubscriptionLoyaltyProgress;
}

const PROGRESS_KEY = ["account", "loyalty", "progress"] as const;

async function loadRows(): Promise<Row[]> {
  const [{ subscriptions }, { progress }] = await Promise.all([getSubscriptions(), getLoyaltyProgress()]);
  const byId = new Map(subscriptions.map((s) => [s.id, s]));
  return progress
    .map((p) => {
      const sub = byId.get(p.subscriptionId);
      return sub ? { sub, progress: p } : null;
    })
    .filter((r): r is Row => r !== null);
}

export function LoyaltyProgressPanel() {
  const { data: rows, isPending, isError, refetch } = useQuery({
    queryKey: PROGRESS_KEY,
    queryFn: loadRows,
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-3" aria-hidden>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    // Best-effort secondary panel — a failure here shouldn't block the
    // referral panel above it from being useful, but it still deserves a
    // way back other than a full page reload.
    return (
      <p className="text-xs text-ink-faint">
        Couldn&rsquo;t load your plan rewards.{" "}
        <button type="button" onClick={() => void refetch()} className="font-semibold text-primary underline-offset-4 hover:underline">
          Try again
        </button>
      </p>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Plan rewards</p>
      <ul className="flex flex-col gap-3">
        {rows.map(({ sub, progress: p }) => (
          <li key={p.subscriptionId} className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-display text-lg font-semibold leading-tight text-primary">
              {sub.cadence} · {sub.mealsPerDelivery} meals / delivery
            </p>
            <p className="font-data mt-1.5 text-sm text-ink-muted">{p.deliveredCount} delivered</p>
            <p className="font-data mt-1 text-sm text-ink-muted">
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
