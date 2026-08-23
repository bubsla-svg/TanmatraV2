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

function to12Hour(hhmm: string): { time: string; suffix: "am" | "pm" } {
  const [rawH = "0", rawM = "00"] = hhmm.trim().split(":");
  const h = Number(rawH);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { time: `${h12}:${rawM}`, suffix };
}

/**
 * The delivery window in the 12-hour form customers read, DERIVED from the same
 * constant `buildSubscriptionInput` books the delivery with.
 *
 * Three surfaces had hand-typed "12:30–1:30" beside a constant reading
 * "12:30–13:30". They agreed by luck. Deriving it means a change to the booked
 * window cannot leave a promise behind that we no longer keep.
 */
export const PLAN_DELIVERY_WINDOW_LABEL = (() => {
  const [from = "", to = ""] = PLAN_DELIVERY_WINDOW.split(/[–-]/);
  const a = to12Hour(from);
  const b = to12Hour(to);
  // "12:30–1:30 pm" when both ends share a half of the day; both suffixes
  // otherwise, since "9:30–1:30 pm" would read as a four-hour window.
  return a.suffix === b.suffix
    ? `${a.time}–${b.time} ${b.suffix}`
    : `${a.time} ${a.suffix}–${b.time} ${b.suffix}`;
})();

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
