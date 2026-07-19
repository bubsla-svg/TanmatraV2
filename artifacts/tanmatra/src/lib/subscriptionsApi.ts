export type SubscriptionCadence = "weekly" | "fortnightly" | "monthly";
// "halted" = billing gave up after repeated consecutive charge failures (see
// api-server's chargeMandate.ts MAX_CONSECUTIVE_CHARGE_FAILURES). Distinct
// from "paused" (the customer's own choice, no billing implication) — a
// halted subscription needs the customer to retry/update payment before it
// resumes. Recoverable via subscriptionsApi.reactivateBilling.
export type SubscriptionStatus = "active" | "paused" | "cancelled" | "halted";
export type DeliveryStatus =
  | "upcoming"
  | "skipped"
  | "delivered"
  | "cancelled"
  | "paused";

export interface SubscriptionItem {
  slug: string;
  name: string;
  image: string;
  quantity: number;
  unitPricePaise: number;
  memberId?: number | null;
}

/** One delivery day within a billing cycle (dayOffset = days from cycle start). */
export interface SubscriptionDayPlanEntry {
  dayOffset: number;
  items: SubscriptionItem[];
}

export interface SubscriptionMember {
  id: number;
  subscriptionId: number;
  name: string;
  diet: "any" | "veg" | "nonveg";
  allergens: string[];
  lifestyle: string | null;
  spiceLevel: "mild" | "medium" | "hot" | null;
  createdAt: string;
}

export interface Subscription {
  id: number;
  userId: string;
  cadence: SubscriptionCadence;
  mealsPerDelivery: number;
  deliveryWindow: string;
  status: SubscriptionStatus;
  startDate: string;
  nextDeliveryAt: string;
  pausedAt: string | null;
  addressLabel: string | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  pricePerDeliveryPaise: number;
  // Present only on day-first plans (one dated delivery per planned day per
  // cycle) — when set, mealsPerDelivery is server-derived from these items
  // and can't be changed independently via change-plan.
  dayPlan?: SubscriptionDayPlanEntry[] | null;
  notes: string | null;
  // A requested cadence/mealsPerDelivery change (POST /change-plan), applied
  // at the NEXT billing cycle — never mid-cycle. See subscriptionsApi.changePlan.
  pendingCadence: SubscriptionCadence | null;
  pendingMealsPerDelivery: number | null;
  pendingPricePerDeliveryPaise: number | null;
  pendingChangeRequestedAt: string | null;
  // true while a price-increasing change is waiting on a fresh Razorpay OTP
  // re-authorisation (changePlanReauthOrder + changePlanConfirm) before it is
  // even eligible to apply at the next cycle.
  pendingChangeReauthRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionDelivery {
  id: number;
  subscriptionId: number;
  scheduledFor: string;
  deliveryWindow: string;
  status: DeliveryStatus;
  items: SubscriptionItem[];
  orderId: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MealCredit {
  id: number;
  userId: string;
  subscriptionId: number | null;
  deliveryId: number | null;
  amount: number;
  reason:
    | "skipped_delivery"
    | "redemption"
    | "manual_grant"
    | "alacarte_bridge";
  expiresAt: string | null;
  consumedAt: string | null;
  createdAt: string;
}

import { API_BASE as API_BASE } from "./apiBase";

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  // Normalize any HeadersInit shape (plain object, Headers instance, tuple
  // array) — object-spreading a Headers instance silently yields {} and would
  // drop custom headers like Idempotency-Key.
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    // headers applied AFTER ...init so a caller can never clobber Content-Type —
    // losing it makes express.json() skip the body and Zod reject with
    // "received undefined".
    headers,
  });
  if (res.status === 401) {
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    // The server's error responses are `{ error: "human-readable message",
    // code?, ... }`. Surface that message — callers show err.message straight
    // in a toast, so without this a 409 rendered the raw JSON response body
    // (or worse, an HTML error page) instead of e.g. "This delivery is too
    // close to its delivery time to skip."
    let message = text;
    if (text) {
      try {
        const body: unknown = JSON.parse(text);
        if (
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof (body as { error: unknown }).error === "string" &&
          (body as { error: string }).error.trim()
        ) {
          message = (body as { error: string }).error;
        }
      } catch {
        // Not JSON — fall back to the raw text below.
      }
    }
    throw new Error(message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** True when `err` is the "not signed in" sentinel `request()` throws on a 401. */
export function isUnauthorizedError(err: unknown): boolean {
  return err instanceof Error && err.message === "unauthorized";
}

export interface CreateSubscriptionInput {
  cadence: SubscriptionCadence;
  mealsPerDelivery: number;
  deliveryWindow: string;
  startDate: string;
  /** "trial" = one-off 3-day sampler at 25% off; "standard" = recurring. */
  planType?: "standard" | "trial";
  addressLabel?: string;
  addressLine?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  notes?: string;
  members: Array<{
    name: string;
    diet: "any" | "veg" | "nonveg";
    allergens: string[];
    lifestyle?: string;
    spiceLevel: "mild" | "medium" | "hot";
  }>;
  defaultItems: SubscriptionItem[];
  /** Day-first plans: per-day deliveries within each billing cycle. */
  dayPlan?: SubscriptionDayPlanEntry[];
}

function mintIdempotencyKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Matches the server's memberInputSchema (subscriptions.ts) — minus subscriptionId. */
export interface AddMemberInput {
  name: string;
  diet: "any" | "veg" | "nonveg";
  allergens: string[];
  medicalConditions?: string[];
  dislikedIngredients?: string[];
  lifestyle?: string;
  spiceLevel: "mild" | "medium" | "hot";
}

/**
 * React Query cache keys for subscription data. Every surface that reads or
 * mutates a subscription (Subscriptions.tsx, Billing.tsx, Account.tsx) must
 * key off these so a mutation on one screen invalidates the cache the others
 * read from — otherwise pausing from /account/billing leaves /subscriptions
 * and the Account "active plans" badge stale until a hard reload.
 */
export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  list: ["subscriptions", "list"] as const,
  detail: (id: number) => ["subscriptions", "detail", id] as const,
};

export const subscriptionsApi = {
  list: () =>
    request<{ subscriptions: Subscription[] }>("/subscriptions"),
  get: (id: number) =>
    request<{
      subscription: Subscription;
      members: SubscriptionMember[];
      deliveries: SubscriptionDelivery[];
      mandate?: { id: number; status: string; nextChargeAt: string | null } | null;
    }>(`/subscriptions/${id}`),
  quote: (input: {
    cadence: SubscriptionCadence;
    mealsPerDelivery?: number;
    planType?: "standard" | "trial";
    dayPlan?: SubscriptionDayPlanEntry[];
  }) =>
    request<{
      mealsPerDelivery: number;
      pricePerMealPaise: number;
      pricePerDeliveryPaise: number;
      discountPaise: number;
      deliveryFeePaise: number;
      gstPaise: number;
      totalPaise: number;
    }>("/subscriptions/quote", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  create: (input: CreateSubscriptionInput, idempotencyKey?: string) =>
    request<{
      subscription: Subscription;
      deliveries: SubscriptionDelivery[];
      // Phase C2 — à la carte → trial credit applied to this trial (line item;
      // the client subtracts it from the charge). 0 when none was redeemable.
      bridgeCreditPaise?: number;
    }>(
      "/subscriptions",
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey || mintIdempotencyKey() },
        body: JSON.stringify(input),
      },
    ),
  pause: (id: number) =>
    request<{ subscription: Subscription }>(`/subscriptions/${id}/pause`, {
      method: "POST",
    }),
  resume: (id: number) =>
    request<{ subscription: Subscription }>(`/subscriptions/${id}/resume`, {
      method: "POST",
    }),
  cancel: (id: number) =>
    request<{ subscription: Subscription }>(`/subscriptions/${id}/cancel`, {
      method: "POST",
    }),
  // Recovers a "halted" subscription (billing stopped after repeated
  // consecutive charge failures) — reuses the existing Razorpay mandate,
  // resets the failure counter, and resumes on the normal cadence.
  reactivateBilling: (id: number) =>
    request<{
      subscription: Subscription;
      mandate: { id: number; status: string; nextChargeAt: string | null } | null;
    }>(`/subscriptions/${id}/reactivate-billing`, {
      method: "POST",
    }),
  updateDeliveryWindow: (id: number, deliveryWindow: string) =>
    request<{ subscription: Subscription }>(
      `/subscriptions/${id}/delivery-window`,
      { method: "POST", body: JSON.stringify({ deliveryWindow }) },
    ),
  generateNext: (id: number) =>
    request<{ deliveries: SubscriptionDelivery[]; planChangeApplied?: boolean }>(
      `/subscriptions/${id}/generate-next`,
      { method: "POST" },
    ),
  /**
   * Requests a cadence and/or mealsPerDelivery change, effective at the NEXT
   * billing cycle (never mid-cycle). The server always recomputes the price
   * itself — `clientQuotedPricePerDeliveryPaise` is accepted for
   * tamper-detection logging only and never trusted.
   *
   * `requiresReauth: true` means the change is a price increase against a
   * live autopay mandate: it is stored as pending but will NOT take effect
   * until `changePlanReauthOrder` + `changePlanConfirm` complete.
   */
  changePlan: (
    id: number,
    input: {
      cadence?: SubscriptionCadence;
      mealsPerDelivery?: number;
      clientQuotedPricePerDeliveryPaise?: number;
    },
  ) =>
    request<{
      subscription: Subscription;
      requiresReauth: boolean;
      currentPricePerDeliveryPaise: number;
      newPricePerDeliveryPaise: number;
    }>(`/subscriptions/${id}/change-plan`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  /** Creates the Razorpay order + recurring token for a pending plan-change re-authorisation. */
  changePlanReauthOrder: (id: number) =>
    request<{ razorpayOrderId: string; amount: number; currency: string; keyId: string }>(
      `/subscriptions/${id}/change-plan/reauth-order`,
      { method: "POST" },
    ),
  /** Confirms a plan-change re-authorisation after the Razorpay modal completes. */
  changePlanConfirm: (
    id: number,
    payment: { razorpayPaymentId: string; razorpayOrderId: string; razorpaySignature: string },
  ) =>
    request<{ subscription: Subscription; requiresReauth: boolean }>(
      `/subscriptions/${id}/change-plan/confirm`,
      { method: "POST", body: JSON.stringify(payment) },
    ),
  skip: (deliveryId: number) =>
    request<{ delivery: SubscriptionDelivery }>(
      `/subscription-deliveries/${deliveryId}/skip`,
      { method: "POST" },
    ),
  skipSubscription: (id: number) =>
    request<{ delivery: SubscriptionDelivery }>(
      `/subscriptions/${id}/skip`,
      { method: "POST" },
    ),
  swap: (deliveryId: number, items: SubscriptionItem[]) =>
    request<{ delivery: SubscriptionDelivery }>(
      `/subscription-deliveries/${deliveryId}/swap`,
      { method: "POST", body: JSON.stringify({ items }) },
    ),
  reschedule: (
    deliveryId: number,
    scheduledFor: string,
    deliveryWindow?: string,
  ) =>
    request<{ delivery: SubscriptionDelivery }>(
      `/subscription-deliveries/${deliveryId}/reschedule`,
      {
        method: "POST",
        body: JSON.stringify({ scheduledFor, deliveryWindow }),
      },
    ),
  trialRecap: (id: number) =>
    request<{
      stats: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
      holdExpiration: string;
    }>(`/subscriptions/${id}/trial-recap`),
  credits: () =>
    request<{ credits: MealCredit[]; balance: number }>("/meal-credits"),
  // Trial → paid conversion. Preserves the SAME subscription row (re-checks
  // the capacity hold + reserved delivery slot server-side and reprices),
  // unlike creating a brand-new subscription which bypasses those checks.
  convert: (id: number) =>
    request<{ subscription: Subscription; deliveries: SubscriptionDelivery[] }>(
      `/subscriptions/${id}/convert`,
      { method: "POST" },
    ),
  addMember: (subscriptionId: number, input: AddMemberInput) =>
    request<{ member: SubscriptionMember }>(
      `/subscriptions/${subscriptionId}/members`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  removeMember: (subscriptionId: number, memberId: number) =>
    request<{ ok: true }>(
      `/subscriptions/${subscriptionId}/members/${memberId}`,
      { method: "DELETE" },
    ),
};

export const CADENCE_LABEL: Record<SubscriptionCadence, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

export const CADENCE_DAYS: Record<SubscriptionCadence, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
};

export function formatScheduledDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
