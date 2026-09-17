"use client";
// Client: React Query over the public delivery-slots endpoint.
import { useQuery } from "@tanstack/react-query";
import { fetchDeliverySlots } from "@/lib/deliverySlotsApi";
import { dayLabel, groupSlots, slotWindowLabel } from "@/lib/deliverySlots";

/**
 * "today 7–8 pm" — the next bookable delivery window, for the header's
 * "Delivering to 201301 · today 7–8 pm" line (T5). Fetched only once a PIN is
 * confirmed serviceable; null while loading, on failure, or when nothing is
 * bookable, so the pill never states a window it cannot honour. Same slots
 * and the same labels the checkout's picker uses, so the two cannot disagree.
 */
export function useNextDeliveryWindow(enabled: boolean): string | null {
  const slots = useQuery({
    queryKey: ["delivery", "slots"],
    queryFn: () => fetchDeliverySlots(),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  if (!enabled || !slots.data) return null;
  const now = new Date();
  const groups = groupSlots(slots.data, now);
  const next = groups.today[0] ?? groups.tomorrow[0] ?? groups.later[0]?.slots[0];
  if (!next) return null;
  return `${dayLabel(next.slotDate, now).toLowerCase()} ${slotWindowLabel(next)}`;
}
