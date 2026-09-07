import { apiGet, API_BASE, ApiError, type FetchImpl } from "./apiClient";
import { createRazorpayOrder, verifyPayment } from "./api";
import type { RazorpayAdapter } from "./moneyPath";
import { verifyWithRetry, type PaidFacts } from "./verifyRetry";

/**
 * Marketplace (Wave F) client. Browse is public; buying is a real money-path.
 * The legacy customer UI shipped a revenue leak — it stopped at `checkout`
 * (order `placed`, unpaid) and never billed. This wires the full path: checkout
 * → the SHARED /payments/razorpay order+verify (keyed on the order's
 * externalOrderId; the server bills its own total, ignoring any client amount).
 */

export type MarketplaceCategory = "oils" | "sauces" | "supplements" | "pantry" | "snacks";

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
}

export interface MarketplaceOrder {
  id: number;
  externalOrderId: string;
  status: string;
  totalPaise: number;
}

// Server-only. `/marketplace/items` is a public, non-personalised catalog
// listing, but MarketplaceGrid fetched it through the shared apiGet client,
// which hardcodes `cache: "no-store"` — correct for the session-cookie-authed
// per-user data most callers need, wrong for this one, and it meant the
// route always shipped an empty shell + "Loading pantry…" on first paint,
// unlike every other catalog surface. Mirrors lib/catalog.ts's fetchMenu:
// server-side fetch with a revalidate window, empty array on failure (the
// client-side query in MarketplaceGrid still retries from there).
const SERVER_API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

export async function fetchMarketplaceItemsServer(): Promise<MarketplaceItem[]> {
  try {
    const res = await fetch(`${SERVER_API_BASE}/api/marketplace/items`, {
      // Revalidate hourly — the catalog is not per-request data.
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`marketplace items ${res.status}`);
    const data = (await res.json()) as { items?: MarketplaceItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

/** One catalog item, server-side — same reasoning as fetchMarketplaceItemsServer
 *  above (public data, so it is cacheable and must not go through apiGet, whose
 *  client base is "" on the server). `null` when the slug names nothing
 *  sellable; the caller renders a not-found state rather than a checkout for an
 *  item that may not exist. */
export async function fetchMarketplaceItemServer(slug: string): Promise<MarketplaceItem | null> {
  try {
    const res = await fetch(
      `${SERVER_API_BASE}/api/marketplace/items/${encodeURIComponent(slug)}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { item?: MarketplaceItem };
    return data.item ?? null;
  } catch {
    return null;
  }
}

export function listItems(category?: string, fetchImpl?: FetchImpl): Promise<{ items: MarketplaceItem[] }> {
  const q = category && category !== "all" ? `?category=${encodeURIComponent(category)}` : "";
  return apiGet(`/marketplace/items${q}`, fetchImpl);
}

export function getItem(slug: string, fetchImpl?: FetchImpl): Promise<{ item: MarketplaceItem }> {
  return apiGet(`/marketplace/items/${encodeURIComponent(slug)}`, fetchImpl);
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Checkout needs an `Idempotency-Key` HEADER, so it can't use the shared
 *  apiPost (which sends none). Mirror the apiClient contract otherwise. */
export function checkout(
  input: { idempotencyKey: string; items: { itemId: number; qty: number }[]; deliveryMode?: "ship" | "bundle_with_meal"; bundleWithOrderId?: number | null },
  fetchImpl: FetchImpl = fetch,
): Promise<{ order: MarketplaceOrder }> {
  const { idempotencyKey, ...body } = input;
  return fetchImpl(`${API_BASE}/api/marketplace/checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const e = json as { error?: string; code?: string };
      throw new ApiError(res.status, e.code ?? "error", e.error ?? res.statusText);
    }
    return json as { order: MarketplaceOrder };
  });
}

/** How a pantry order reaches the customer: on its own, or riding along with a
 *  meal order. Mirrors `checkout`'s own input union above. */
export type DeliveryMode = "ship" | "bundle_with_meal";

// `payForMarketplace(items, razorpay, …)` used to live here: checkout → the
// leg below, in one call. It minted a FRESH idempotency key on every
// invocation, so a create retried after a dropped connection was a second
// order, a second stock decrement and a second charge — and its only caller
// ran the modal on the product page. The pantry now settles on the shared
// checkout, where lib/purchaseSteps.ts#marketplaceSteps holds ONE key for the
// whole attempt and calls `checkout` and `finishMarketplacePayment` directly.

/**
 * The payment leg for an ALREADY-created marketplace order: shared Razorpay
 * order → modal → verify (with the same bounded retry the meal paths use).
 * Used directly to resume payment after a dismissed modal so no duplicate
 * order/stock-reservation/charge is ever created.
 */
export async function finishMarketplacePayment(
  order: MarketplaceOrder,
  razorpay: RazorpayAdapter,
  opts: { onCaptured?: (facts: PaidFacts) => void } = {},
  fetchImpl?: FetchImpl,
): Promise<MarketplaceOrder> {
  const rzp = await createRazorpayOrder({ orderId: order.externalOrderId }, fetchImpl);
  const paid = await razorpay.open(rzp);
  const facts: PaidFacts = {
    orderId: order.externalOrderId,
    razorpayPaymentId: paid.razorpayPaymentId,
    razorpayOrderId: paid.razorpayOrderId,
    razorpaySignature: paid.razorpaySignature,
  };
  opts.onCaptured?.(facts);
  await verifyWithRetry((f) => verifyPayment(f, fetchImpl), facts);
  return order;
}

export interface StockAvailabilityResponse {
  itemId: number;
  slug: string;
  totalAvailableQty: number;
  inStock: boolean;
  nextExpiryDate: string | null;
}

export async function checkItemAvailability(
  slug: string,
  fetchImpl?: FetchImpl,
): Promise<StockAvailabilityResponse> {
  return apiGet(`/marketplace/items/${encodeURIComponent(slug)}/availability`, fetchImpl);
}

export interface LiquidationDealPayload {
  slug: string;
  skuName: string;
  originalPricePaise: number;
  discountedPricePaise: number;
  discountPercentage: number;
  batchNumber: string;
  expiryDate: string;
  promotionalBadge: string;
  unitsAvailable: number;
}

export async function getLiquidationDeals(
  fetchImpl?: FetchImpl,
): Promise<{ deals: LiquidationDealPayload[] }> {
  return apiGet(`/marketplace/liquidation-deals`, fetchImpl);
}
