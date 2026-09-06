import type { AddOnId, CreateSubscriptionInput, DietTrack, MemberDiet, MemberInput, PlanCadence } from "./api";

/**
 * Pure assembly for the plan money path (SF-07). Turns the checkout-collected
 * pieces into the CreateSubscriptionInput the server prices — the client authors
 * NO amount here; the server bills the plan from `planId`. Kept framework-free so
 * the invariants (members threaded, address flattened, no price field) are
 * node-testable without a render.
 */

export const PLAN_DELIVERY_WINDOW = "12:30–13:30";

/**
 * Weekday-only, and not by assertion: `nextWeekdayISO` below skips Saturday and
 * Sunday when it picks a start date, so this describes what the code does.
 */
export const PLAN_DELIVERY_DAYS_LABEL = "Weekdays, Monday to Friday";

/**
 * The same fact worded to sit mid-sentence ("Delivered weekdays, Monday to
 * Friday, 12:30–1:30 pm.").
 *
 * It exists because two surfaces reached for `PLAN_DELIVERY_DAYS_LABEL
 * .toLowerCase()` and rendered "monday to friday" — lowercasing proper nouns
 * along with the leading W they actually wanted (F-9). Only the first word
 * changes case between the two forms, so they are written out rather than
 * derived: a `.replace()` clever enough to spare the weekday names is harder
 * to read than the seven words it saves.
 */
export const PLAN_DELIVERY_DAYS_SENTENCE = "weekdays, Monday to Friday";

/**
 * NO DELIVERY TIME IS RENDERED (owner, 2026-09-06). `PLAN_DELIVERY_WINDOW` is
 * BOOKING DATA — `buildSubscriptionInput` writes it into `deliveryWindow` so the
 * server schedules against a real window — and it is deliberately the only form
 * of it left. The derived 12-hour label eight surfaces used to print
 * ("12:30–1:30 pm") is gone: the storefront no longer promises a clock time it
 * cannot keep for every address. Do not re-derive one here; planOffer.test.ts
 * fails the build on any surface that states a delivery time.
 */

/**
 * The eater's diet, from the track they already chose (Law 4).
 *
 * The member profile carries its own `diet` and the checkout carries a `track`,
 * and nothing kept them in step: the draft defaults to "veg", so a buyer who
 * picked non-veg and never opened the diet select submitted a veg member beside
 * a nonveg track. Where the select is not shown at all — the trial, which asked
 * this on /trial already — deriving it is the only correct answer.
 *
 * "egg" maps to "any" rather than to either side: an eggetarian is neither
 * strictly vegetarian nor an omnivore, and picking one would be a dietary claim
 * we were never given.
 */
export function memberDietForTrack(track: DietTrack): MemberDiet {
  if (track === "veg") return "veg";
  if (track === "nonveg") return "nonveg";
  return "any";
}

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
  /** Optional attribution ref cookie parameter (L-7 personalization/attribution). */
  ref?: string;
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
    ...(params.ref ? { ref: params.ref } : {}),
    addressLabel: params.address.label ?? "Delivery address",
    addressLine: [params.address.line1, params.address.line2].filter(Boolean).join(", "),
    city: params.address.city,
    pincode: params.address.pincode,
    phone: params.phone,
  };
}
