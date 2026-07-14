export type SubscriptionCadence = "weekly" | "fortnightly" | "monthly";
export type SubscriptionStatus = "active" | "paused" | "cancelled";
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
  notes: string | null;
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
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });
  if (res.status === 401) {
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
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
  updateDeliveryWindow: (id: number, deliveryWindow: string) =>
    request<{ subscription: Subscription }>(
      `/subscriptions/${id}/delivery-window`,
      { method: "POST", body: JSON.stringify({ deliveryWindow }) },
    ),
  generateNext: (id: number) =>
    request<{ deliveries: SubscriptionDelivery[] }>(
      `/subscriptions/${id}/generate-next`,
      { method: "POST" },
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
