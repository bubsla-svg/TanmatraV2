import {
  ADD_ONS,
  computePlanQuote,
  resolveAddOns,
  attachableAddOns,
  type AddOnId,
  type PlanId,
} from "@workspace/subscription-rules";
import { formatPaise } from "./format";

/**
 * Storefront adapter over the pure attach spine (planCatalog §4). The spine owns
 * the ids, prices, cadences, and attach points (RD bump +₹499/mo at plan
 * review; Evening Add +₹599/week post-purchase — 02 §5 / 02a §4); this module
 * only adds display copy and the checkout-total math. Nothing is priced here —
 * every paise comes from ADD_ONS, so the storefront can't drift from the bill.
 */

export interface AddOnView {
  id: AddOnId;
  name: string;
  pricePaise: number;
  cadence: "monthly" | "weekly";
  attachPoint: "plan_review" | "post_purchase";
}

const ADDON_DISPLAY: Record<AddOnId, { name: string }> = {
  rd_bump: { name: "Your dietitian" },
  evening_add: { name: "Evening meal" },
};

export function addOnView(id: AddOnId): AddOnView {
  const cfg = ADD_ONS[id];
  return {
    id,
    name: ADDON_DISPLAY[id].name,
    pricePaise: cfg.pricePaise,
    cadence: cfg.cadence,
    attachPoint: cfg.attachPoint,
  };
}

/** Does this plan permit this add-on (02e §2 allow-list)? */
export function planAllowsAddOn(planId: PlanId, id: AddOnId): boolean {
  return attachableAddOns(planId).includes(id);
}

export interface CheckoutAddOnTotal {
  basePaise: number;
  addOnPaise: number;
  totalPaise: number;
  items: AddOnView[];
}

/**
 * The bill at checkout = the plan cycle total + only the **plan-review**
 * add-ons the plan actually permits (today: rd_bump, monthly). Post-purchase
 * add-ons (evening_add, weekly) are attached AFTER the money event and never
 * touch this total. Requests for a disallowed add-on are dropped by the spine's
 * allow-list, never silently priced.
 */
export function checkoutTotalWithAddOns(
  planId: PlanId,
  requested: readonly AddOnId[],
): CheckoutAddOnTotal {
  const basePaise = computePlanQuote(planId).cycleTotalPaise;
  const { items } = resolveAddOns(planId, requested);
  const reviewItems = items.filter((it) => it.attachPoint === "plan_review");
  const views = reviewItems.map((it) => addOnView(it.id));
  const addOnPaise = views.reduce((sum, v) => sum + v.pricePaise, 0);
  return { basePaise, addOnPaise, totalPaise: basePaise + addOnPaise, items: views };
}

/**
 * One display line for the BILLED (plan_review) add-ons in a server quote —
 * "Your dietitian · +₹499/mo" — or null when the quote bills none. Prices come
 * from the quote items, not the spine: the line must state exactly what the
 * server will charge (names/cadence labels are display-only).
 */
export function addOnLineFromQuote(
  addOns: { id: AddOnId; pricePaise: number; attachPoint: string }[] | undefined,
): string | null {
  const billed = (addOns ?? []).filter((a) => a.attachPoint === "plan_review");
  if (billed.length === 0) return null;
  return billed
    .map((a) => {
      const v = addOnView(a.id);
      return `${v.name} · +${formatPaise(a.pricePaise)}/${v.cadence === "weekly" ? "wk" : "mo"}`;
    })
    .join(" · ");
}
