import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/lib/apiBase";
import type { PlanId, DietTrack, AddOnId } from "@workspace/subscription-rules";

/** A server-quoted plan price (the plan-v2 quote response, S4). */
export interface PlanQuoteData {
  kind: "quote";
  planId: PlanId;
  track: DietTrack;
  mealsPerDelivery: number;
  pricePerMealPaise: number | null;
  pricePerDeliveryPaise: number;
  addOns: Array<{ id: AddOnId; pricePaise: number; cadence: string; attachPoint: string }>;
  addOnTotalPaise: number;
  gstPaise: number;
  totalPaise: number;
}

/** A zero-dead-end waitlist outcome (blocked plan / unserved track / bad add-on). */
export interface PlanWaitlist {
  kind: "waitlist";
  code: string;
  planId: PlanId;
  reasons?: string[];
}

export type PlanQuoteResult = PlanQuoteData | PlanWaitlist;

async function fetchPlanQuote(
  planId: PlanId,
  track: DietTrack,
  addOns: AddOnId[],
): Promise<PlanQuoteResult> {
  const res = await fetch(`${API_BASE}/subscriptions/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // cadence is required by the schema; plan-v2 ignores it but sends a valid value.
    body: JSON.stringify({ cadence: "monthly", planId, track, addOns }),
  });

  // A blocked/sales-led plan or unserved track is NOT an error — it is the
  // zero-dead-end waitlist branch (02e §7). The server answers 422 + waitlist.
  if (res.status === 422) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.waitlist === true) {
      return {
        kind: "waitlist",
        code: String(body.code ?? "unavailable"),
        planId,
        reasons: Array.isArray(body.reasons) ? (body.reasons as string[]) : undefined,
      };
    }
    throw new Error(`quote rejected: ${String(body.code ?? res.status)}`);
  }
  if (!res.ok) throw new Error(`quote failed: ${res.status}`);

  const data = (await res.json()) as Omit<PlanQuoteData, "kind">;
  return { kind: "quote", ...data };
}

/**
 * Fetch the server-authoritative plan-v2 quote for a plan × track (+ add-ons).
 * Returns a `quote` or a `waitlist` outcome; the client never computes price.
 * Only enabled when a planId is present (the goal router has resolved a plan).
 */
export function usePlanQuote(
  planId: PlanId | null,
  track: DietTrack,
  addOns: AddOnId[] = [],
) {
  return useQuery({
    queryKey: ["plan-quote", planId, track, [...addOns].sort()],
    queryFn: () => fetchPlanQuote(planId as PlanId, track, addOns),
    enabled: planId != null,
    staleTime: 60_000,
    retry: false,
  });
}
