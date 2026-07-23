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
