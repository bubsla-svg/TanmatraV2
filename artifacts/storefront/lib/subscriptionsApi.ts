/**
 * Subscription-management client (SF-08). Session-authed reads + lifecycle
 * transitions against the api-server (subscriptions.ts). Each transition is a
 * bodyless POST the server guards by current status (409 on an illegal
 * transition). Uses the shared transport core; kept out of lib/api.ts to stay
 * under the file cap.
 */
import { apiGet, apiPost, type FetchImpl } from "./apiClient";
import type { SubscriptionCadence } from "@workspace/subscription-rules";

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
  /** A day-first plan's meal count comes from its per-day schedule, not a
   *  flat number — change-plan can't touch mealsPerDelivery on these (the
   *  server 400s). Only presence (a non-empty array) matters client-side. */
  dayPlan?: unknown[] | null;
  // ── Pending plan change (cadence / mealsPerDelivery) — see changePlan().
  // Never applied mid-cycle: these describe a request awaiting the next
  // billing cycle (and, if the bill is increasing against a live autopay
  // mandate, awaiting a fresh Razorpay OTP authorisation first).
  pendingCadence?: SubscriptionCadence | null;
  pendingMealsPerDelivery?: number | null;
  pendingPricePerDeliveryPaise?: number | null;
  pendingChangeRequestedAt?: string | null;
  pendingChangeReauthRequired?: boolean;
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

// ── Change plan (cadence / mealsPerDelivery) — Wave-2 straggler ─────────────
// Never applied mid-cycle (see Subscription.pendingCadence above) — a request
// only sets pending* fields; the server applies it at the next generate-next
// cycle rollover. A price INCREASE against a live autopay mandate comes back
// requiresReauth: true, which the caller resolves via
// createChangePlanReauthOrder + confirmChangePlanReauth (the same Razorpay
// order→modal→verify shape as lib/moneyPath.ts) before it's even eligible to
// apply. A decrease, or an increase with no live mandate to protect, applies
// nothing immediately either — it's still deferred to next cycle, just with
// no reauth gate in front of it.

export interface ChangePlanInput {
  cadence?: SubscriptionCadence;
  mealsPerDelivery?: number;
  /** Sent for tamper-detection/logging only, exactly like
   *  createSubscription's price fields — the server always recomputes and
   *  bills its own price via the shared computeDeliveryPricePaise. */
  clientQuotedPricePerDeliveryPaise?: number;
}

export interface ChangePlanResponse {
  subscription: Subscription;
  requiresReauth: boolean;
  currentPricePerDeliveryPaise: number;
  newPricePerDeliveryPaise: number;
}

export function changePlan(
  id: number,
  input: ChangePlanInput,
  fetchImpl?: FetchImpl,
): Promise<ChangePlanResponse> {
  return apiPost(`/subscriptions/${id}/change-plan`, input, fetchImpl);
}

export interface ChangePlanReauthOrder {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

/** Creates the Razorpay OTP order to re-authorise a pending price-increasing
 *  change. 409s (as a typed ApiError) if no change is actually awaiting
 *  reauth on this subscription. */
export function createChangePlanReauthOrder(
  id: number,
  fetchImpl?: FetchImpl,
): Promise<ChangePlanReauthOrder> {
  return apiPost(`/subscriptions/${id}/change-plan/reauth-order`, {}, fetchImpl);
}

export interface ConfirmChangePlanReauthInput {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

/** Confirms the OTP payment, registering it as the subscription's new
 *  autopay mandate. Still doesn't apply the change itself — only clears the
 *  reauth gate so it's eligible at the next cycle rollover. */
export function confirmChangePlanReauth(
  id: number,
  input: ConfirmChangePlanReauthInput,
  fetchImpl?: FetchImpl,
): Promise<{ subscription: Subscription; requiresReauth: false }> {
  return apiPost(`/subscriptions/${id}/change-plan/confirm`, input, fetchImpl);
}

// ── Trial recap (subscription/bridge) ────────────────────────────────────────

export interface TrialRecapStats {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface TrialRecapResponse {
  stats: TrialRecapStats;
  holdExpiration: string;
}

/** Real, server-verified trial state for the bridge screen: 404 if the id
 *  isn't this caller's subscription, 400 if it's not a live/eligible trial
 *  (already converted or abandoned). Never guess the credit amount — the
 *  server only confirms eligibility here; the credit figure itself is the
 *  spine constant (lib/trial.ts's TRIAL_CREDITBACK_PAISE), the same one the
 *  rest of the trial flow displays. */
export function trialRecap(id: number, fetchImpl?: FetchImpl): Promise<TrialRecapResponse> {
  return apiGet(`/subscriptions/${id}/trial-recap`, fetchImpl);
}
