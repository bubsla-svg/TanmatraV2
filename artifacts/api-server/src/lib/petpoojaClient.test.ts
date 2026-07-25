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
  petpoojaAllowUnauthenticated,
  petpoojaWebhooksMounted,
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
  delete process.env["PETPOOJA_WEBHOOKS_ENABLED"];
  delete process.env["PETPOOJA_WEBHOOKS_INSECURE_ALLOW_UNAUTHENTICATED"];
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
// These endpoints FAIL CLOSED. "Unconfigured" is not a pass, and "no
// credentials presented" is not a pass in either mode. The pre-25-Jul-2026
// behaviour — where both of those returned true — left /push-menu, which writes
// menu_items.price_paise, unauthenticated in every deployment state.
test("verifyPetpoojaAuth: unconfigured is NOT a pass (fails closed)", () => {
  const r = verifyPetpoojaAuth(fakeReq({ app_key: "anything" }));
  assert.deepEqual(r, { ok: false, configured: false, presented: false, secretMatches: false });
});

test("verifyPetpoojaAuth: configured accepts matching body credentials", () => {
  configure();
  const r = verifyPetpoojaAuth(fakeReq({ app_key: CFG.PETPOOJA_APP_KEY, app_secret: CFG.PETPOOJA_APP_SECRET }));
  assert.deepEqual(r, { ok: true, configured: true, presented: true, secretMatches: true });
});

test("verifyPetpoojaAuth: configured rejects wrong credentials", () => {
  configure();
  const r = verifyPetpoojaAuth(fakeReq({ app_key: CFG.PETPOOJA_APP_KEY, app_secret: "WRONG" }));
  assert.equal(r.ok, false);
  assert.equal(r.presented, true);
  assert.equal(r.secretMatches, false);
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

test("verifyPetpoojaAuth: right secret + missing app_key → not ok, but secretMatches", () => {
  configure();
  const r = verifyPetpoojaAuth(fakeReq({ app_secret: CFG.PETPOOJA_APP_SECRET }));
  assert.equal(r.ok, false, "app_key is absent, so this is not a full match");
  assert.equal(r.secretMatches, true, "the shared secret itself is correct");
});

test("petpoojaAuthOk: NEITHER mode admits a credential-less request", () => {
  configure();
  assert.equal(petpoojaAuthOk(fakeReq({}), nullLog, "strict"), false);
  assert.equal(
    petpoojaAuthOk(fakeReq({}), nullLog, "lenient"),
    false,
    "lenient used to wave this through — that was the push-menu hole",
  );
});

test("petpoojaAuthOk: both modes reject wrong credentials", () => {
  configure();
  assert.equal(petpoojaAuthOk(fakeReq({ app_key: "x", app_secret: "y" }), nullLog, "strict"), false);
  assert.equal(petpoojaAuthOk(fakeReq({ app_key: "x", app_secret: "y" }), nullLog, "lenient"), false);
});

test("petpoojaAuthOk: both modes accept fully-correct credentials", () => {
  configure();
  const req = fakeReq({ app_key: CFG.PETPOOJA_APP_KEY, app_secret: CFG.PETPOOJA_APP_SECRET });
  assert.equal(petpoojaAuthOk(req, nullLog, "strict"), true);
  assert.equal(petpoojaAuthOk(req, nullLog, "lenient"), true);
});

test("petpoojaAuthOk: lenient (only) tolerates a correct secret with no app_key", () => {
  configure();
  const req = fakeReq({ app_secret: CFG.PETPOOJA_APP_SECRET });
  assert.equal(petpoojaAuthOk(req, nullLog, "strict"), false);
  assert.equal(petpoojaAuthOk(req, nullLog, "lenient"), true);
});

test("petpoojaAuthOk: unconfigured REJECTS — blanking env must not open the surface", () => {
  assert.equal(petpoojaAuthOk(fakeReq({}), nullLog, "strict"), false);
  assert.equal(petpoojaAuthOk(fakeReq({}), nullLog, "lenient"), false);
  assert.equal(
    petpoojaAuthOk(fakeReq({ app_key: "anything", app_secret: "anything" }), nullLog, "lenient"),
    false,
    "there is no secret to check against, so nobody can authenticate",
  );
});

// ── the dev escape hatch, and the mount switch ───────────────────────────────
test("petpoojaAllowUnauthenticated: opt-in only, and never in production", () => {
  assert.equal(petpoojaAllowUnauthenticated(), false, "absent flag → off");
  process.env["PETPOOJA_WEBHOOKS_INSECURE_ALLOW_UNAUTHENTICATED"] = "true";
  assert.equal(petpoojaAllowUnauthenticated(), true);

  const prevNodeEnv = process.env["NODE_ENV"];
  process.env["NODE_ENV"] = "production";
  assert.equal(
    petpoojaAllowUnauthenticated(),
    false,
    "production refuses the flag no matter how it is set",
  );
  if (prevNodeEnv === undefined) delete process.env["NODE_ENV"];
  else process.env["NODE_ENV"] = prevNodeEnv;
});

test("petpoojaAuthOk: the dev flag is the ONLY way an unconfigured surface admits anyone", () => {
  process.env["PETPOOJA_WEBHOOKS_INSECURE_ALLOW_UNAUTHENTICATED"] = "true";
  assert.equal(petpoojaAuthOk(fakeReq({}), nullLog, "strict"), true);
});

test("petpoojaWebhooksMounted: unconfigured → unmounted; configured → mounted", () => {
  assert.equal(petpoojaWebhooksMounted(), false, "nothing configured → no surface");
  configure();
  assert.equal(petpoojaWebhooksMounted(), true);
});

test("petpoojaWebhooksMounted: PETPOOJA_WEBHOOKS_ENABLED=false decommissions a configured integration", () => {
  configure();
  for (const off of ["false", "0", "off", "no", "FALSE"]) {
    process.env["PETPOOJA_WEBHOOKS_ENABLED"] = off;
    assert.equal(petpoojaWebhooksMounted(), false, `${off} → unmounted`);
  }
  process.env["PETPOOJA_WEBHOOKS_ENABLED"] = "true";
  assert.equal(petpoojaWebhooksMounted(), true);
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

