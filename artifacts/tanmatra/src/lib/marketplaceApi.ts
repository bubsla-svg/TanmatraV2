import { API_BASE as API_BASE } from "./apiBase";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export type AddonCategory = "drink" | "snack" | "supplement" | "juice";

export interface Addon {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: AddonCategory;
  pricePaise: number;
  image: string | null;
  rdVerified: boolean;
  premiumOnly: boolean;
  recommendedFor: string[];
  recommendedScore: number;
  macros: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  isActive: boolean;
}

export interface PremiumMembership {
  id: number;
  userId: string;
  status: "active" | "cancelled" | "expired";
  monthlyPricePaise: number;
  startedAt: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  rdConsultsUsedThisPeriod: number;
  rdConsultsPerPeriod: number;
}

export interface PremiumStatus {
  membership: PremiumMembership | null;
  isPremium: boolean;
  pricePaise: number;
}

export type MarketplaceCategory =
  | "oils"
  | "sauces"
  | "supplements"
  | "pantry"
  | "snacks";

export interface MarketplaceItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  category: MarketplaceCategory;
  pricePaise: number;
  weightLabel: string | null;
  supplierName: string | null;
  image: string | null;
  badges: string[];
  rdVerified: boolean;
  stockQty: number;
  isActive: boolean;
}

export interface MarketplaceOrderLine {
  itemId: number;
  slug: string;
  name: string;
  qty: number;
  unitPricePaise: number;
}

export interface MarketplaceOrder {
  id: number;
  /**
   * The payment handle. `POST /payments/razorpay/order` and
   * `POST /payments/razorpay/verify` key on THIS, not on `id` — the
   * numeric id is a row pointer, the external id is the money handle
   * (`mkt-<uuid>`, 40 chars, fits razorpay's 40-char receipt field).
   *
   * The server has always returned it (marketplace.ts checkout uses a
   * bare `.returning()`), but this type omitted it, so the customer UI
   * had no way to reach the payment routes and shipped a revenue leak:
   * checkout returned 201, the cart said "order placed", and the row
   * sat at `status: "placed"` — which by house convention means UNPAID.
   * The storefront client declares the same field for the same reason.
   */
  externalOrderId: string;
  /**
   * NOTE: `placed` means created-but-UNPAID (house convention across
   * `orders.status`); `preparing` and later mean paid. `packed` and
   * `shipped` are vestigial — they are in this union but no writer
   * emits them, left over from the retired `marketplace_orders` table.
   */
  status: "placed" | "packed" | "shipped" | "delivered" | "cancelled";
  deliveryMode: "ship" | "bundle_with_meal";
  items: MarketplaceOrderLine[];
  totalPaise: number;
  bundleWithOrderId: number | null;
  createdAt: string;
}

export const addonsApi = {
  list: (tags?: string[]) =>
    request<{ addons: Addon[]; isPremium: boolean }>(
      `/addons${tags?.length ? `?tags=${encodeURIComponent(tags.join(","))}` : ""}`,
    ),
  // Attaches add-ons to an ALREADY-PLACED order. `billed` is the server
  // telling you whether the customer was charged for them: it is currently
  // always false, because add-ons arrive after finalizeOrder has written
  // orders.charge_paise and nothing may move that number afterwards. Treat
  // `addedPaise` as "what these would cost", never as "what was taken".
  attach: (
    orderId: number,
    items: Array<{ addonId: number; qty: number }>,
  ) =>
    request<{ addons: unknown[]; addedPaise: number; billed: boolean }>(
      `/addons/attach`,
      {
        method: "POST",
        body: JSON.stringify({ orderId, items }),
      },
    ),
  forOrder: (orderId: number) =>
    request<{
      addons: Array<{
        id: number;
        addonId: number;
        qty: number;
        unitPricePaise: number;
        slug: string;
        name: string;
        image: string | null;
      }>;
    }>(`/orders/${orderId}/addons`),
};

export const premiumApi = {
  me: () => request<PremiumStatus>(`/premium/me`),
  subscribe: () =>
    request<{ membership: PremiumMembership; isPremium: true }>(
      `/premium/subscribe`,
      { method: "POST" },
    ),
  checkout: () =>
    request<{ razorpayOrderId: string; amount: number; currency: string; keyId: string }>(
      `/premium/checkout`,
      { method: "POST" },
    ),
  verify: (payment: {
    razorpayPaymentId: string;
    razorpayOrderId: string;
    razorpaySignature: string;
  }) =>
    request<{ membership: PremiumMembership; isPremium: true }>(`/premium/verify`, {
      method: "POST",
      body: JSON.stringify(payment),
    }),
  cancel: () =>
    request<{ membership: PremiumMembership }>(`/premium/cancel`, {
      method: "POST",
    }),
  useRdConsult: () =>
    request<{ membership: PremiumMembership; remaining: number }>(
      `/premium/use-rd-consult`,
      { method: "POST" },
    ),
  meals: () =>
    request<{ slugs: string[]; meals: Array<{ dishSlug: string; reason: string | null }> }>(
      `/premium/meals`,
    ),
};

export const marketplaceApi = {
  listItems: (category?: string) =>
    request<{ items: MarketplaceItem[] }>(
      `/marketplace/items${category && category !== "all" ? `?category=${encodeURIComponent(category)}` : ""}`,
    ),
  getItem: (slug: string) =>
    request<{ item: MarketplaceItem }>(
      `/marketplace/items/${encodeURIComponent(slug)}`,
    ),
  checkout: (args: {
    /** Server-managed idempotency key. Reuse the SAME value for every
     * retry of one submit attempt so the server replays its cached
     * response instead of double-charging / double-decrementing stock.
     * Use `marketplaceCheckoutIdempotencyKey()` to mint a fresh key
     * once per "Buy" click. */
    idempotencyKey: string;
    items: Array<{ itemId: number; qty: number }>;
    deliveryMode: "ship" | "bundle_with_meal";
    bundleWithOrderId?: number | null;
    address?: {
      label?: string;
      line?: string;
      city?: string;
      pincode?: string;
      phone?: string;
    };
  }) => {
    const { idempotencyKey, ...body } = args;
    return request<{ order: MarketplaceOrder }>(`/marketplace/checkout`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  },
  myOrders: () =>
    request<{ orders: MarketplaceOrder[] }>(`/marketplace/orders`),
};

/**
 * Mints a fresh `Idempotency-Key` (UUID). The caller is responsible
 * for holding onto the returned value (e.g. in a `useRef`) so that
 * any retry of the same in-flight request reuses it, and for minting
 * a new value when the user clicks "Buy" again.
 */
export function marketplaceCheckoutIdempotencyKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
