/**
 * GET /delivery/slots client — the à-la-carte delivery-window source (T-08).
 * The server owns availability and capacity; this only asks. Same injectable
 * `fetchImpl` contract as every other lib/*Api.ts so the wire test runs
 * without a network.
 */
import { apiGet, type FetchImpl } from "./apiClient";
import type { DeliverySlot } from "./deliverySlots";

export const DEFAULT_DELIVERY_ZONE = "default";

export async function fetchDeliverySlots(
  zone: string = DEFAULT_DELIVERY_ZONE,
  fetchImpl?: FetchImpl,
): Promise<DeliverySlot[]> {
  const res = await apiGet<{ slots: DeliverySlot[] }>(
    `/delivery/slots?zone=${encodeURIComponent(zone)}`,
    fetchImpl,
  );
  return Array.isArray(res.slots) ? res.slots : [];
}
