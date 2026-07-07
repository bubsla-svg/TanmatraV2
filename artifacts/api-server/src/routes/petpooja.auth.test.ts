import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import http from "node:http";
import { type AddressInfo } from "node:net";
import express, { type Express } from "express";

// Configure Petpooja so the router ENFORCES auth (petpoojaConfig reads env at
// call-time, so setting these before boot is sufficient).
process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";
process.env["PETPOOJA_APP_KEY"] = "key-abc";
process.env["PETPOOJA_APP_SECRET"] = "secret-xyz";
process.env["PETPOOJA_ACCESS_TOKEN"] = "token-123";
process.env["PETPOOJA_RESTAURANT_ID"] = "rest-42";

const { default: petpoojaRouter } = await import("./petpooja");

let server: http.Server;
let base = "";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.log = { info() {}, warn() {}, error() {} };
    next();
  });
  app.use(petpoojaRouter);
  return app;
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const P = "/integrations/petpooja";
const CREDS = { app_key: "key-abc", app_secret: "secret-xyz", access_token: "token-123" };

before(async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

// ── auth is ENFORCED on credential-bearing webhooks (strict) ─────────────────
test("saveorder WITHOUT credentials → 401", async () => {
  const r = await post(`${P}/saveorder`, { orderinfo: { OrderInfo: {} } });
  assert.equal(r.status, 401);
  assert.equal(r.json.success, "0");
});

test("saveorder with WRONG credentials → 401", async () => {
  const r = await post(`${P}/saveorder`, {
    app_key: "key-abc",
    app_secret: "NOPE",
    orderinfo: { OrderInfo: {} },
  });
  assert.equal(r.status, 401);
});

test("orderstatus WITHOUT credentials → 401", async () => {
  const r = await post(`${P}/orderstatus`, { clientorderID: "X", status: "1" });
  assert.equal(r.status, 401);
});

test("rider-info WITHOUT credentials → 401", async () => {
  const r = await post(`${P}/rider-info`, { order_id: "1", status: "delivered" });
  assert.equal(r.status, 401);
});

test("saveorder WITH correct credentials → passes auth (not 401)", async () => {
  // Valid creds + structurally-valid order → gets past the auth guard. It then
  // reaches the DB layer (no DB here) and 500s — the point is it is NOT 401,
  // proving authentication succeeded.
  const r = await post(`${P}/saveorder`, {
    ...CREDS,
    orderinfo: {
      OrderInfo: {
        Restaurant: { details: { restID: "rest-42" } },
        Customer: { details: { email: "", name: "T", address: "", phone: "9" } },
        Order: { details: { orderID: "T-1", total: "100" } },
        OrderItem: { details: [] },
      },
    },
  });
  assert.notEqual(r.status, 401, "authenticated request must not be rejected as unauthorized");
});

// ── lenient webhooks: allow when no creds, reject when wrong creds ────────────
test("push-menu with NO creds → allowed through to validation (400 on bad payload, not 401)", async () => {
  const r = await post(`${P}/push-menu`, { success: "1" }); // missing items[]
  assert.equal(r.status, 400);
});

test("push-menu with WRONG creds → 401 (lenient still rejects presented-but-wrong)", async () => {
  const r = await post(`${P}/push-menu`, { app_key: "key-abc", app_secret: "NOPE", items: [] });
  assert.equal(r.status, 401);
});

// ── store status round-trips through the live endpoints ──────────────────────
test("update_store_status (header secret) then get_store_status reflects it", async () => {
  const upd = await post(
    `${P}/update_store_status`,
    { restID: "rest-42", store_status: "0", turn_on_time: "2026-07-08 09:00:00", reason: "maintenance" },
    { "x-petpooja-app-secret": "secret-xyz" },
  );
  assert.equal(upd.status, 200);
  assert.equal(upd.json.status, "success");

  const get = await post(`${P}/get_store_status`, { restID: "rest-42" });
  assert.equal(get.status, 200);
  assert.equal(get.json.store_status, "0", "get must reflect the update we just made");

  // reopen so we don't leak state to other suites
  await post(
    `${P}/update_store_status`,
    { restID: "rest-42", store_status: "1", turn_on_time: "now" },
    { "x-petpooja-app-secret": "secret-xyz" },
  );
});
