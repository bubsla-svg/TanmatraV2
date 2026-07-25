import { apiGet, API_BASE, ApiError, type FetchImpl } from "./apiClient";
import { createRazorpayOrder, verifyPayment } from "./api";
import type { RazorpayAdapter } from "./moneyPath";

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

/**
 * The money path, in order: server checkout (order `placed`) → shared Razorpay
 * order for its externalOrderId → modal → verify. The client authors no amount;
 * the server bills the order's own total.
 */
export type DeliveryMode = "ship" | "bundle_with_meal";

export async function payForMarketplace(
  line: { itemId: number; qty: number },
  razorpay: RazorpayAdapter,
  opts: { deliveryMode?: DeliveryMode; bundleWithOrderId?: number | null } = {},
  fetchImpl?: FetchImpl,
): Promise<MarketplaceOrder> {
  const { order } = await checkout(
    {
      idempotencyKey: newIdempotencyKey(),
      items: [line],
      deliveryMode: opts.deliveryMode ?? "ship",
      bundleWithOrderId: opts.bundleWithOrderId ?? null,
    },
    fetchImpl,
  );
  const rzp = await createRazorpayOrder({ orderId: order.externalOrderId }, fetchImpl);
  const paid = await razorpay.open(rzp);
  await verifyPayment(
    {
      orderId: order.externalOrderId,
      razorpayPaymentId: paid.razorpayPaymentId,
      razorpayOrderId: paid.razorpayOrderId,
      razorpaySignature: paid.razorpaySignature,
    },
    fetchImpl,
  );
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
