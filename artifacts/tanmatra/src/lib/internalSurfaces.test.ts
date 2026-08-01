import test from "node:test";
import assert from "node:assert/strict";
import { isInternalSurface } from "./internalSurfaces.js";

/**
 * The contract this guards: an Admin ERP / RD console route must never be
 * framed by the consumer chrome.
 *
 * Regression under test — every routed /admin page rendered the consumer
 * Header (`fixed top-3`, painted straight through each page's <h1>), the
 * Footer, BottomNav and the sticky checkout bar, whose combined ~19 links all
 * pointed at consumer routes deleted from routes.ts in July and therefore all
 * landed on the 404. The per-page `handle = { chrome: false }` opt-out already
 * existed and not one admin page used it, which is why the rule is now
 * route-shape based and tested here rather than left to per-page discipline.
 */

test("every routed admin surface is internal", () => {
  // Mirrors src/routes.ts. A new /admin route inherits the rule for free
  // because the predicate matches the PREFIX, not an enumerated list.
  const routed = [
    "/",
    "/admin",
    "/admin/ops",
    "/admin/ai-runs",
    "/admin/ops-agent",
    "/admin/cms-agent",
    "/admin/forecasting",
    "/admin/menu-engineering",
    "/admin/analytics",
    "/admin/support-tickets",
    "/admin/rd-applications",
    "/admin/moderation",
    "/admin/community-moderation",
    "/admin/sales-console",
    "/admin/sales-console/acme-foods",
    "/admin/kds",
    "/admin/supplier",
    "/admin/compliance",
    "/admin/login",
    "/rd-console",
    "/login",
  ];
  for (const path of routed) {
    assert.equal(
      isInternalSurface(path),
      true,
      `${path} must be treated as an internal surface`,
    );
  }
});

test("trailing slashes do not leak consumer chrome back in", () => {
  // React Router matches "/admin/ops/" to the same route, so a predicate that
  // only handled the bare form would re-mount the whole consumer header on a
  // link someone pasted with a trailing slash.
  assert.equal(isInternalSurface("/admin/ops/"), true);
  assert.equal(isInternalSurface("/rd-console/"), true);
  assert.equal(isInternalSurface("/login/"), true);
});

test("consumer paths stay non-internal", () => {
  // These 404 in this SPA today, but the predicate must not claim them:
  // if a consumer route is ever restored here it should get its chrome back
  // automatically rather than silently rendering bare.
  for (const path of [
    "/menu",
    "/checkout",
    "/dish/quinoa-bowl",
    "/account",
    "/challenges",
  ]) {
    assert.equal(
      isInternalSurface(path),
      false,
      `${path} must not be treated as internal`,
    );
  }
});

test("lookalike prefixes are not internal", () => {
  // Substring matching would have made these internal; the patterns are
  // anchored on a segment boundary precisely so they are not.
  assert.equal(isInternalSurface("/administrators"), false);
  assert.equal(isInternalSurface("/admin-tools"), false);
  assert.equal(isInternalSurface("/rd-console-demo"), false);
  assert.equal(isInternalSurface("/login-help"), false);
});
