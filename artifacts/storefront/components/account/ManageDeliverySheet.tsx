"use client";
// Client: reschedule a delivery's date and/or swap its dishes. Both actions hit
// real server seams (subscriptions.ts's /reschedule and /swap) guarded by the
// same 24h cutoff as skip — SKIP_SWAP_CUTOFF_MS is imported from the shared,
// DB-free rules package so this can never drift from what the server enforces
// (CLAUDE.md: lib/subscription-rules holds the cutoff for exactly this reason).
import { useState } from "react";
import { Dialog } from "radix-ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isPastSkipCutoff } from "@workspace/subscription-rules";
import type { DishData } from "@workspace/menu-catalog";
import { apiGet, ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import {
  rescheduleDelivery,
  swapDelivery,
  type SubscriptionDelivery,
  type SubscriptionDeliveryItem,
} from "@/lib/subscriptionsApi";
import { useOverlayHistory } from "@/components/ui/useOverlayHistory";
import { Button } from "@/components/ui/button";
import { earliestReschedulableDateISO } from "@/lib/deliveryCutoff";
import { emitFunnel } from "@/lib/funnel";

function toDateInputValue(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Manage-delivery bottom sheet (SF-10 / Journey 5, audit 9.2): reschedule the
 * date, or swap one item's dish. The server re-validates everything (cutoff,
 * dish safety, macro cap) — this only reflects its response, never assumes.
 */
export function ManageDeliverySheet({
  delivery,
  onClose,
  onSaved,
}: {
  delivery: SubscriptionDelivery;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(toDateInputValue(delivery.scheduledFor));
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const items = delivery.items ?? [];
  const pastCutoff = isPastSkipCutoff(delivery.scheduledFor);

  useOverlayHistory(true, onClose);

  const reschedule = useMutation({
    mutationFn: () => rescheduleDelivery(delivery.id, { scheduledFor: date }),
    onSuccess: () => {
      emitFunnel("subscription_rescheduled", { subscription_id: delivery.subscriptionId });
      onSaved();
    },
  });

  const swap = useMutation({
    mutationFn: (dish: DishData) => {
      const nextItems: SubscriptionDeliveryItem[] = items.map((it, i) =>
        i === swapIndex
          ? { slug: dish.slug, name: dish.name, image: dish.image, quantity: it.quantity, unitPricePaise: dish.price, memberId: it.memberId }
          : it,
      );
      return swapDelivery(delivery.id, nextItems);
    },
    onSuccess: () => { setSwapIndex(null); onSaved(); },
  });

  const error = reschedule.error ?? swap.error;
  const errorMessage = error instanceof ApiError ? error.message : error ? "Something went wrong — try again." : null;
  const errorReasons = error instanceof ApiError ? error.reasons : undefined;

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] animate-fade-in bg-[var(--scrim)] backdrop-blur-sm" />
        <Dialog.Content data-ui-generation="stitch-74" data-screen-id="9.2" data-screen-state="manage-delivery-open"
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] max-h-[85vh] animate-dialog-in overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-4 shadow-lg sm:inset-x-auto sm:left-1/2 sm:top-20 sm:bottom-auto sm:w-[92vw] sm:max-w-md sm:-translate-x-1/2 sm:rounded-3xl sm:border"
        >
          {swapIndex !== null ? (
            <DishPicker
              currentSlug={items[swapIndex]?.slug}
              busy={swap.isPending}
              onCancel={() => setSwapIndex(null)}
              onPick={(dish) => swap.mutate(dish)}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <Dialog.Title className="text-sm font-semibold text-ink">
                Manage delivery — {fmtDay(delivery.scheduledFor)}
              </Dialog.Title>

              {pastCutoff && (
                <p className="rounded-xl bg-bg px-3 py-2 text-xs text-ink-muted">
                  This delivery is too close to its delivery time to change — it&rsquo;s already with the kitchen.
                </p>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-faint" htmlFor="reschedule-date">
                  Delivery date
                </label>
                <input
                  id="reschedule-date"
                  type="date"
                  value={date}
                  // Not today: the picker used to offer dates the app's own
                  // cutoff has already closed, so the customer chose one and
                  // the server refused it. Weekends are excluded too —
                  // nextWeekdayISO never schedules one.
                  min={earliestReschedulableDateISO()}
                  disabled={pastCutoff || reschedule.isPending}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus-visible:border-line-strong disabled:opacity-50"
                />
                <Button
                  type="button"
                  disabled={pastCutoff || reschedule.isPending || date === toDateInputValue(delivery.scheduledFor)}
                  aria-busy={reschedule.isPending}
                  aria-live="polite"
                  onClick={() => reschedule.mutate()}
                  shape="xl"
                  size="fluid"
                  className="self-start px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                >
                  {reschedule.isPending ? "Saving…" : "Save new date"}
                </Button>
              </div>

              {items.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Dishes on this delivery</p>
                  <ul className="flex flex-col gap-1.5">
                    {items.map((it, i) => (
                      <li key={`${it.slug}-${i}`} className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2.5 text-sm">
                        <span className="min-w-0 truncate text-ink">
                          {it.name}
                          {it.quantity > 1 ? <span className="text-ink-faint"> ×{it.quantity}</span> : null}
                        </span>
                        <button
                          type="button"
                          disabled={pastCutoff || swap.isPending}
                          onClick={() => setSwapIndex(i)}
                          className="-m-1 shrink-0 p-1 text-xs font-medium text-gold-text hover:underline disabled:opacity-40"
                        >
                          Swap
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {errorMessage && (
                <div role="alert" className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-[var(--danger)]">{errorMessage}</p>
                  {errorReasons?.map((r) => (
                    <p key={r} className="text-xs text-ink-muted">
                      &bull; {r}
                    </p>
                  ))}
                </div>
              )}

              <Dialog.Close className="mt-1 w-full rounded-full border border-line px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink">
                Close
              </Dialog.Close>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Live menu, client-fetched (same /menu/public seam as ReorderButton) — pick
 *  a replacement dish for one item. Unavailable dishes are excluded outright
 *  rather than shown-then-rejected (Invariant 18: don't offer what can't work). */
function DishPicker({
  currentSlug,
  busy,
  onCancel,
  onPick,
}: {
  currentSlug: string | undefined;
  busy: boolean;
  onCancel: () => void;
  onPick: (dish: DishData) => void;
}) {
  const menuQuery = useQuery({
    queryKey: ["menu", "public"],
    queryFn: () => apiGet<{ dishes: DishData[] }>("/menu/public"),
  });
  const dishes = (menuQuery.data?.dishes ?? []).filter((d) => d.isAvailable !== false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Dialog.Title className="text-sm font-semibold text-ink">Swap dish</Dialog.Title>
        <button type="button" onClick={onCancel} disabled={busy} className="-m-2 p-2 text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-40">
          Back
        </button>
      </div>
      <div className="max-h-[55vh] overflow-y-auto">
        {menuQuery.isPending && (
          <div aria-hidden className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-raised" />
            ))}
          </div>
        )}
        {menuQuery.isError && (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load the menu</p>
            <button type="button" onClick={() => void menuQuery.refetch()} className="rounded-lg border border-line px-4 py-1.5 text-xs font-semibold text-gold-text hover:opacity-80">
              Try again
            </button>
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {dishes.map((d) => (
            <li key={d.slug}>
              <button
                type="button"
                disabled={busy || d.slug === currentSlug}
                onClick={() => onPick(d)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-bg disabled:opacity-40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {d.name}
                    {d.slug === currentSlug ? <span className="text-ink-faint"> (current)</span> : null}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm font-semibold text-ink">{formatPaise(d.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
