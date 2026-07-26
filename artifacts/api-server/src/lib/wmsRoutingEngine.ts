/**
 * Hybrid Checkout Routing & KDS Bypass Engine (WMS Vector 3).
 * Classifies multi-item baskets into Made-To-Order (MTO) vs Fast-Moving Consumer Goods (FMCG).
 * Mixed Baskets generate split KDS tickets (hot line ovens vs Pantry/Expediter fridges).
 * FMCG-Only Baskets bypass hot kitchen prep completely to dispatch via 3PL courier desks.
 */
import { logger } from "./logger";
import { executeFefoDeduction, type FefoDeductionLine } from "./wmsFefoEngine";
import { scheduleOrderAdvance } from "./queue";

export type BasketRoutingMode = "PURE_MTO_KITCHEN" | "MIXED_HYBRID_SPLIT" | "PURE_FMCG_BYPASS";

export interface BasketItemInput {
  itemId?: number;
  id?: number;
  name: string;
  qty: number;
  fulfillmentType?: "MTO" | "FMCG";
}

export interface HybridOrderTicket {
  orderId: number;
  externalOrderId: string;
  routingMode: BasketRoutingMode;
  hotKitchenLines: Array<{ name: string; qty: number }>;
  pantryExpediterLines: Array<{ itemId: number; skuName: string; qty: number }>;
  destinationQueue: "petpooja_kds" | "3pl_fulfillment_desk" | "dual_route";
}

/**
 * Evaluate cart items to classify basket routing mode and construct split KDS displays.
 */
export function classifyAndRouteBasket(
  orderId: number,
  externalOrderId: string,
  items: BasketItemInput[],
): HybridOrderTicket {
  const mtoItems = items.filter((i) => !i.fulfillmentType || i.fulfillmentType === "MTO");
  const fmcgItems = items.filter((i) => i.fulfillmentType === "FMCG");

  if (mtoItems.length > 0 && fmcgItems.length === 0) {
    logger.info({ orderId, externalOrderId }, "ops.wms_routing.pure_mto_kitchen");
    return {
      orderId,
      externalOrderId,
      routingMode: "PURE_MTO_KITCHEN",
      hotKitchenLines: mtoItems.map((i) => ({ name: i.name, qty: i.qty })),
      pantryExpediterLines: [],
      destinationQueue: "petpooja_kds",
    };
  }

  if (fmcgItems.length > 0 && mtoItems.length === 0) {
    logger.info({ orderId, externalOrderId }, "ops.wms_routing.fmcg_kds_bypass_active");
    return {
      orderId,
      externalOrderId,
      routingMode: "PURE_FMCG_BYPASS",
      hotKitchenLines: [],
      pantryExpediterLines: fmcgItems.map((i) => ({
        itemId: i.itemId ?? i.id ?? 0,
        skuName: i.name,
        qty: i.qty,
      })),
      destinationQueue: "3pl_fulfillment_desk",
    };
  }

  // MIXED HYBRID BASKET: Split ticket between kitchen station ovens and expediter pantry fridge
  logger.info({ orderId, externalOrderId }, "ops.wms_routing.mixed_basket_split");
  return {
    orderId,
    externalOrderId,
    routingMode: "MIXED_HYBRID_SPLIT",
    hotKitchenLines: mtoItems.map((i) => ({ name: i.name, qty: i.qty })),
    pantryExpediterLines: fmcgItems.map((i) => ({
      itemId: i.itemId ?? i.id ?? 0,
      skuName: i.name,
      qty: i.qty,
    })),
    destinationQueue: "dual_route",
  };
}

/**
 * Process order routing decision and trigger atomic FEFO inventory deduction for retail lines.
 */
export async function dispatchRoutedFulfillment(
  orderId: number,
  externalOrderId: string,
  items: BasketItemInput[],
): Promise<HybridOrderTicket> {
  const ticket = classifyAndRouteBasket(orderId, externalOrderId, items);

  if (ticket.pantryExpediterLines.length > 0) {
    const fefoLines: FefoDeductionLine[] = ticket.pantryExpediterLines.map((l) => ({
      itemId: l.itemId,
      qtyRequired: l.qty,
    }));
    await executeFefoDeduction(fefoLines);
  }

  if (ticket.routingMode === "PURE_FMCG_BYPASS") {
    // Short-circuit hot kitchen preparation stage; immediately queue ready for 3PL logistics dispatch
    await scheduleOrderAdvance(orderId, "ready", 500).catch((err) => {
      logger.warn({ err, orderId }, "ops.wms_routing.schedule_advance_fallback");
    });
  }

  return ticket;
}
