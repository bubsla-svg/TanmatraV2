/**
 * Access-control contract for the /ops router.
 *
 * Four routes on this router shipped without an ops gate — GET /ops/inventory,
 * GET /ops/packaging, GET /ops/recipes and GET /ops/recipes/:slug — because the
 * gate was a per-handler call (`if (!requireOps(req, res)) return;`) that those
 * four handlers simply never made. Unauthenticated callers could read the full
 * inventory list, the packaging list, and the recipe book including
 * `food_cost_paise` (our per-dish unit economics).
 *
 * The fix moved the gate to router-level middleware. This suite locks that in
 * two ways:
 *   1. A behavioural sweep that enumerates EVERY route registered on the router
 *      and asserts each one 403s without credentials. A route added tomorrow is
 *      covered automatically — there is no list here to forget to update.
 *   2. A structural assertion that the gate is the FIRST layer on the router,
 *      because Express matches layers in registration order and a route
 *      registered above the `router.use(...)` would bypass it.
 *
 * DB-free: the gate rejects before any handler runs, so no query is issued.
 * Run from artifacts/api-server:
 *   node --test --import tsx ./src/routes/ops.gate.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const { default: opsRouter } = await import("./ops");

const ADMIN_TOKEN = "test-ops-token-opsgate";

async function withApp(fn: (base: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  // The real app's authMiddleware attaches isAuthenticated(); the gate calls
  // it, so a bare test app must stub it or the 403 path would 500 instead.
  app.use((req, _res, next) => {
    req.isAuthenticated = (() => false) as typeof req.isAuthenticated;
    next();
  });
  app.use("/ops", opsRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

/** Every (method, path) pair registered on the ops router, params filled in. */
function registeredRoutes(): Array<{ method: string; path: string }> {
  const out: Array<{ method: string; path: string }> = [];
  for (const layer of (opsRouter as unknown as { stack: any[] }).stack) {
    const route = layer.route;
    if (!route) continue;
    const path = String(route.path).replace(/:[A-Za-z0-9_]+/g, "probe");
    for (const method of Object.keys(route.methods ?? {})) {
      if (method === "_all") continue;
      out.push({ method: method.toUpperCase(), path });
    }
  }
  return out;
}

test("the ops gate is the FIRST layer on the router", () => {
  const stack = (opsRouter as unknown as { stack: any[] }).stack;
  assert.ok(stack.length > 0, "ops router has no layers at all");
  assert.equal(
    stack[0].route,
    undefined,
    "layer 0 of the ops router must be the router-level ops gate, not a route. " +
      "Express matches layers in registration order, so any route registered " +
      "above the router.use(...) gate is reachable without ops scope.",
  );
});

test("EVERY route on the ops router refuses an unauthenticated caller (403)", async () => {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  const routes = registeredRoutes();
  // Sanity: if introspection silently returned nothing, the sweep below would
  // vacuously pass and this suite would guard nothing.
  assert.ok(
    routes.length >= 15,
    `expected the ops router to expose at least 15 routes, found ${routes.length}`,
  );

  await withApp(async (base) => {
    for (const { method, path } of routes) {
      const res = await fetch(`${base}/ops${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "GET" || method === "HEAD" ? {} : { body: "{}" }),
      });
      assert.equal(
        res.status,
        403,
        `${method} /ops${path} must require ops scope, got ${res.status}`,
      );
    }
  });
});

// The four that were actually exposed, named explicitly so a regression reads
// as "the inventory list is public again" rather than as an opaque sweep diff.
for (const path of ["/inventory", "/packaging", "/recipes", "/recipes/probe-slug"]) {
  test(`GET /ops${path} — previously ungated — is refused (403)`, async () => {
    process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
    await withApp(async (base) => {
      const res = await fetch(`${base}/ops${path}`);
      assert.equal(res.status, 403);
      const body = (await res.json()) as { error?: string };
      assert.equal(body.error, "kitchen scope required");
    });
  });
}

test("a wrong x-admin-token is refused, not treated as valid", async () => {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  await withApp(async (base) => {
    const res = await fetch(`${base}/ops/inventory`, {
      headers: { "x-admin-token": "not-the-token" },
    });
    assert.equal(res.status, 403);
  });
});

test("a valid x-admin-token passes the gate through to the handler", async () => {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  await withApp(async (base) => {
    // /ops/measurements is the one DB-free handler on this router, so a 200
    // here proves the middleware calls next() — i.e. the gate is a gate and not
    // a blanket deny.
    const res = await fetch(`${base}/ops/measurements`, {
      headers: { "x-admin-token": ADMIN_TOKEN },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { weight?: { base?: { gm?: number } } };
    assert.equal(body.weight?.base?.gm, 1000);
  });
});
