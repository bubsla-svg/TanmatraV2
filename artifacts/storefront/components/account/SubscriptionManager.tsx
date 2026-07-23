"use client";
// Client: owns the subscription list + lifecycle transitions against the api.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import {
  getSubscriptions,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  reactivateSubscriptionBilling,
  type Subscription,
} from "@/lib/subscriptionsApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { SubscriptionCard, type SubAction } from "./SubscriptionCard";

/** A 401 mid-session means the sid session lapsed — route back to sign-in. */
function isAuthExpired(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

const ACTION_FN: Record<SubAction, (id: number) => Promise<unknown>> = {
  pause: pauseSubscription,
  resume: resumeSubscription,
  cancel: cancelSubscription,
  "reactivate-billing": reactivateSubscriptionBilling,
};

/**
 * SF-08 subscription management. Session-gated (401 → inline Firebase sign-in);
 * every transition hits the real /subscriptions/:id endpoints, which own the
 * legal-transition rules (409 on an illegal move), so this just reflects the
 * server's responses. Cancel is confirmed — it's a money-committed action.
 */
export function SubscriptionManager() {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-id, not a single scalar: acting on row B must not re-enable row A while
  // A's transition is still in flight (which would allow a double-submit).
  const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const { subscriptions } = await getSubscriptions();
      setSubs(subscriptions);
      setNeedsAuth(false);
    } catch (e) {
      if (isAuthExpired(e)) setNeedsAuth(true);
      else setError(e instanceof ApiError ? e.message : "Couldn't load your plans.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(sub: Subscription, action: SubAction) {
    if (action === "cancel" && !window.confirm("Cancel this plan? Upcoming deliveries stop and billing ends.")) {
      return;
    }
    setBusyIds((prev) => new Set(prev).add(sub.id));
    setError(null);
    try {
      await ACTION_FN[action](sub.id);
      await load();
    } catch (e) {
      if (isAuthExpired(e)) {
        setNeedsAuth(true);
        return;
      }
      setError(e instanceof ApiError ? e.message : "Couldn't update the plan.");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(sub.id);
        return next;
      });
    }
  }

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to view and manage your plans.</p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }

  if (subs === null) {
    return <p className="text-sm text-ink-muted">{error ?? "Loading your plans…"}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      {subs.length === 0 ? (
        <p className="text-sm text-ink-muted">
          You don&rsquo;t have any plans yet.{" "}
          <Link href="/plans" className="font-medium text-gold-text hover:underline">Browse plans</Link>.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {subs.map((s) => (
            <SubscriptionCard key={s.id} sub={s} busy={busyIds.has(s.id)} onAction={(a) => void act(s, a)} />
          ))}
        </ul>
      )}
    </div>
  );
}
