import test from "node:test";
import assert from "node:assert/strict";
import { FOCUS_ROUTES, isFocusRoute } from "./focusRoutes";

test("every registered focus route matches itself", () => {
  for (const route of FOCUS_ROUTES) {
    assert.equal(isFocusRoute(route), true, route);
  }
});

test("subtree semantics: children of a focus route are focus routes", () => {
  assert.equal(isFocusRoute("/dish/paneer-power-bowl"), true);
  assert.equal(isFocusRoute("/checkout/anything"), true);
  assert.equal(isFocusRoute("/quick-setup/step-2"), true);
});

test("boundary-aware: sibling routes sharing a prefix do NOT match", () => {
  assert.equal(isFocusRoute("/dishes"), false);
  assert.equal(isFocusRoute("/checkout-help"), false);
  assert.equal(isFocusRoute("/loginfo"), false);
});

test("trailing slashes and query/hash fragments normalise away", () => {
  assert.equal(isFocusRoute("/checkout/"), true);
  assert.equal(isFocusRoute("/checkout?mode=alacarte"), true);
  assert.equal(isFocusRoute("/dish/dal-bowl#reviews"), true);
});

test("browse-tier routes keep their chrome", () => {
  for (const route of ["/", "/menu", "/plans", "/account", "/marketplace", "/meal-planner", "/trial", "/vouchers"]) {
    assert.equal(isFocusRoute(route), false, route);
  }
});
