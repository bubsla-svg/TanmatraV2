/**
 * The dish surface's wiring for plan item 1.1 — the toggle, and the two funnel
 * events that make it readable.
 *
 * Run: node --test --import tsx ./lib/dishSurface.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PDP = fs.readFileSync(
  path.join(HERE, "..", "app", "(focus)", "dish", "[slug]", "page.tsx"),
  "utf8",
);
const TOGGLE = fs.readFileSync(
  path.join(HERE, "..", "components", "menu", "DishPlanToggle.tsx"),
  "utf8",
);

test("the toggle renders only when a plan actually carries the dish", () => {
  // 60 of 116 dishes are in no bookable plan. An unconditional toggle would
  // offer those a plan that never serves them.
  assert.match(PDP, /planOffer && \(/, "the toggle must be conditional on an offer existing");
  assert.match(PDP, /dishPlanOffer\(dish\.slug, dishes\)/);
});

test("the offer is resolved server-side", () => {
  // The rotation comes off the catalog the page already loaded; making the
  // client fetch it would ship the plan catalog to the browser for a price it
  // cannot be allowed to compute anyway.
  assert.doesNotMatch(TOGGLE, /dishPlanOffer\(/, "the toggle must receive the offer, not derive it");
});

test("the toggle states no amount it computed itself", () => {
  // Every figure is formatted from a passed prop. Arithmetic here would be a
  // second pricing authority on the one screen that compares two prices.
  assert.doesNotMatch(TOGGLE, /[*/]\s*100\b/, "no paise arithmetic in a display component");
  assert.match(TOGGLE, /formatPaise\(offer\.perDeliveryPaise\)/);
  assert.match(TOGGLE, /formatPaise\(dishPricePaise\)/);
});

test("a saving renders only when the offer carries one", () => {
  // The whole point of dishPlanOffer's null: 27 of 56 carried dishes have no
  // saving, and the plan side must say what the plan is for instead of
  // inventing a discount.
  assert.match(TOGGLE, /offer\.savingPaise != null \?/);
  assert.match(TOGGLE, /Not cheaper than this dish on its own/);
});

test("renewal copy branches on what the server actually does", () => {
  // registersAutopayMandate is the api-server's own condition (weekly,
  // fortnightly and monthly mint mandates; quarterly stays prepaid — see
  // lib/planDecisionFacts.ts). Claiming renewal where no mandate registers
  // would repeat the defect #49 was corrected for.
  assert.match(TOGGLE, /registersAutopayMandate\(offer\.cycle\)/);
  assert.match(TOGGLE, /Nothing renews automatically/);
  assert.match(TOGGLE, /UPI Autopay/);
});

test("the toggle does not add a second money CTA", () => {
  // The page's own doc comment records dropping the template's "Buy it now"
  // because a second money CTA forks the canonical add → cart → checkout path.
  // The plan side navigates to the plan; it never adds to cart or pays.
  assert.doesNotMatch(TOGGLE, /AddToCart|addLine|runCheckout|razorpay/i);
  assert.match(TOGGLE, /href=\{`\/plan\/\$\{offer\.planId\}`\}/);
});

test("the dish surface emits its funnel steps", () => {
  assert.match(PDP, /<ViewDishBeacon/, "view_dish had no emitter at all");
  assert.match(TOGGLE, /emitFunnel\("plan_toggle"/);
  assert.match(TOGGLE, /emitFunnel\("subscribe_cta_click"/);
});

test("view_dish records whether a plan was even on offer", () => {
  // Without it, a dish with no plan to toggle to sits in the denominator and
  // reports the plan option as ignored when it was never shown.
  const beacon = fs.readFileSync(
    path.join(HERE, "..", "components", "menu", "ViewDishBeacon.tsx"),
    "utf8",
  );
  assert.match(beacon, /has_plan_option: hasPlanOption/);
  assert.match(PDP, /hasPlanOption=\{planOffer !== null\}/);
});

test("a toggle switch is not reported when nothing changed", () => {
  // Re-tapping the selected segment is not a decision; counting it would
  // inflate engagement with the plan option.
  assert.match(TOGGLE, /if \(next === mode\) return;/);
});
