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
  decomposeOrderCharge,
  pushOrderToPetpooja,
  getStoreStatus,
  setStoreStatus,
} = await import("./petpoojaClient");

// Dynamically imported for the same reason as the line above: these modules
// touch the db config at load time, so they must not be hoisted above the
// DATABASE_URL assignment.
//
// `computeChargePaise` is imported *into the test* deliberately. The money
// assertions below are stated as a relationship to it, not as hardcoded rupee
// literals — a literal would go stale the day a GST rate or the delivery fee
// moves, and would go stale silently, which is the exact failure this whole
// branch exists to remove. The one place a literal is still used is the
// reconciliation identity itself, because that identity is Petpooja's, not
// ours, and is not ours to drift.
const { computeChargePaise, FREE_DELIVERY_THRESHOLD_PAISE } = await import("./loyaltyEngine");

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

// ₹425 of food, delivery, no discount. Under the free-delivery threshold, so it
// carries the ₹50 fee; `chargePaise` is what checkout would have stored for it,
// asserted below against `computeChargePaise` rather than assumed.
const SAMPLE_CHARGE = computeChargePaise({
  finalPaise: 42500,
  subtotalPaise: 42500,
  fulfillmentType: "delivery",
});

const sampleOrder = {
  externalOrderId: "TNM-1001",
  totalPaise: 42500,
  chargePaise: SAMPLE_CHARGE.chargePaise,
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

const paise = (rupeeString: string) => Math.round(parseFloat(rupeeString) * 100);

/**
 * Petpooja's own reconciliation identity, asserted against a built payload:
 *
 *   total = Σ(item final_price) - discount_total + tax_total
 *           + delivery_charges + packing_charges
 *
 * This is the assertion that matters most in this file. Every individual money
 * field could be independently wrong and still pass a per-field test; only the
 * identity catches a *combination* that does not add up, which is the form the
 * old bug took — the previous payload balanced perfectly (425 = 425 + 0 + 0)
 * while describing an order that had no tax and no delivery fee. Checking the
 * sum is how a self-consistent lie gets caught.
 */
function assertBalances(payload: any) {
  const d = payload.orderinfo.OrderInfo.Order.details;
  const itemSum = payload.orderinfo.OrderInfo.OrderItem.details.reduce(
    (sum: number, it: any) => sum + paise(it.final_price),
    0,
  );
  const rhs =
    itemSum -
    paise(d.discount_total) +
    paise(d.tax_total) +
    paise(d.delivery_charges) +
    paise(d.packing_charges);
  assert.equal(
    paise(d.total),
    rhs,
    `payload does not balance: total=${d.total} items=${itemSum} disc=${d.discount_total} tax=${d.tax_total} del=${d.delivery_charges} pack=${d.packing_charges}`,
  );
}

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
  assert.equal(oi.Order.details.payment_type, "ONLINE");

  // `total` is the GRAND total — what the customer actually paid — not the meal
  // subtotal. Established empirically from this outlet's own order history via
  // get_orders_api: across 82 real orders the grand-total reading of `total`
  // holds 82/82 and the subtotal reading holds 0/82. Sending the subtotal here
  // (which is what this code used to do) understates every order in the
  // outlet's books by exactly the GST and the delivery fee.
  assert.equal(paise(oi.Order.details.total), SAMPLE_CHARGE.chargePaise);
  assert.equal(paise(oi.Order.details.tax_total), SAMPLE_CHARGE.gstPaise);
  assert.equal(paise(oi.Order.details.delivery_charges), SAMPLE_CHARGE.deliveryFeePaise);
  assert.equal(oi.Order.details.discount_total, "0.00", "no discount on this order");
  assert.equal(oi.Order.details.packing_charges, "0", "we do not levy a container charge");
  assertBalances(payload);

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
  const pickupCharge = computeChargePaise({
    finalPaise: 42500,
    subtotalPaise: 42500,
    fulfillmentType: "pickup",
  });
  const pickup = serializeOrderToPetpooja(
    { ...sampleOrder, chargePaise: pickupCharge.chargePaise, fulfillmentType: "pickup", priority: "stat" } as any,
    cfg,
    {},
    new Date(),
  );
  const d = pickup.orderinfo.OrderInfo.Order.details;
  assert.equal(d.order_type, "P");
  assert.equal(d.urgent_order, true);
  // Pickup carries no delivery fee, so the fee AND its 18% GST both vanish —
  // the tax line is food GST only. A flat "always ₹50" would balance the
  // identity and still bill the outlet for a delivery that never happened.
  assert.equal(d.delivery_charges, "0.00");
  assert.equal(paise(d.tax_total), pickupCharge.gstPaise);
  assert.equal(paise(d.total), pickupCharge.chargePaise);
  assertBalances(pickup);
});

// ── charge decomposition ─────────────────────────────────────────────────────
test("decomposeOrderCharge reproduces computeChargePaise from the stored row", () => {
  const got = decomposeOrderCharge(sampleOrder as any);
  assert.equal(got.reconciled, true);
  assert.equal(got.totalPaise, SAMPLE_CHARGE.chargePaise);
  assert.equal(got.taxPaise, SAMPLE_CHARGE.gstPaise);
  assert.equal(got.deliveryFeePaise, SAMPLE_CHARGE.deliveryFeePaise);
  assert.equal(got.discountPaise, 0);
});

test("a discounted order reports the discount and still balances", () => {
  configure();
  const cfg = petpoojaConfig()!;
  // Same ₹425 of menu-priced food, but ₹75 came off it (bundle discount,
  // first-order offer, credit redeemed — the row does not distinguish them and
  // `discount_total` does not ask it to). The pre-discount subtotal is what
  // decides the delivery fee, which is why it is passed separately.
  const discounted = { ...sampleOrder, totalPaise: 35000 };
  const expected = computeChargePaise({
    finalPaise: 35000,
    subtotalPaise: 42500,
    fulfillmentType: "delivery",
  });
  const payload = serializeOrderToPetpooja(
    { ...discounted, chargePaise: expected.chargePaise } as any,
    cfg,
    {},
    new Date(),
  );
  const d = payload.orderinfo.OrderInfo.Order.details;
  assert.equal(paise(d.discount_total), 7500, "425 of menu price less the 350 that was payable");
  assert.equal(paise(d.total), expected.chargePaise);
  assert.equal(paise(d.tax_total), expected.gstPaise);
  assertBalances(payload);
});

test("the delivery fee follows the PRE-discount subtotal, not the payable total", () => {
  configure();
  const cfg = petpoojaConfig()!;
  // Menu price clears the free-delivery threshold; the discount drops the
  // payable amount back below it. The customer was shown free delivery on the
  // basis of what they put in the cart, so free delivery is what they get —
  // and it is what the POS must be told.
  const gross = FREE_DELIVERY_THRESHOLD_PAISE; // 1 × item priced exactly at the threshold
  const items = [{ id: 7, name: "Family Bundle", qty: 1, price: gross }];
  const finalPaise = gross - 10_000;
  const expected = computeChargePaise({
    finalPaise,
    subtotalPaise: gross,
    fulfillmentType: "delivery",
  });
  assert.equal(expected.deliveryFeePaise, 0, "threshold cleared on the pre-discount subtotal");
  const payload = serializeOrderToPetpooja(
    { ...sampleOrder, items, totalPaise: finalPaise, chargePaise: expected.chargePaise } as any,
    cfg,
    {},
    new Date(),
  );
  const d = payload.orderinfo.OrderInfo.Order.details;
  assert.equal(d.delivery_charges, "0.00");
  assert.equal(paise(d.discount_total), 10_000);
  assert.equal(paise(d.total), expected.chargePaise);
  assertBalances(payload);
});

test("no stored charge → authoritative total, zero components, not reconciled", () => {
  configure();
  const cfg = petpoojaConfig()!;
  // The guest-checkout and legacy rows: `charge_paise` was never written and
  // `total_paise` already includes GST and the fee. There is nothing to check a
  // recomputation against, so we assert only the number we are sure of.
  const legacy = { ...sampleOrder, chargePaise: null };
  const got = decomposeOrderCharge(legacy as any);
  assert.equal(got.reconciled, false);
  assert.equal(got.totalPaise, 42500);
  assert.deepEqual(
    { tax: got.taxPaise, del: got.deliveryFeePaise, disc: got.discountPaise },
    { tax: 0, del: 0, disc: 0 },
  );
  const d = serializeOrderToPetpooja(legacy as any, cfg, {}, new Date()).orderinfo.OrderInfo.Order.details;
  assert.equal(paise(d.total), 42500);
  assert.equal(d.tax_total, "0.00");
});

test("a stored charge that disagrees with recomputation is NOT split", () => {
  configure();
  const cfg = petpoojaConfig()!;
  // An ops-edited or otherwise unexplained row. A plausible-looking split here
  // would be the worst outcome available: a wrong `tax_total` is a number the
  // outlet files GST against, and a balanced wrong payload is not a question
  // anyone can ask. So we assert the total and decline to describe it.
  const edited = { ...sampleOrder, chargePaise: SAMPLE_CHARGE.chargePaise + 1_000 };
  const got = decomposeOrderCharge(edited as any);
  assert.equal(got.reconciled, false);
  assert.equal(got.totalPaise, SAMPLE_CHARGE.chargePaise + 1_000, "still the authoritative amount");
  assert.equal(got.taxPaise, 0);

  const payload = serializeOrderToPetpooja(edited as any, cfg, {}, new Date());
  const d = payload.orderinfo.OrderInfo.Order.details;
  assert.equal(paise(d.total), SAMPLE_CHARGE.chargePaise + 1_000);
  assert.equal(d.tax_total, "0.00");
  assert.equal(d.delivery_charges, "0.00");
  // Deliberately NOT assertBalances(): an unreconciled payload does not balance,
  // and that is the point. Petpooja may query it; nobody can query a lie that
  // adds up. This assertion pins the asymmetry so a future "fix" that makes the
  // unreconciled case balance by inventing components goes red here.
  const itemSum = payload.orderinfo.OrderInfo.OrderItem.details.reduce(
    (s: number, it: any) => s + paise(it.final_price),
    0,
  );
  assert.notEqual(paise(d.total), itemSum);
});

test("an unreconciled push is warned about, not silently sent", async () => {
  configure();
  const mock = await mockPetpoojaServer(() => ({ status: 200, json: { success: "1" } }));
  process.env["PETPOOJA_SAVE_ORDER_URL"] = mock.url;
  const warnings: unknown[] = [];
  const log = { info() {}, error() {}, warn: (o: unknown) => void warnings.push(o) };
  await pushOrderToPetpooja({ ...sampleOrder, chargePaise: null } as any, {}, log);
  await mock.received;
  await mock.close();
  assert.equal(warnings.length, 1, "ops has to be able to find these rows");
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
  // What crosses the wire is the grand total, and it balances on the way out.
  assert.equal(paise(got.orderinfo.OrderInfo.Order.details.total), SAMPLE_CHARGE.chargePaise);
  assertBalances(got);
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

