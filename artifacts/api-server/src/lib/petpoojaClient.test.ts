import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import http from "node:http";
import { type AddressInfo } from "node:net";
import type { Request } from "express";

process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const {
  petpoojaConfig,
  isPetpoojaEnabled,
  verifyPetpoojaAuth,
  petpoojaAuthOk,
  serializeOrderToPetpooja,
  pushOrderToPetpooja,
  getStoreStatus,
  setStoreStatus,
} = await import("./petpoojaClient");

const CFG = {
  PETPOOJA_APP_KEY: "key-abc",
  PETPOOJA_APP_SECRET: "secret-xyz",
  PETPOOJA_ACCESS_TOKEN: "token-123",
  PETPOOJA_RESTAURANT_ID: "rest-42",
} as const;

function configure() {
  Object.assign(process.env, CFG);
}
function unconfigure() {
  for (const k of Object.keys(CFG)) delete process.env[k];
  delete process.env["PETPOOJA_SAVE_ORDER_URL"];
}

function fakeReq(body: unknown, headers: Record<string, string> = {}): Request {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return { body, path: "/integrations/petpooja/x", get: (h: string) => lower[h.toLowerCase()] } as unknown as Request;
}

const sampleOrder = {
  externalOrderId: "TNM-1001",
  totalPaise: 42500,
  addressLine: "12 MG Road",
  city: "Gurgaon",
  pincode: "122001",
  phone: "9876543210",
  dropLat: 28.46,
  dropLng: 77.03,
  items: [
    { id: 7, name: "Grilled Chicken Bowl", qty: 2, price: 18000 },
    { id: 9, name: "Quinoa Salad", quantity: 1, price: 6500 },
  ],
  fulfillmentType: "delivery",
  deliveryInstructions: "Ring the bell",
  priority: "routine",
  scheduledFor: null,
};

const nullLog = { info() {}, warn() {}, error() {} };

beforeEach(() => {
  unconfigure();
});

// ── config gating ──────────────────────────────────────────────────────────
test("integration is OFF when env is unconfigured", () => {
  assert.equal(petpoojaConfig(), null);
  assert.equal(isPetpoojaEnabled(), false);
});

test("integration is ON only when all four required vars are set", () => {
  process.env["PETPOOJA_APP_KEY"] = "k";
  process.env["PETPOOJA_APP_SECRET"] = "s";
  process.env["PETPOOJA_ACCESS_TOKEN"] = "t";
  assert.equal(isPetpoojaEnabled(), false, "3/4 set → still off");
  process.env["PETPOOJA_RESTAURANT_ID"] = "r";
  assert.equal(isPetpoojaEnabled(), true, "4/4 set → on");
  assert.equal(petpoojaConfig()!.appKey, "k");
});

// ── webhook auth ─────────────────────────────────────────────────────────────
test("verifyPetpoojaAuth: unconfigured allows through (configured:false)", () => {
  const r = verifyPetpoojaAuth(fakeReq({ app_key: "anything" }));
  assert.deepEqual(r, { ok: true, configured: false, presented: false });
});

test("verifyPetpoojaAuth: configured accepts matching body credentials", () => {
  configure();
  const r = verifyPetpoojaAuth(fakeReq({ app_key: CFG.PETPOOJA_APP_KEY, app_secret: CFG.PETPOOJA_APP_SECRET }));
  assert.deepEqual(r, { ok: true, configured: true, presented: true });
});

test("verifyPetpoojaAuth: configured rejects wrong credentials", () => {
  configure();
  const r = verifyPetpoojaAuth(fakeReq({ app_key: CFG.PETPOOJA_APP_KEY, app_secret: "WRONG" }));
  assert.equal(r.ok, false);
  assert.equal(r.presented, true);
});

test("verifyPetpoojaAuth: configured accepts header shared-secret", () => {
  configure();
  const r = verifyPetpoojaAuth(fakeReq({}, { "x-petpooja-app-secret": CFG.PETPOOJA_APP_SECRET }));
  assert.equal(r.ok, true);
});

test("verifyPetpoojaAuth: configured + no creds presented → not ok", () => {
  configure();
  const r = verifyPetpoojaAuth(fakeReq({}));
  assert.equal(r.ok, false);
  assert.equal(r.presented, false);
});

test("petpoojaAuthOk: strict rejects no-creds; lenient allows no-creds; both reject wrong-creds", () => {
  configure();
  // no creds
  assert.equal(petpoojaAuthOk(fakeReq({}), nullLog, "strict"), false);
  assert.equal(petpoojaAuthOk(fakeReq({}), nullLog, "lenient"), true);
  // wrong creds
  assert.equal(petpoojaAuthOk(fakeReq({ app_key: "x", app_secret: "y" }), nullLog, "lenient"), false);
  // right creds
  assert.equal(petpoojaAuthOk(fakeReq({ app_key: CFG.PETPOOJA_APP_KEY, app_secret: CFG.PETPOOJA_APP_SECRET }), nullLog, "strict"), true);
});

test("petpoojaAuthOk: unconfigured always allows", () => {
  assert.equal(petpoojaAuthOk(fakeReq({}), nullLog, "strict"), true);
});

// ── outbound serialization ───────────────────────────────────────────────────
test("serializeOrderToPetpooja builds a valid Save Order payload", () => {
  configure();
  const cfg = petpoojaConfig()!;
  const now = new Date("2026-07-07T10:30:00Z");
  const payload = serializeOrderToPetpooja(sampleOrder as any, cfg, { name: "Asha Rao", email: "asha@x.com" }, now);

  assert.equal(payload.app_key, CFG.PETPOOJA_APP_KEY);
  assert.equal(payload.app_secret, CFG.PETPOOJA_APP_SECRET);
  assert.equal(payload.access_token, CFG.PETPOOJA_ACCESS_TOKEN);

  const oi = payload.orderinfo.OrderInfo;
  assert.equal(oi.Restaurant.details.restID, "rest-42");
  assert.equal(oi.Customer.details.name, "Asha Rao");
  assert.equal(oi.Customer.details.phone, "9876543210");
  assert.equal(oi.Order.details.orderID, "TNM-1001");
  assert.equal(oi.Order.details.order_type, "H"); // delivery → home delivery
  assert.equal(oi.Order.details.total, "425.00");
  assert.equal(oi.Order.details.payment_type, "ONLINE");

  // items: paise → rupees, qty carried, final_price = price*qty
  assert.equal(oi.OrderItem.details.length, 2);
  assert.equal(oi.OrderItem.details[0].id, "7");
  assert.equal(oi.OrderItem.details[0].price, "180.00");
  assert.equal(oi.OrderItem.details[0].quantity, "2");
  assert.equal(oi.OrderItem.details[0].final_price, "360.00");
  assert.equal(oi.OrderItem.details[1].quantity, "1"); // read from `quantity` alias
});

test("serializeOrderToPetpooja maps fulfillment + priority", () => {
  configure();
  const cfg = petpoojaConfig()!;
  const pickup = serializeOrderToPetpooja({ ...sampleOrder, fulfillmentType: "pickup", priority: "stat" } as any, cfg, {}, new Date());
  assert.equal(pickup.orderinfo.OrderInfo.Order.details.order_type, "P");
  assert.equal(pickup.orderinfo.OrderInfo.Order.details.urgent_order, true);
});

// ── outbound push against a mock Petpooja Save Order endpoint ─────────────────
function mockPetpoojaServer(handler: (body: any) => { status: number; json: unknown }) {
  return new Promise<{ url: string; received: Promise<any>; close: () => Promise<void> }>((resolve) => {
    let resolveReceived: (b: any) => void;
    const received = new Promise<any>((r) => (resolveReceived = r));
    const server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const body = JSON.parse(raw || "{}");
        resolveReceived(body);
        const { status, json } = handler(body);
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(json));
      });
    });
    server.listen(0, () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${addr.port}/save_order`,
        received,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

test("pushOrderToPetpooja: no-op when unconfigured", async () => {
  const r = await pushOrderToPetpooja(sampleOrder as any, {}, nullLog);
  assert.equal(r.skipped, true);
  assert.equal(r.ok, false);
});

test("pushOrderToPetpooja: posts correct payload and treats success:1 as ok", async () => {
  configure();
  const mock = await mockPetpoojaServer(() => ({ status: 200, json: { success: "1", message: "saved" } }));
  process.env["PETPOOJA_SAVE_ORDER_URL"] = mock.url;

  const r = await pushOrderToPetpooja(sampleOrder as any, { name: "Asha", email: "a@x.com" }, nullLog);
  const got = await mock.received;
  await mock.close();

  assert.equal(r.ok, true);
  assert.equal(got.app_key, CFG.PETPOOJA_APP_KEY);
  assert.equal(got.orderinfo.OrderInfo.Order.details.orderID, "TNM-1001");
  assert.equal(got.orderinfo.OrderInfo.Order.details.total, "425.00");
});

test("pushOrderToPetpooja: success:0 from POS is treated as not-ok", async () => {
  configure();
  const mock = await mockPetpoojaServer(() => ({ status: 200, json: { success: "0", message: "bad order" } }));
  process.env["PETPOOJA_SAVE_ORDER_URL"] = mock.url;
  const r = await pushOrderToPetpooja(sampleOrder as any, {}, nullLog);
  await mock.close();
  assert.equal(r.ok, false);
  assert.equal(r.status, 200);
});

test("pushOrderToPetpooja: HTTP 500 is handled (ok:false, never throws)", async () => {
  configure();
  const mock = await mockPetpoojaServer(() => ({ status: 500, json: { error: "boom" } }));
  process.env["PETPOOJA_SAVE_ORDER_URL"] = mock.url;
  const r = await pushOrderToPetpooja(sampleOrder as any, {}, nullLog);
  await mock.close();
  assert.equal(r.ok, false);
});

// ── store status ─────────────────────────────────────────────────────────────
test("store status persists across update → get", () => {
  assert.equal(getStoreStatus().status, "1"); // default open
  setStoreStatus("0", "2026-07-08 09:00:00", "kitchen maintenance");
  assert.deepEqual(getStoreStatus(), { status: "0", turnOnTime: "2026-07-08 09:00:00", reason: "kitchen maintenance" });
  setStoreStatus("1", null, null);
  assert.equal(getStoreStatus().status, "1");
});
