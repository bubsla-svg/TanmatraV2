/**
 * Post-purchase add-on attach client (SF-11). Session-authed calls against the
 * verified subscriptions.ts seams:
 *
 *   GET    /subscriptions/:id/add-ons             → { addOns: AttachedAddOn[] }
 *   POST   /subscriptions/:id/add-ons {addOnId}   → 201 { addOn }
 *                                                 · 200 { addOn, alreadyActive } (idempotent re-tap)
 *                                                 · 422 addon_not_allowed · 409 not_plan_v2
 *   DELETE /subscriptions/:id/add-ons/:addOnId    → { ok, detached }
 *
 * Price/cadence on the returned row are the SERVER's snapshot from the
 * canonical ADD_ONS config at attach time — display those, never restate the
 * spine's current number over a persisted row.
 */
import { apiGet, apiPost, apiDelete, type FetchImpl } from "./apiClient";
import type { AddOnId } from "./api";

export interface AttachedAddOn {
  id: number;
  subscriptionId: number;
  addonId: AddOnId;
  pricePaise: number;
  cadence: string;
  active: boolean;
}

export function getSubscriptionAddOns(
  subscriptionId: number,
  fetchImpl?: FetchImpl,
): Promise<{ addOns: AttachedAddOn[] }> {
  return apiGet(`/subscriptions/${subscriptionId}/add-ons`, fetchImpl);
}

export function attachAddOn(
  subscriptionId: number,
  addOnId: AddOnId,
  fetchImpl?: FetchImpl,
): Promise<{ addOn: AttachedAddOn; alreadyActive?: boolean }> {
  return apiPost(`/subscriptions/${subscriptionId}/add-ons`, { addOnId }, fetchImpl);
}

export function detachAddOn(
  subscriptionId: number,
  addOnId: AddOnId,
  fetchImpl?: FetchImpl,
): Promise<{ ok: true; detached: AddOnId }> {
  return apiDelete(`/subscriptions/${subscriptionId}/add-ons/${addOnId}`, fetchImpl);
}
