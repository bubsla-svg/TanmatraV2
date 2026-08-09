/**
 * À-la-carte QuoteSnapshot client (POST /orders/quote). The server prices
 * through the same helpers POST /orders bills from, so this is the ONLY
 * source the checkout screen may display totals from — client arithmetic on
 * cart lines is a display estimate at best and a contradiction at worst
 * (UX/UI Architecture Phase 7; sweep rule "All visible totals agree").
 *
 * The snapshot is advisory-stateless: expiresAt tells the UI when to stop
 * trusting the display and refresh; the server re-prices authoritatively at
 * order creation regardless.
 */
import { apiPost, type FetchImpl } from "./apiClient";

export interface QuoteItemInput {
  dishId: number;
  qty: number;
  customizations?: Array<{ groupName: string; optionNames: string[] }>;
}

export interface QuoteLine {
  id: number;
  name: string;
  qty: number;
  unitPaise: number;
  linePaise: number;
  customizations?: string[];
}

export interface QuoteSnapshot {
  status: "active";
  version: number;
  expiresAt: string;
  items: QuoteLine[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  packagingPaise: number;
  discountPaise: number;
  taxPaise: number;
  payableNowPaise: number;
  amountToFreeDeliveryPaise: number;
  etaMinutes: number;
  serviceability: { pincode: string; serviceable: boolean } | null;
}

export function fetchQuote(
  items: QuoteItemInput[],
  pincode?: string,
  fetchImpl?: FetchImpl,
): Promise<QuoteSnapshot> {
  return apiPost<QuoteSnapshot>(
    "/orders/quote",
    { items, ...(pincode ? { pincode } : {}) },
    fetchImpl,
  );
}

/** True while the snapshot's advisory freshness window is still open. */
export function quoteIsFresh(quote: Pick<QuoteSnapshot, "expiresAt">, now = Date.now()): boolean {
  const t = Date.parse(quote.expiresAt);
  return Number.isFinite(t) && t > now;
}
