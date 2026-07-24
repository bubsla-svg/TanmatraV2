import type { AddOnId, CreateSubscriptionInput, DietTrack, MemberInput, PlanCadence } from "./api";

/**
 * Pure assembly for the plan money path (SF-07). Turns the checkout-collected
 * pieces into the CreateSubscriptionInput the server prices — the client authors
 * NO amount here; the server bills the plan from `planId`. Kept framework-free so
 * the invariants (members threaded, address flattened, no price field) are
 * node-testable without a render.
 */

export const PLAN_DELIVERY_WINDOW = "12:30–13:30";

/** The next weekday (delivery never lands on a weekend), as YYYY-MM-DD. `from`
 *  is injectable so the mapping is testable without the clock. */
export function nextWeekdayISO(from: Date): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface PlanCheckoutAddress {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
}

/**
 * Assemble the create body. Address fields are flattened to the top-level
 * columns the create route reads (addressLabel/addressLine/city/pincode/phone);
 * `planType: "standard"` = the recurring plan (not the trial sampler).
 */
export function buildSubscriptionInput(params: {
  planId: string;
  track: DietTrack;
  cadence: PlanCadence;
  mealsPerDelivery: number;
  startDate: string;
  members: MemberInput[];
  address: PlanCheckoutAddress;
  phone: string;
  /** Plan-review add-ons to bill with the create (server re-validates against
   *  the allow-list and re-prices from canonical config — 422, never silent). */
  addOns?: AddOnId[];
}): CreateSubscriptionInput {
  return {
    planId: params.planId,
    track: params.track,
    cadence: params.cadence,
    mealsPerDelivery: params.mealsPerDelivery,
    deliveryWindow: PLAN_DELIVERY_WINDOW,
    startDate: params.startDate,
    members: params.members,
    planType: "standard",
    ...(params.addOns && params.addOns.length > 0 ? { addOns: params.addOns } : {}),
    addressLabel: params.address.label ?? "Delivery address",
    addressLine: [params.address.line1, params.address.line2].filter(Boolean).join(", "),
    city: params.address.city,
    pincode: params.address.pincode,
    phone: params.phone,
  };
}
