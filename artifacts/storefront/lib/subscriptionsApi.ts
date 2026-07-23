/**
 * Subscription-management client (SF-08). Session-authed reads + lifecycle
 * transitions against the api-server (subscriptions.ts). Each transition is a
 * bodyless POST the server guards by current status (409 on an illegal
 * transition). Uses the shared transport core; kept out of lib/api.ts to stay
 * under the file cap.
 */
import { apiGet, apiPost, type FetchImpl } from "./apiClient";

export type SubscriptionStatus = "active" | "paused" | "halted" | "cancelled";

export interface Subscription {
  id: number;
  status: SubscriptionStatus;
  cadence: string;
  mealsPerDelivery: number;
  deliveryWindow: string;
  planType?: string;
  startDate: string;
  nextDeliveryAt: string | null;
  pausedAt: string | null;
  addressLabel: string | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
  pricePerDeliveryPaise: number;
  notes: string | null;
  createdAt: string;
}

export function getSubscriptions(fetchImpl?: FetchImpl): Promise<{ subscriptions: Subscription[] }> {
  return apiGet("/subscriptions", fetchImpl);
}

function transition(id: number, action: string, fetchImpl?: FetchImpl): Promise<{ subscription: Subscription }> {
  return apiPost(`/subscriptions/${id}/${action}`, {}, fetchImpl);
}

export function pauseSubscription(id: number, fetchImpl?: FetchImpl) {
  return transition(id, "pause", fetchImpl);
}
export function resumeSubscription(id: number, fetchImpl?: FetchImpl) {
  return transition(id, "resume", fetchImpl);
}
export function cancelSubscription(id: number, fetchImpl?: FetchImpl) {
  return transition(id, "cancel", fetchImpl);
}
export function reactivateSubscriptionBilling(id: number, fetchImpl?: FetchImpl) {
  return transition(id, "reactivate-billing", fetchImpl);
}

// ── Detail + per-delivery skip/unskip + meal credits (SF-10 tail) ────────────

export interface SubscriptionDelivery {
  id: number;
  subscriptionId: number;
  scheduledFor: string;
  status: string;
  deliveryWindow?: string | null;
  [k: string]: unknown;
}

export interface SubscriptionDetail {
  subscription: Subscription;
  members: unknown[];
  /** Ordered by scheduledFor asc (server contract). */
  deliveries: SubscriptionDelivery[];
  /** The ACTIVE UPI Autopay mandate, or null — drives the autopay status line. */
  mandate: { id: number; status: string; [k: string]: unknown } | null;
}

export function getSubscription(id: number, fetchImpl?: FetchImpl): Promise<SubscriptionDetail> {
  return apiGet(`/subscriptions/${id}`, fetchImpl);
}

/** Skip one delivery. The server enforces the 24h cutoff (409 `past_cutoff`)
 *  and grants the meal credit atomically with the state flip — the client only
 *  reflects the response, never pre-credits. */
export function skipDelivery(
  deliveryId: number,
  fetchImpl?: FetchImpl,
): Promise<{ delivery: SubscriptionDelivery }> {
  return apiPost(`/subscription-deliveries/${deliveryId}/skip`, {}, fetchImpl);
}

/** Restore a skipped delivery — the server claws the credit back in the same
 *  transaction (409 `past_cutoff` once the kitchen window has passed). */
export function unskipDelivery(
  deliveryId: number,
  fetchImpl?: FetchImpl,
): Promise<{ delivery: SubscriptionDelivery }> {
  return apiPost(`/subscription-deliveries/${deliveryId}/unskip`, {}, fetchImpl);
}

export interface MealCreditsResponse {
  credits: unknown[];
  /** Unconsumed, unexpired meal-credit balance — the server's sum. */
  balance: number;
}

export function getMealCredits(fetchImpl?: FetchImpl): Promise<MealCreditsResponse> {
  return apiGet("/meal-credits", fetchImpl);
}
