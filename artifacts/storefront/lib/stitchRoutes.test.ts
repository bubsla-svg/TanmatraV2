import assert from "node:assert/strict";
import { test } from "node:test";
import { isStitchRoute, STITCH_EXACT_ROUTES, STITCH_PREFIX_ROUTES } from "./stitchRoutes";

test("exact routes render on the dark canvas", () => {
  for (const route of STITCH_EXACT_ROUTES) {
    assert.equal(isStitchRoute(route), true, `${route} should be a Stitch route`);
  }
});

test("a prefix family matches only with something after the slash", () => {
  assert.equal(isStitchRoute("/dish/wild-salmon-bowl"), true);
  assert.equal(isStitchRoute("/dish/"), false, "bare prefix with nothing after it is not a route");
  assert.equal(isStitchRoute("/dish"), false, "no trailing slash at all is not a route");
});

test("/plan/ does not swallow /plans", () => {
  assert.equal(isStitchRoute("/plans"), true);
  assert.equal(isStitchRoute("/plan/desk_fuel"), true);
  assert.equal(isStitchRoute("/plan"), false);
});

test("unrelated routes stay on the light canvas", () => {
  for (const route of ["/about", "/faq", "/recipes", "/legal/terms", "/account/orders", "/marketplace"]) {
    assert.equal(isStitchRoute(route), false, `${route} should not be a Stitch route`);
  }
});

test("query string, hash and a trailing slash normalise to the same answer", () => {
  assert.equal(isStitchRoute("/menu/"), true);
  assert.equal(isStitchRoute("/menu?x=1"), true);
  assert.equal(isStitchRoute("/menu#top"), true);
  assert.equal(isStitchRoute("/dish/salmon/?ref=abc"), true);
});

test("STITCH_PREFIX_ROUTES entries all end with a slash", () => {
  for (const prefix of STITCH_PREFIX_ROUTES) {
    assert.equal(prefix.endsWith("/"), true, `${prefix} must end with "/" or it could swallow a sibling route`);
  }
});
