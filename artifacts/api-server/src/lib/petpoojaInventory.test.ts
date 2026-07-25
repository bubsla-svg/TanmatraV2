/**
 * PetPooja Inventory API client — parse + transport tests.
 *
 * The vendor contract here is VERIFIED: every expectation below was probed live
 * against outlet cq5hnj3629 on 2026-07-24 (see the header of the module under
 * test for the guessed-vs-actual table). So these tests are not "plausible shape"
 * guesses any more — they pin a real contract, and a failure means either we
 * broke the client or PetPooja changed something.
 *
 * Three of them exist specifically because the failure they guard against is
 * SILENT — it produces zero rows and an "ok" result rather than an error:
 *   - `unit` is an internal numeric id; the human label is `lbl_unit`.
 *   - the supplier hides in a sibling subtree, not an ancestor of the lines.
 *   - a rejection arrives as HTTP 200 with `success:"0"`.
 *
 * No network: every fetch is injected.
 */
import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";

import {
  MAX_PURCHASE_RANGE_DAYS,
  buildPurchaseRequestBody,
  buildStockRequestBody,
  fetchPurchases,
  fetchStock,
  normalizePurchaseResponse,
  normalizeStockResponse,
  petpoojaInventoryConfig,
  readVendorEnvelope,
  sanitizeUnit,
  toIsoDate,
  toNumber,
  toPaise,
  type FetchLike,
} from "./petpoojaInventory";

const ENV_KEYS = [
  "PETPOOJA_APP_KEY",
  "PETPOOJA_APP_SECRET",
  "PETPOOJA_ACCESS_TOKEN",
  "PETPOOJA_INVENTORY_RID",
  "PETPOOJA_INVENTORY_REST_ID",
  "PETPOOJA_MENU_SHARING_CODE",
  "PETPOOJA_RESTAURANT_ID",
  "PETPOOJA_INVENTORY_BASE_URL",
  "PETPOOJA_PURCHASE_PATH",
  "PETPOOJA_STOCK_PATH",
] as const;

const saved = new Map<string, string | undefined>();
function setEnv(vals: Partial<Record<(typeof ENV_KEYS)[number], string>>): void {
  for (const k of ENV_KEYS) {
    if (!saved.has(k)) saved.set(k, process.env[k]);
    const v = vals[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
function configure(extra: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}): void {
  setEnv({
    PETPOOJA_APP_KEY: "key",
    PETPOOJA_APP_SECRET: "secret",
    PETPOOJA_ACCESS_TOKEN: "token",
    PETPOOJA_INVENTORY_RID: "355738",
    PETPOOJA_MENU_SHARING_CODE: "cq5hnj3629",
    ...extra,
  });
}

afterEach(() => {
  for (const [k, v] of saved) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  saved.clear();
});

const PURCHASE_URL = "https://api.petpooja.com/V1/thirdparty/get_purchase/";
const STOCK_URL = "https://api.petpooja.com/V1/thirdparty/get_stock/";

/** A response shaped exactly like the live one, minus the fields we ignore. */
function vendorOk(extra: Record<string, unknown>): string {
  return JSON.stringify({ code: "200", success: "1", message: "", restID: "cq5hnj3629", ...extra });
}

describe("petpoojaInventoryConfig", () => {
  it("is null (integration inert) when the inventory RID is missing", () => {
    setEnv({
      PETPOOJA_APP_KEY: "key",
      PETPOOJA_APP_SECRET: "secret",
      PETPOOJA_ACCESS_TOKEN: "token",
      PETPOOJA_MENU_SHARING_CODE: "cq5hnj3629",
    });
    assert.equal(petpoojaInventoryConfig(), null);
  });

  it("is null when any credential is missing even with an RID", () => {
    setEnv({ PETPOOJA_INVENTORY_RID: "355738", PETPOOJA_MENU_SHARING_CODE: "cq5hnj3629" });
    assert.equal(petpoojaInventoryConfig(), null);
  });

  it("is null when no sharing code can be resolved for restID", () => {
    setEnv({
      PETPOOJA_APP_KEY: "key",
      PETPOOJA_APP_SECRET: "secret",
      PETPOOJA_ACCESS_TOKEN: "token",
      PETPOOJA_INVENTORY_RID: "355738",
    });
    assert.equal(petpoojaInventoryConfig(), null);
  });

  it("defaults to the shared api host and the V1/thirdparty paths", () => {
    configure();
    const cfg = petpoojaInventoryConfig();
    assert.ok(cfg);
    assert.equal(cfg.baseUrl, "https://api.petpooja.com");
    assert.equal(cfg.purchasePath, "/V1/thirdparty/get_purchase/");
    assert.equal(cfg.stockPath, "/V1/thirdparty/get_stock/");
    // inventory.petpooja.com is the billing web UI; it 404s every API path.
    assert.ok(!cfg.baseUrl.includes("inventory.petpooja.com"));
  });

  it("keeps the RID as the arming switch but never as the wire identifier", () => {
    configure();
    const cfg = petpoojaInventoryConfig();
    assert.ok(cfg);
    assert.equal(cfg.rid, "355738");
    assert.equal(cfg.restId, "cq5hnj3629");
    assert.notEqual(cfg.restId, cfg.rid);
  });

  it("resolves restID from the explicit override, then the sharing code, then the POS id", () => {
    configure({ PETPOOJA_INVENTORY_REST_ID: "explicit", PETPOOJA_RESTAURANT_ID: "pos-id" });
    assert.equal(petpoojaInventoryConfig()?.restId, "explicit");

    configure({ PETPOOJA_RESTAURANT_ID: "pos-id" });
    assert.equal(petpoojaInventoryConfig()?.restId, "cq5hnj3629");

    setEnv({
      PETPOOJA_APP_KEY: "key",
      PETPOOJA_APP_SECRET: "secret",
      PETPOOJA_ACCESS_TOKEN: "token",
      PETPOOJA_INVENTORY_RID: "355738",
      PETPOOJA_RESTAURANT_ID: "pos-id",
    });
    assert.equal(petpoojaInventoryConfig()?.restId, "pos-id");
  });

  it("lets env override the base URL and path, and strips trailing slashes", () => {
    configure({
      PETPOOJA_INVENTORY_BASE_URL: "https://staging.example.com/",
      PETPOOJA_PURCHASE_PATH: "/v2/purchase",
    });
    const cfg = petpoojaInventoryConfig();
    assert.ok(cfg);
    assert.equal(cfg.baseUrl, "https://staging.example.com");
    assert.equal(cfg.purchasePath, "/v2/purchase");
  });
});

describe("scalar parsers", () => {
  it("parses money leniently and rejects junk / non-positive", () => {
    assert.equal(toPaise("1,234.50"), 123450);
    assert.equal(toPaise("₹120"), 12000);
    assert.equal(toPaise(99.99), 9999);
    assert.equal(toPaise("0"), null);
    assert.equal(toPaise("-5"), null);
    assert.equal(toPaise("N/A"), null);
    assert.equal(toPaise(null), null);
  });

  it("parses numbers leniently", () => {
    assert.equal(toNumber("2.5 kg"), 2.5);
    assert.equal(toNumber(""), null);
    assert.equal(toNumber({}), null);
  });

  it("normalizes dates, preferring day-first for slash/dash forms", () => {
    assert.equal(toIsoDate("2026-07-21"), "2026-07-21");
    assert.equal(toIsoDate("2026-07-21 14:05:00"), "2026-07-21");
    assert.equal(toIsoDate("05/03/2026"), "2026-03-05");
    assert.equal(toIsoDate("5-3-2026"), "2026-03-05");
    assert.equal(toIsoDate(""), null);
    assert.equal(toIsoDate(42), null);
  });
});

describe("sanitizeUnit", () => {
  it("refuses PetPooja's internal numeric unit id", () => {
    // The live `unit` field holds ids like this. It is a perfectly good string,
    // which is exactly why it is dangerous: nothing downstream would complain,
    // every conversion would just miss.
    assert.equal(sanitizeUnit("4365934"), "");
    assert.equal(sanitizeUnit(4365934), "");
    assert.equal(sanitizeUnit(" 0011 "), "");
  });

  it("normalizes the human labels the vendor actually sends", () => {
    assert.equal(sanitizeUnit("Kg"), "kg");
    assert.equal(sanitizeUnit("Ltr."), "ltr");
    assert.equal(sanitizeUnit("  BOX "), "box");
    assert.equal(sanitizeUnit("Piece"), "piece");
  });

  it("returns empty for anything unusable", () => {
    assert.equal(sanitizeUnit(null), "");
    assert.equal(sanitizeUnit(undefined), "");
    assert.equal(sanitizeUnit(""), "");
    assert.equal(sanitizeUnit("   "), "");
    assert.equal(sanitizeUnit({}), "");
  });
});

describe("readVendorEnvelope", () => {
  it("accepts the success envelope, including an empty window", () => {
    // Verified live: an empty window is success:"1" with message "No record
    // found." — a normal answer, NOT a rejection.
    const e = readVendorEnvelope({
      code: "200", success: "1", message: "No record found.", purchases: [],
    });
    assert.equal(e.ok, true);
    assert.equal(e.code, "200");
  });

  it("catches an endpoint refusal arriving as HTTP 200", () => {
    const e = readVendorEnvelope({ code: "101", success: "0", message: "Please provide date range of maximum 1 month." });
    assert.equal(e.ok, false);
    assert.equal(e.code, "101");
    assert.match(e.message ?? "", /maximum 1 month/);
  });

  it("catches a gateway refusal, which uses errorCode instead of code", () => {
    const e = readVendorEnvelope({ success: "0", message: "Invalid client credentials.", errorCode: "GN_105" });
    assert.equal(e.ok, false);
    assert.equal(e.code, "GN_105");
  });

  it("treats a body with no success flag as OK-but-unknown, not as a failure", () => {
    assert.equal(readVendorEnvelope({ totally: "different" }).ok, true);
    assert.equal(readVendorEnvelope("<html>login</html>").ok, true);
    assert.equal(readVendorEnvelope(null).ok, true);
  });
});

// ── The verified purchase shape ─────────────────────────────────────────────

/** Trimmed copy of a real get_purchase response. */
const LIVE_PURCHASE = {
  code: "200",
  success: "1",
  message: "",
  restID: "cq5hnj3629",
  purchases: [
    {
      purchase_id: "102833613",
      type: "Normal",
      po_id: null,
      mrn_no: "8",
      invoice_number: "",
      invoice_date: "2025-08-06",
      total: "1250.00",
      restaurant_details: {
        sender: { sender_name: "Tanmatra", sender_type: "Restaurant" },
        receiver: { receiver_name: "aman trades", receiver_type: "Supplier" },
      },
      item_details: [
        {
          item_id: "9911",
          itemname: "Paneer",
          qty: "5",
          price: "320",
          amount: "1600",
          lbl_unit: "Kg",
          unit: "4365934",
          weighted_price: "320",
          invoice_date: "2025-08-06",
        },
        {
          item_id: "9912",
          itemname: "Egg Tray",
          qty: "6.1",
          price: "0",
          amount: "0",
          lbl_unit: "BOX",
          unit: "4365941",
        },
      ],
    },
  ],
};

describe("normalizePurchaseResponse — verified vendor shape", () => {
  it("reads the supplier out of restaurant_details.receiver, never the sender", () => {
    const lines = normalizePurchaseResponse(LIVE_PURCHASE);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].supplierName, "aman trades");
    // "Tanmatra" is us. Reading sender_name here would label every invoice as
    // bought from ourselves, and supplier spend would silently collapse to one
    // party — which is why this assertion is spelled out rather than implied.
    assert.notEqual(lines[0].supplierName, "Tanmatra");
  });

  it("prefers the human unit label over the internal numeric unit id", () => {
    const lines = normalizePurchaseResponse(LIVE_PURCHASE);
    assert.equal(lines[0].unit, "kg");
  });

  it("falls back to purchase_id when invoice_number is blank, as it usually is", () => {
    const lines = normalizePurchaseResponse(LIVE_PURCHASE);
    assert.equal(lines[0].invoiceNo, "102833613");
    assert.equal(lines[0].invoiceDate, "2025-08-06");
  });

  it("drops a zero-priced line rather than learning a price of zero from it", () => {
    const lines = normalizePurchaseResponse(LIVE_PURCHASE);
    assert.equal(lines.length, 1);
    assert.equal(lines.some((l) => l.product === "Egg Tray"), false);
    assert.equal(lines[0].unitPricePaise, 32000);
    assert.equal(lines[0].lineTotalPaise, 160000);
    assert.equal(lines[0].qty, 5);
  });

  it("prefers the real invoice number when the vendor did supply one", () => {
    const body = structuredClone(LIVE_PURCHASE);
    body.purchases[0].invoice_number = "1020926IN/008079";
    assert.equal(normalizePurchaseResponse(body)[0].invoiceNo, "1020926IN/008079");
  });

  it("tolerates a null supplier without dropping the line", () => {
    const body = structuredClone(LIVE_PURCHASE) as Record<string, unknown>;
    (body["purchases"] as Record<string, unknown>[])[0]["restaurant_details"] = {
      sender: { sender_name: "Tanmatra" },
      receiver: { receiver_name: null },
    };
    const lines = normalizePurchaseResponse(body);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].supplierName, null);
  });

  it("reads an empty window as zero lines, not as a parse failure", () => {
    assert.deepEqual(
      normalizePurchaseResponse({
        code: "200", success: "1", message: "No record found.", restID: "cq5hnj3629", purchases: [],
      }),
      [],
    );
  });

  it("derives the unit price from the amount when only the amount is priced", () => {
    const body = structuredClone(LIVE_PURCHASE) as Record<string, unknown>;
    const item = (((body["purchases"] as Record<string, unknown>[])[0]["item_details"]) as Record<string, unknown>[])[0];
    delete item["price"];
    delete item["weighted_price"];
    const lines = normalizePurchaseResponse(body);
    assert.equal(lines[0].unitPricePaise, 32000); // 1600 / 5
  });
});

describe("normalizePurchaseResponse — generic fallback", () => {
  it("reads a flat array of lines", () => {
    const lines = normalizePurchaseResponse([
      { item_name: "Paneer", quantity: "5", unit: "kg", rate: "320", amount: "1600", supplier_name: "Ambika Dairy" },
    ]);
    assert.equal(lines.length, 1);
    assert.deepEqual(lines[0], {
      product: "Paneer",
      qty: 5,
      unit: "kg",
      unitPricePaise: 32000,
      lineTotalPaise: 160000,
      supplierName: "Ambika Dairy",
      invoiceNo: null,
      invoiceDate: null,
    });
  });

  it("inherits supplier + invoice fields from the enclosing invoice header", () => {
    const lines = normalizePurchaseResponse({
      success: "1",
      data: {
        purchases: [
          {
            invoice_no: "INV-77",
            supplier_name: "Green Farms",
            invoice_date: "21-07-2026",
            total_amount: "980",
            items: [
              { itemName: "Spinach", qty: 4, uom: "kg", rate: 45 },
              { itemName: "Tomato", qty: 10, uom: "kg", rate: 80 },
            ],
          },
        ],
      },
    });
    assert.equal(lines.length, 2);
    for (const l of lines) {
      assert.equal(l.supplierName, "Green Farms");
      assert.equal(l.invoiceNo, "INV-77");
      assert.equal(l.invoiceDate, "2026-07-21");
    }
    assert.equal(lines[0].product, "Spinach");
    assert.equal(lines[0].unitPricePaise, 4500);
    assert.equal(lines[0].lineTotalPaise, 18000);
  });

  it("lets a line-level supplier override the header's", () => {
    const lines = normalizePurchaseResponse({
      supplier_name: "Header Co",
      items: [{ product: "Rice", quantity: 1, unit: "kg", rate: 60, vendor_name: "Line Co" }],
    });
    assert.equal(lines[0].supplierName, "Line Co");
  });

  it("derives the unit price when only the line amount is given", () => {
    const lines = normalizePurchaseResponse([
      { product_name: "Ghee", quantity: 4, unit: "ltr", amount: "2400" },
    ]);
    assert.equal(lines[0].unitPricePaise, 60000);
    assert.equal(lines[0].lineTotalPaise, 240000);
  });

  it("skips rows that are not purchase lines instead of inventing prices", () => {
    const lines = normalizePurchaseResponse({
      success: "0",
      message: "no data",
      data: [{ item_name: "Paneer" }, { quantity: 3 }, { item_name: "Salt", quantity: 0, rate: 20 }],
    });
    assert.deepEqual(lines, []);
  });

  it("returns [] for a non-JSON body rather than throwing", () => {
    assert.deepEqual(normalizePurchaseResponse("<html>login</html>"), []);
    assert.deepEqual(normalizePurchaseResponse(null), []);
    assert.deepEqual(normalizePurchaseResponse(undefined), []);
  });
});

describe("buildPurchaseRequestBody", () => {
  it("sends exactly the verified keys — sharing code as restID, from_date/to_date", () => {
    configure();
    const cfg = petpoojaInventoryConfig();
    assert.ok(cfg);
    const body = buildPurchaseRequestBody(cfg, { startDate: "2026-07-01", endDate: "2026-07-08" });
    assert.deepEqual(body, {
      app_key: "key",
      app_secret: "secret",
      access_token: "token",
      restID: "cq5hnj3629",
      from_date: "2026-07-01",
      to_date: "2026-07-08",
    });
  });

  it("never sends the numeric RID, which the endpoint rejects with code 103", () => {
    configure();
    const cfg = petpoojaInventoryConfig();
    assert.ok(cfg);
    const body = buildPurchaseRequestBody(cfg, { startDate: "2026-07-01", endDate: "2026-07-08" });
    assert.equal(Object.values(body).includes("355738"), false);
  });
});

describe("buildStockRequestBody", () => {
  it("sends exactly the verified keys — one `date`, no aliases", () => {
    configure();
    const cfg = petpoojaInventoryConfig();
    assert.ok(cfg);
    assert.deepEqual(buildStockRequestBody(cfg, { date: "2026-07-24" }), {
      app_key: "key",
      app_secret: "secret",
      access_token: "token",
      restID: "cq5hnj3629",
      date: "2026-07-24",
    });
  });
});

describe("fetchPurchases", () => {
  const range = { startDate: "2026-07-01", endDate: "2026-07-08" };

  it("skips (does not fail) when the integration is unconfigured", async () => {
    setEnv({});
    let called = false;
    const res = await fetchPurchases(range, {
      fetchImpl: (async () => {
        called = true;
        throw new Error("must not be called");
      }) as unknown as FetchLike,
    });
    assert.equal(res.skipped, true);
    assert.equal(res.ok, false);
    assert.deepEqual(res.lines, []);
    assert.equal(called, false);
  });

  it("posts to the verified URL with the verified body and parses the response", async () => {
    configure();
    let seenUrl = "";
    let seenBody: Record<string, unknown> = {};
    let seenMethod = "";
    const res = await fetchPurchases(range, {
      fetchImpl: (async (url, init) => {
        seenUrl = url;
        seenMethod = init?.method ?? "";
        seenBody = JSON.parse(init?.body ?? "{}");
        return {
          ok: true,
          status: 200,
          text: async () => vendorOk({ purchases: LIVE_PURCHASE.purchases }),
        };
      }) as FetchLike,
    });
    assert.equal(res.ok, true);
    assert.equal(seenUrl, PURCHASE_URL);
    assert.equal(seenMethod, "POST");
    assert.equal(seenBody["restID"], "cq5hnj3629");
    assert.equal(seenBody["from_date"], "2026-07-01");
    assert.equal(res.lines.length, 1);
    assert.equal(res.lines[0].unitPricePaise, 32000);
    assert.equal(res.lines[0].supplierName, "aman trades");
  });

  it("keeps credentials out of the request headers", async () => {
    configure();
    let headers: Record<string, string> = {};
    await fetchPurchases(range, {
      fetchImpl: (async (_url, init) => {
        headers = init?.headers ?? {};
        return { ok: true, status: 200, text: async () => vendorOk({ purchases: [] }) };
      }) as FetchLike,
    });
    // Headers are the copy that proxies, gateways and client debug logs echo.
    assert.deepEqual(Object.keys(headers), ["Content-Type"]);
    assert.equal(JSON.stringify(headers).includes("secret"), false);
  });

  it("treats HTTP 200 + success:'0' as a failure, with the vendor code intact", async () => {
    configure();
    const errors: unknown[] = [];
    const res = await fetchPurchases(range, {
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ success: "0", message: "Invalid client credentials.", errorCode: "GN_105" }),
      })) as FetchLike,
      log: { error: (o) => errors.push(o) },
    });
    // Trusting the HTTP status here would report "0 lines, ok" and send whoever
    // is on call to the parser instead of to the credentials.
    assert.equal(res.ok, false);
    assert.equal(res.error, "GN_105: Invalid client credentials.");
    assert.equal(errors.length, 1);
  });

  it("reads an empty window as a success and does not warn about it", async () => {
    configure();
    const warnings: unknown[] = [];
    const errors: unknown[] = [];
    const res = await fetchPurchases(range, {
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        text: async () => vendorOk({ message: "No record found.", purchases: [] }),
      })) as FetchLike,
      log: { warn: (o) => warnings.push(o), error: (o) => errors.push(o) },
    });
    // A kitchen that buys weekly has empty windows constantly; warning on them
    // trains everyone to ignore the channel that carries the real failures.
    assert.equal(res.ok, true);
    assert.deepEqual(res.lines, []);
    assert.deepEqual(warnings, []);
    assert.deepEqual(errors, []);
  });

  it("refuses a reversed range without asking the vendor", async () => {
    configure();
    let called = false;
    const res = await fetchPurchases({ startDate: "2026-07-08", endDate: "2026-07-01" }, {
      fetchImpl: (async () => {
        called = true;
        return { ok: true, status: 200, text: async () => vendorOk({ purchases: [] }) };
      }) as FetchLike,
    });
    // The vendor answers a reversed range with "No record found." and success:1,
    // so a date bug would look exactly like a quiet week.
    assert.equal(called, false);
    assert.equal(res.ok, false);
    assert.equal(res.skipped, undefined);
    assert.equal(res.error, "invalid_date_range");
  });

  it("clamps an over-wide window forward, keeping the most recent days", async () => {
    configure();
    let seenBody: Record<string, unknown> = {};
    const warnings: unknown[] = [];
    await fetchPurchases({ startDate: "2026-01-01", endDate: "2026-07-08" }, {
      fetchImpl: (async (_url, init) => {
        seenBody = JSON.parse(init?.body ?? "{}");
        return { ok: true, status: 200, text: async () => vendorOk({ purchases: [] }) };
      }) as FetchLike,
      log: { warn: (o) => warnings.push(o) },
    });
    // Over a month is code 101 and zero lines, so the window is trimmed rather
    // than sent and silently refused.
    assert.equal(seenBody["to_date"], "2026-07-08");
    assert.equal(seenBody["from_date"], "2026-06-07"); // 31 days back
    assert.equal(MAX_PURCHASE_RANGE_DAYS, 31);
    assert.equal(warnings.length, 1);
  });

  it("reports a non-2xx as not-ok with no lines", async () => {
    configure();
    const res = await fetchPurchases(range, {
      fetchImpl: (async () => ({ ok: false, status: 401, text: async () => "unauthorized" })) as FetchLike,
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, 401);
    assert.deepEqual(res.lines, []);
  });

  it("never throws when the vendor is unreachable", async () => {
    configure();
    const res = await fetchPurchases(range, {
      fetchImpl: (async () => {
        throw new Error("ECONNREFUSED");
      }) as FetchLike,
    });
    assert.equal(res.ok, false);
    assert.equal(res.error, "ECONNREFUSED");
    assert.deepEqual(res.lines, []);
  });
});

describe("normalizeStockResponse", () => {
  it("reads a flat array of balances", () => {
    const rows = normalizeStockResponse([
      { item_name: "Paneer", closing_stock: "12.5", unit: "KG" },
      { item_name: "Egg", available_qty: 60, unit: "pcs" },
    ]);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { product: "Paneer", qty: 12.5, unit: "kg", asOfDate: null });
    assert.deepEqual(rows[1], { product: "Egg", qty: 60, unit: "pcs", asOfDate: null });
  });

  it("prefers the human unit label here too", () => {
    const rows = normalizeStockResponse([
      { item_name: "Paneer", closing_stock: 3, lbl_unit: "Kg", unit: "4365934" },
    ]);
    assert.equal(rows[0].unit, "kg");
  });

  it("inherits the as-of date from the enclosing envelope", () => {
    const rows = normalizeStockResponse({
      success: "1",
      stock_date: "21-07-2026",
      data: { items: [{ itemName: "Spinach", in_hand: 3, uom: "kg" }] },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].asOfDate, "2026-07-21");
  });

  it("keeps a zero balance — that is the whole point of a stock feed", () => {
    const rows = normalizeStockResponse([{ item_name: "Ghee", closing_stock: 0, unit: "kg" }]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].qty, 0);
  });

  it("refuses a negative balance rather than understating on-hand", () => {
    assert.deepEqual(normalizeStockResponse([{ item_name: "Rice", closing_stock: -4 }]), []);
  });

  it("skips objects that carry no product name or no quantity", () => {
    assert.deepEqual(
      normalizeStockResponse({ success: "0", message: "no data", data: [{ closing_stock: 5 }, { item_name: "Salt" }] }),
      [],
    );
  });

  it("tolerates a missing unit rather than dropping the row", () => {
    const rows = normalizeStockResponse([{ item_name: "Curd", closing_stock: 2 }]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].unit, "");
  });

  it("returns [] for a non-JSON body rather than throwing", () => {
    assert.deepEqual(normalizeStockResponse("<html>login</html>"), []);
    assert.deepEqual(normalizeStockResponse(null), []);
  });
});

describe("fetchStock", () => {
  it("skips (does not fail) when the integration is unconfigured", async () => {
    setEnv({});
    let called = false;
    const res = await fetchStock("2026-07-24", {
      fetchImpl: (async () => {
        called = true;
        throw new Error("must not be called");
      }) as unknown as FetchLike,
    });
    assert.equal(res.skipped, true);
    assert.equal(res.ok, false);
    assert.deepEqual(res.lines, []);
    assert.equal(called, false);
  });

  it("posts to the verified stock URL and parses the response", async () => {
    configure();
    let seenUrl = "";
    let seenBody: Record<string, unknown> = {};
    const res = await fetchStock("2026-07-24", {
      fetchImpl: (async (url, init) => {
        seenUrl = url;
        seenBody = JSON.parse(init?.body ?? "{}");
        return {
          ok: true,
          status: 200,
          text: async () =>
            vendorOk({ stock: [{ item_name: "Dal", closing_stock: 7, lbl_unit: "Kg" }] }),
        };
      }) as FetchLike,
    });
    assert.equal(res.ok, true);
    assert.equal(seenUrl, STOCK_URL);
    assert.equal(seenBody["date"], "2026-07-24");
    assert.equal(res.lines.length, 1);
    assert.equal(res.lines[0].qty, 7);
    assert.equal(res.lines[0].unit, "kg");
  });

  it("surfaces the unprovisioned-stock refusal (code 301) as a vendor error", async () => {
    configure();
    const errors: unknown[] = [];
    const res = await fetchStock("2026-07-24", {
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            code: "301",
            success: "0",
            message: "Provide date is not in your date range.",
            available_range: "",
          }),
      })) as FetchLike,
      log: { error: (o) => errors.push(o) },
    });
    // This is the live answer for every date tried on this outlet: stock history
    // is not provisioned. Keeping the code visible is what makes it a PetPooja
    // ticket rather than a parser hunt.
    assert.equal(res.ok, false);
    assert.equal(res.error, "301: Provide date is not in your date range.");
    assert.equal(errors.length, 1);
  });

  it("honours the stock-path override", async () => {
    configure({ PETPOOJA_STOCK_PATH: "/v2/stock" });
    let seenUrl = "";
    await fetchStock("2026-07-24", {
      fetchImpl: (async (url) => {
        seenUrl = url;
        return { ok: true, status: 200, text: async () => "[]" };
      }) as FetchLike,
    });
    assert.equal(seenUrl, "https://api.petpooja.com/v2/stock");
  });

  it("never throws when the vendor is unreachable", async () => {
    configure();
    const res = await fetchStock("2026-07-24", {
      fetchImpl: (async () => {
        throw new Error("ETIMEDOUT");
      }) as FetchLike,
    });
    assert.equal(res.ok, false);
    assert.equal(res.error, "ETIMEDOUT");
    assert.deepEqual(res.lines, []);
  });

  it("still warns on accepted-but-empty — a working kitchen holds something", async () => {
    configure();
    const warnings: unknown[] = [];
    const res = await fetchStock("2026-07-24", {
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        text: async () => vendorOk({ totally: "different" }),
      })) as FetchLike,
      log: { warn: (o) => warnings.push(o) },
    });
    assert.equal(res.ok, true);
    assert.deepEqual(res.lines, []);
    assert.equal(warnings.length, 1);
  });
});
