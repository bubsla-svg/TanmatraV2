"use client";
// Client: owns the subscription list + lifecycle transitions against the api.
import { useState } from "react";
import Link from "next/link";
import { Gift } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { emitFunnel, type FunnelEvent } from "@/lib/funnel";
import {
  getSubscriptions,
  getMealCredits,
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
 * Which funnel event each action reports once the SERVER has accepted it.
 *
 * PARTIAL on purpose. `reactivate-billing` restarts a lapsed UPI mandate — it
 * is a payment-rail recovery, not a lifecycle decision the customer made about
 * the plan, and folding it into `subscription_resumed` would count a failed
 * card being fixed as a customer un-pausing. It belongs with the payment
 * events if it is ever measured; tsc caught the omission, which is why the
 * type is Partial rather than silently defaulting.
 */
const ACTION_EVENT: Partial<Record<SubAction, FunnelEvent>> = {
  pause: "subscription_paused",
  resume: "subscription_resumed",
  cancel: "subscription_cancelled",
};

/**
 * SF-08 subscription management. Session-gated (401 → inline Firebase sign-in);
 * every transition hits the real /subscriptions/:id endpoints, which own the
 * legal-transition rules (409 on an illegal move), so this just reflects the
 * server's responses. Cancel is confirmed — it's a money-committed action.
 */
export function SubscriptionManager() {
  const queryClient = useQueryClient();
  // Distinct from the list-load error below — shown inline above an already
  // loaded list rather than replacing it.
  const [actionError, setActionError] = useState<string | null>(null);
  // An action (not the initial load) can 401 mid-session; tracked separately
  // since it isn't captured by subsQuery's own error state.
  const [actionAuthExpired, setActionAuthExpired] = useState(false);
  // Per-id, not a single scalar: acting on row B must not re-enable row A while
  // A's transition is still in flight (which would allow a double-submit).
  const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(new Set());

  const subsQuery = useQuery({
    queryKey: ["account", "subscription"],
    queryFn: () => getSubscriptions().then((r) => r.subscriptions),
  });

  // Best-effort: the credits chip is informational — its failure must never
  // block the list. Nested under the subscription key so an invalidate of
  // ["account", "subscription"] (after any action) refreshes both together,
  // same as the old load() reloading subs + credits in one pass.
  const creditsQuery = useQuery({
    queryKey: ["account", "subscription", "credits"],
    queryFn: () => getMealCredits().then((r) => r.balance),
    enabled: subsQuery.isSuccess,
    retry: false,
  });
  const creditBalance = creditsQuery.data ?? null;

  const actionMutation = useMutation({
    mutationFn: ({ sub, action }: { sub: Subscription; action: SubAction }) => ACTION_FN[action](sub.id),
  });

  const needsAuth = actionAuthExpired || (subsQuery.isError && isAuthExpired(subsQuery.error));

  function retry() {
    setActionAuthExpired(false);
    void queryClient.invalidateQueries({ queryKey: ["account", "subscription"] });
  }

  async function act(sub: Subscription, action: SubAction) {
    if (action === "cancel" && !window.confirm("Cancel this plan? Upcoming deliveries stop and billing ends.")) {
      return;
    }
    setBusyIds((prev) => new Set(prev).add(sub.id));
    setActionError(null);
    try {
      await actionMutation.mutateAsync({ sub, action });
      // Emitted AFTER the await, so only an action the server accepted is
      // counted. Reporting on the tap would inflate every retention number by
      // the refusals — the opposite of what the scoreboard is for.
      const event = ACTION_EVENT[action];
      if (event) emitFunnel(event, { subscription_id: sub.id, cadence: sub.cadence });
      await queryClient.invalidateQueries({ queryKey: ["account", "subscription"] });
    } catch (e) {
      if (isAuthExpired(e)) {
        setActionAuthExpired(true);
      } else {
        setActionError(e instanceof ApiError ? e.message : "Couldn't update the plan.");
      }
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
        <PhoneAuth startExpanded onVerified={() => retry()} />
      </div>
    );
  }

  if (subsQuery.isPending) {
    return <p className="text-sm text-ink-muted">Loading your plans…</p>;
  }

  // Finding #14-pattern: a non-auth load failure gets its own error+retry
  // state instead of collapsing into the signed-out UI or a dead-end message.
  if (subsQuery.isError) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">
          {subsQuery.error instanceof ApiError ? subsQuery.error.message : "Couldn't load your plans."}
        </p>
        <button
          type="button"
          onClick={() => void subsQuery.refetch()}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-line-strong bg-surface px-4 text-sm font-bold text-ink transition-colors hover:bg-surface-raised"
        >
          Try again
        </button>
      </div>
    );
  }

  const subs = subsQuery.data;

  return (
    <div className="flex flex-col gap-4">
      {creditBalance !== null && creditBalance > 0 && (
        <p className="tabular inline-flex items-center gap-1.5 self-start rounded-full bg-sage-soft px-3.5 py-1.5 text-xs font-medium text-sage-text">
          <Gift aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {creditBalance} meal credit{creditBalance === 1 ? "" : "s"} — skipped deliveries come back as credits
        </p>
      )}
      {actionError && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{actionError}</p>}
      {subs.length === 0 ? (
        <p className="text-sm text-ink-muted">
          You don&rsquo;t have any plans yet.{" "}
          <Link href="/plans" className="font-semibold text-primary underline-offset-4 hover:underline">Browse plans</Link>.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {subs.map((s) => (
            <SubscriptionCard
              key={s.id}
              sub={s}
              busy={busyIds.has(s.id)}
              onAction={(a) => void act(s, a)}
              onChanged={() => void queryClient.invalidateQueries({ queryKey: ["account", "subscription"] })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
