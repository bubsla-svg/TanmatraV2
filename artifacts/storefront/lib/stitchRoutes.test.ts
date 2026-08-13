import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isStitchRoute,
  stitchCanvasForced,
  STITCH_EXACT_ROUTES,
  STITCH_PREFIX_ROUTES,
} from "./stitchRoutes";
import { STITCH_SCREEN_REGISTRY, getStitchScreenForRoute } from "./stitchScreenRegistry";

// ── stitchCanvasForced: the toggle-vs-canvas contract (2026-08-11 report:
//    "light and dark theme toggle in nav bar is dead") ─────────────────────

test("with no stored choice, Stitch routes force the dark canvas", () => {
  assert.equal(stitchCanvasForced("/menu", null), true);
  assert.equal(stitchCanvasForced("/menu", "system"), true);
  assert.equal(stitchCanvasForced("/dish/quinoa-khichdi", null), true);
});

test("an explicit stored choice always wins over the canvas", () => {
  // "light" is the case that used to lose: data-stitch beat next-themes.
  assert.equal(stitchCanvasForced("/menu", "light"), false);
  // "dark" also unforces — data-theme paints dark anyway, and unforcing
  // keeps exactly one mechanism in charge once the user has chosen.
  assert.equal(stitchCanvasForced("/menu", "dark"), false);
});

test("non-Stitch routes are never forced regardless of choice", () => {
  // /account and /legal joined the canvas in the 2026-08-13 seam tranche —
  // /about and /marketplace are the still-light fixtures now.
  assert.equal(stitchCanvasForced("/about", null), false);
  assert.equal(stitchCanvasForced("/about", "light"), false);
  assert.equal(stitchCanvasForced("/marketplace", null), false);
});

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
  for (const route of ["/about", "/recipes", "/marketplace", "/team", "/community"]) {
    assert.equal(isStitchRoute(route), false, `${route} should not be a Stitch route`);
  }
});

test("the 2026-08-13 seam tranche renders dark, families included", () => {
  for (const route of ["/care", "/care/diabetes", "/account", "/account/orders", "/legal", "/legal/terms", "/faq"]) {
    assert.equal(isStitchRoute(route), true, `${route} should be a Stitch route`);
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

test("STITCH_SCREEN_REGISTRY defines valid screen specifications for Tanmatra routes", () => {
  assert.equal(STITCH_SCREEN_REGISTRY.length > 10, true, "should register at least 10 core screens");
  for (const spec of STITCH_SCREEN_REGISTRY) {
    assert.equal(typeof spec.projectId, "string");
    assert.equal(typeof spec.screenId, "string");
    assert.equal(typeof spec.title, "string");
    assert.equal(typeof spec.route, "string");
  }
});

test("getStitchScreenForRoute resolves exact routes and dynamic segments", () => {
  const home = getStitchScreenForRoute("/");
  assert.equal(home?.title, "Tanmatra Home: Clinical Feed");
  assert.equal(home?.screenId, "966d396f55ed43ada3e69ff56950d3ef");

  const pdp = getStitchScreenForRoute("/dish/keto-salmon");
  assert.equal(pdp?.title, "Dish Detail: Charcoal Smoothie");
  assert.equal(pdp?.screenId, "ef20a9487d414d8aaa48ab69e4b1f22d");

  const planConfig = getStitchScreenForRoute("/plan/metabolic-reset");
  assert.equal(planConfig?.title, "Plan Configuration: 5-Day Metabolic Reset");

  const care = getStitchScreenForRoute("/care/diabetes");
  assert.equal(care?.title, "Clinical Care: Metabolic Protocols");

  const connections = getStitchScreenForRoute("/account/connections");
  assert.equal(connections?.title, "Health Connections: Apple Health & Android Sync");

  const wearablesLegacy = getStitchScreenForRoute("/account/wearables");
  assert.equal(wearablesLegacy?.title, "Health Connections: Apple Health & Android Sync");
});

