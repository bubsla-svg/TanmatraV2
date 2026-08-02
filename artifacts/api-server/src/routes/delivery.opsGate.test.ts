/**
 * Access-control contract for the /delivery router.
 *
 * Five mutating endpoints on this router were gated with `req.isAuthenticated()`
 * — POST /delivery/events, /rider-position, /schedule-advance, /auto-assign and
 * /eta/record-actual. That check only asks "is somebody signed in", so any
 * ordinary customer with a session could write delivery events, move a rider's
 * position, advance a delivery schedule, and auto-assign riders to orders. They
 * now require ops scope, like the dispatch endpoints below them always did.
 *
 * The suite is a sweep, not a list of the five: it enumerates EVERY route
 * registered on the router and asserts each one 403s without credentials,
 * except an explicit allowlist of the three that are public by design. Two
 * properties follow that a five-case test would not have:
 *
 *   1. A route added tomorrow is covered without editing anything here. The
 *      original hole existed precisely because a per-handler gate is a thing an
 *      author can forget, and this router still gates per handler — there is no
 *      router-level `use` to catch a new route the way /ops has.
 *   2. Making a route public becomes a deliberate, reviewable act: it has to be
 *      added to PUBLIC_ROUTES here, with a reason, or the sweep fails.
 *
 * The public three are asserted reachable rather than merely un-swept, so
 * "gate the whole router" cannot pass this file by locking out the customer
 * order-tracking UI.
 *
 * DB-free: gated routes reject before their handler runs, and all three public
 * routes validate their input before issuing a query — so each assertion here
 * resolves without Postgres.
 *
 * Run from artifacts/api-server:
 *   node --test --import tsx ./src/routes/delivery.opsGate.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const { default: deliveryRouter } = await import("./delivery");

const ADMIN_TOKEN = "test-ops-token-deliverygate";

/**
 * Routes that are public BY DESIGN, with the reason.
 *
 * Keyed by "METHOD path-with-params-substituted" so the sweep below can subtract
 * them. Anything not listed here must require ops scope.
 */
const PUBLIC_ROUTES = new Map<string, string>([
  [
    "GET /delivery/probe/timeline",
    "customer order-tracking timeline — the /track page reads it for the signed-in customer's own order",
  ],
  [
    "POST /delivery/eta/estimate",
    "pre-purchase delivery estimate for a cart — quoted before an order (or an account) exists",
  ],
  [
    "GET /delivery/eta/probe",
    "customer-facing ETA for one order — same surface as the timeline above",
  ],
]);

/** Substitute a non-numeric probe for :params — see the 400 note below. */
function probePath(path: string): string {
  return path.replace(/:[A-Za-z0-9_]+/g, "probe");
}

/** Every (method, path) pair registered on the delivery router. */
function registeredRoutes(): Array<{ method: string; path: string }> {
  const out: Array<{ method: string; path: string }> = [];
  for (const layer of (deliveryRouter as unknown as { stack: any[] }).stack) {
    const route = layer.route;
    if (!route) continue;
    const path = probePath(String(route.path));
    for (const method of Object.keys(route.methods ?? {})) {
      if (method === "_all") continue;
      out.push({ method: method.toUpperCase(), path });
    }
  }
  return out;
}

async function withApp(fn: (base: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  // The real app's authMiddleware attaches isAuthenticated(). A bare test app
  // must stub it or the gate would 500 instead of 403. It returns TRUE here on
  // purpose: the hole being closed was "signed in" being mistaken for "is ops",
  // so the caller in this sweep is an authenticated ordinary customer — the
  // exact principal that used to get through.
  app.use((req, _res, next) => {
    req.isAuthenticated = (() => true) as typeof req.isAuthenticated;
    (req as unknown as { user: { id: string } }).user = { id: "regular-customer" };
    next();
  });
  app.use(deliveryRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

/** Neutralise every ambient ops credential so the caller is a plain customer. */
function asPlainCustomer(): void {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  process.env["OPS_USER_IDS"] = "";
}

test("route introspection actually sees the router", () => {
  const routes = registeredRoutes();
  // Without this, a change to Express's internals that empties the stack would
  // make every sweep below vacuously pass and this file would guard nothing.
  assert.ok(
    routes.length >= 15,
    `expected the delivery router to expose at least 15 routes, found ${routes.length}`,
  );
  for (const key of PUBLIC_ROUTES.keys()) {
    assert.ok(
      routes.some((r) => `${r.method} ${r.path}` === key),
      `PUBLIC_ROUTES lists "${key}", which is not a route on this router — ` +
        `a stale allowlist entry silently exempts nothing and hides a typo`,
    );
  }
});

test("EVERY non-public delivery route refuses an authenticated non-ops customer (403)", async () => {
  asPlainCustomer();
  const gated = registeredRoutes().filter(
    (r) => !PUBLIC_ROUTES.has(`${r.method} ${r.path}`),
  );
  assert.equal(
    gated.length,
    registeredRoutes().length - PUBLIC_ROUTES.size,
    "gated set should be every route minus the allowlist",
  );

  await withApp(async (base) => {
    for (const { method, path } of gated) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "GET" || method === "HEAD" ? {} : { body: "{}" }),
      });
      assert.equal(
        res.status,
        403,
        `${method} ${path} must require ops scope, got ${res.status}`,
      );
      const body = (await res.json()) as { error?: string };
      assert.equal(body.error, "kitchen scope required");
    }
  });
});

// Named individually so a regression reads as "customers can write delivery
// events again" rather than as an opaque sweep diff.
for (const path of [
  "/delivery/events",
  "/delivery/rider-position",
  "/delivery/schedule-advance",
  "/delivery/auto-assign",
  "/delivery/eta/record-actual",
]) {
  test(`POST ${path} — previously any signed-in user — is refused (403)`, async () => {
    asPlainCustomer();
    await withApp(async (base) => {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: 1, event: "picked_up" }),
      });
      assert.equal(res.status, 403);
      const body = (await res.json()) as { error?: string };
      assert.equal(body.error, "kitchen scope required");
    });
  });
}

test("the public three stay reachable without ops scope", async () => {
  asPlainCustomer();
  await withApp(async (base) => {
    for (const [key, why] of PUBLIC_ROUTES) {
      const [method, path] = key.split(" ") as [string, string];
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "GET" || method === "HEAD" ? {} : { body: "{}" }),
      });
      // The property under test is "not gated", so the assertion is on the two
      // gate statuses and not on a specific success code — these three answer
      // differently by design. The timeline and ETA reads 400 on the
      // non-numeric probe param; /eta/estimate accepts an empty cart and
      // answers 200 through its circuit-breaker fallback. Both resolve without
      // Postgres, which is what keeps this file DB-free.
      assert.ok(
        res.status !== 403 && res.status !== 401,
        `${key} is public (${why}) but was refused with ${res.status}`,
      );
    }
  });
});

test("an ops caller gets past the gate on a previously-open route", async () => {
  // The mirror of the sweep: proves the 403s above come from the gate rejecting
  // this principal, not from the route being broken for everyone.
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  process.env["OPS_USER_IDS"] = "";
  await withApp(async (base) => {
    const res = await fetch(`${base}/delivery/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
      body: "{}",
    });
    // Empty body fails eventBody.safeParse AFTER the gate lets it through, so
    // 400 — again reached without a query.
    assert.equal(
      res.status,
      400,
      `an ops caller must clear the gate and reach validation, got ${res.status}`,
    );
  });
});
