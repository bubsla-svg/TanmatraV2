/**
 * Order-history client (SF-09). The signed-in user's own orders across all
 * statuses, most recent first — session-authed GET /orders/mine (orders.ts).
 * Uses the shared transport core; separate from lib/api.ts to stay under the cap.
 */
import { apiGet, type FetchImpl } from "./apiClient";

/** One meal-order line as persisted at purchase ({id,name,qty,price} — the
 *  price is the paise charged THEN; reorder re-prices from today's menu). */
export interface OrderLineItem {
  id: number;
  name: string;
  qty: number;
  price: number;
}

export interface OrderSummary {
  serverOrderId: number;
  externalOrderId: string;
  status: string;
  totalPaise: number;
  addressLabel: string | null;
  createdAt: string;
  /** Absent on responses from api-server builds predating the reorder field. */
  items?: OrderLineItem[];
}

export function getMyOrders(fetchImpl?: FetchImpl): Promise<{ orders: OrderSummary[] }> {
  return apiGet("/orders/mine", fetchImpl);
}

/** In-flight orders (GET /orders/active) — user-scoped for customers; a
 *  clinician caller gets the cross-patient feed (callerIsClinician says which). */
export interface ActiveOrder extends OrderSummary {
  patientUserId?: string;
}

export function getActiveOrders(
  fetchImpl?: FetchImpl,
): Promise<{ callerIsClinician: boolean; orders: ActiveOrder[] }> {
  return apiGet("/orders/active", fetchImpl);
}
