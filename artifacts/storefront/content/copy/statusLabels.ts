/**
 * The order status vocabulary from the schema (lib/db/src/schema/orders.ts).
 */
export const orderStatusValues = [
  "placed",
  "preparing",
  "ready",
  "rider_assigned",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "failed",
  "refunded",
  "billed",
] as const;

export type OrderStatus = (typeof orderStatusValues)[number];

export interface StatusLabel {
  label: string;
  sub?: string;
}

/**
 * Closed status labels map keyed strictly against the schema's OrderStatus vocabulary.
 * Adding a new status value to orderStatusValues without adding its label here generates a type error.
 */
export const statusLabels: Record<OrderStatus, StatusLabel> = {
  placed: {
    label: "Order Placed",
    sub: "Payment pending verification",
  },
  preparing: {
    label: "Kitchen Preparing",
    sub: "Chefs are preparing your clinical meal",
  },
  ready: {
    label: "Ready for Dispatch",
    sub: "Packed and waiting for delivery partner",
  },
  rider_assigned: {
    label: "Rider Assigned",
    sub: "Rider is heading to the kitchen",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    sub: "On the way to your delivery address",
  },
  delivered: {
    label: "Delivered",
    sub: "Enjoy your meal!",
  },
  cancelled: {
    label: "Cancelled",
    sub: "This order was cancelled",
  },
  failed: {
    label: "Order Failed",
    sub: "Payment or ticketing issue encountered",
  },
  refunded: {
    label: "Refunded",
    sub: "Amount refunded to original payment method",
  },
  billed: {
    label: "Billed",
    sub: "Corporate billing processed",
  },
};

/**
 * Asserts that all orderStatusValues are explicitly present in the statusLabels map.
 */
export function assertExhaustiveStatusLabels(): void {
  for (const status of orderStatusValues) {
    if (!statusLabels[status]) {
      throw new Error(`[statusLabels] Missing label definition for OrderStatus: "${status}"`);
    }
  }
}
