/**
 * Order-history client (SF-09). The signed-in user's own orders across all
 * statuses, most recent first — session-authed GET /orders/mine (orders.ts).
 * Uses the shared transport core; separate from lib/api.ts to stay under the cap.
 */
import { apiGet, type FetchImpl } from "./apiClient";

export interface OrderSummary {
  serverOrderId: number;
  externalOrderId: string;
  status: string;
  totalPaise: number;
  addressLabel: string | null;
  createdAt: string;
}

export function getMyOrders(fetchImpl?: FetchImpl): Promise<{ orders: OrderSummary[] }> {
  return apiGet("/orders/mine", fetchImpl);
}
