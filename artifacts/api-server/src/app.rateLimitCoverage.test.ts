/**
 * F-5 regression: every money-path mount carries a rate limiter.
 *
 * `POST /api/subscriptions` runs `createOrderForNewSubscription` and bills the
 * first cycle — it is an order path by behaviour. It was nonetheless the one
 * such mount with no limiter at all: not by policy, and not because the router
 * carries its own (routes/planDrafts.ts does, and app.ts says so; this one did
 * not). Plan creation was therefore the cheapest way to pressure the order
 * pipeline.
 *
 * Asserted against app.ts's source rather than by driving requests: what is
 * being protected is the MOUNT TABLE, and a request-driven test would only
 * prove the one route it happened to call. This catches the next money route
 * mounted without a limiter, which is the actual failure mode.
 *
 * DB-free — it reads a file.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_SRC = fs.readFileSync(path.join(HERE, "app.ts"), "utf8");

/** Mounts that move money or create an order, and the limiter each must have. */
const MONEY_PATH_MOUNTS = [
  { mount: "/api/orders", limiter: "orderRateLimit" },
  { mount: "/api/checkout", limiter: "orderRateLimit" },
  { mount: "/api/subscriptions", limiter: "orderRateLimit" },
  { mount: "/api/payments", limiter: "paymentRouteRateLimit" },
];

for (const { mount, limiter } of MONEY_PATH_MOUNTS) {
  test(`${mount} is rate limited with ${limiter}`, () => {
    assert.ok(
      APP_SRC.includes(`app.use("${mount}", ${limiter});`),
      `${mount} must be mounted with ${limiter} in app.ts — an unlimited money path is F-5`,
    );
  });
}

test("subscriptions shares the order budget, not a looser one of its own", () => {
  // The point of reusing `orderRateLimit` is that creating a plan and creating
  // an order cost the same downstream. A separate, larger budget here would
  // re-open the hole under a different name.
  const subs = APP_SRC.match(/app\.use\("\/api\/subscriptions",\s*(\w+)\);/);
  const orders = APP_SRC.match(/app\.use\("\/api\/orders",\s*(\w+)\);/);
  assert.ok(subs, "no /api/subscriptions mount found in app.ts");
  assert.ok(orders, "no /api/orders mount found in app.ts");
  assert.equal(subs[1], orders[1], "subscriptions must share the order limiter");
});
