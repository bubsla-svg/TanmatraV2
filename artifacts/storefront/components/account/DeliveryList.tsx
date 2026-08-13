"use client";
// Client: owns one subscription's delivery schedule + skip/restore actions,
// via TanStack Query (read = useQuery, skip/unskip = useMutation that
// invalidates the detail query on success rather than hand-patching state).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import {
  getSubscription,
  skipDelivery,
  unskipDelivery,
  type SubscriptionDelivery,
} from "@/lib/subscriptionsApi";
import { Skeleton } from "@/components/ui/skeleton";
import { ManageDeliverySheet } from "./ManageDeliverySheet";

const SHOW_AT_MOST = 4;

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Upcoming deliveries for one subscription (SF-10 tail / CUJ-05): skip and
 * restore against the per-delivery seams. The server owns the rules — the 24h
 * cutoff (409 past_cutoff, surfaced verbatim) and the credit grant/clawback —
 * so every action invalidates the detail query; nothing here is optimistic.
 * The active-mandate line states autopay honestly from the detail response.
 *
 * Loading / error / empty were previously collapsed into one paragraph
 * (`{error ?? "Loading…"}`) — same class of bug as audit #17 — now three
 * distinct states, the error one with a retry.
 */
export function DeliveryList({ subscriptionId }: { subscriptionId: number }) {
  const queryClient = useQueryClient();
  const queryKey = ["account", "deliveries", subscriptionId] as const;

  const {
    data: detail,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => getSubscription(subscriptionId),
  });

  const [mutationError, setMutationError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(new Set());
  const [managing, setManaging] = useState<SubscriptionDelivery | null>(null);

  const act = useMutation({
    mutationFn: (d: SubscriptionDelivery) => (d.status === "skipped" ? unskipDelivery(d.id) : skipDelivery(d.id)),
    onMutate: (d) => {
      setMutationError(null);
      setBusyIds((prev) => new Set(prev).add(d.id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (e) => {
      // past_cutoff and friends arrive as the server's own sentence — show it.
      setMutationError(e instanceof ApiError ? e.message : "Couldn't update that delivery.");
    },
    onSettled: (_data, _err, d) => {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(d.id);
        return next;
      });
    },
  });

  if (isPending) {
    return (
      <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-4" aria-hidden>
        <Skeleton className="h-9 w-full rounded-xl" />
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-3 flex flex-col items-start gap-2 border-t border-line pt-4">
        <p role="alert" className="text-xs font-medium text-[var(--danger)]">
          {error instanceof ApiError ? error.message : "Couldn't load the delivery schedule."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-xs font-semibold text-gold-text hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const rows = detail.deliveries
    .filter((d) => d.status === "upcoming" || d.status === "skipped")
    .slice(0, SHOW_AT_MOST);

  return (
    <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-4">
      {detail.mandate && (
        <p className="inline-flex w-fit items-center gap-1.5 self-start rounded-full bg-sage-soft px-3 py-1 text-xs font-medium text-sage-text">
          UPI Autopay active — you&rsquo;ll be notified at least 24h before each charge.
        </p>
      )}
      {mutationError && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{mutationError}</p>}
      {rows.length === 0 ? (
        <p className="text-xs text-ink-muted">No upcoming deliveries on the schedule.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2.5 text-sm">
              <span className={d.status === "skipped" ? "text-ink-faint line-through" : "text-ink"}>
                {fmtDay(d.scheduledFor)}
                {d.deliveryWindow ? <span className="text-ink-faint"> · {d.deliveryWindow}</span> : null}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {d.status === "upcoming" && (
                  <button
                    type="button"
                    disabled={busyIds.has(d.id)}
                    onClick={() => setManaging(d)}
                    className="-m-1 p-1 text-xs font-medium text-gold-text hover:underline disabled:opacity-40"
                  >
                    Manage
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyIds.has(d.id)}
                  onClick={() => act.mutate(d)}
                  className="-m-1 p-1 text-xs font-medium text-gold-text hover:underline disabled:opacity-40"
                >
                  {d.status === "skipped" ? "Restore" : "Skip"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-0.5 text-2xs text-ink-faint">
        Skips up to 24h ahead come back as meal credits.
      </p>
      {managing && (
        <ManageDeliverySheet
          delivery={managing}
          onClose={() => setManaging(null)}
          onSaved={() => { setManaging(null); void queryClient.invalidateQueries({ queryKey }); }}
        />
      )}
    </div>
  );
}
