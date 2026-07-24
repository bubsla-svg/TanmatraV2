/**
 * PetPooja Inventory API client — parse + transport tests.
 *
 * The point of these is that the vendor contract is UNVERIFIED (their API
 * reference is client-rendered and unreadable by fetchers), so the parser must
 * cope with several plausible response shapes and must degrade to "zero lines"
 * rather than to a crash or to junk prices when it guesses wrong.
 *
 * No network: `fetchPurchases` takes an injected fetch.
 */
import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";

import {
  buildPurchaseRequestBody,
  buildStockRequestBody,
  fetchPurchases,
  fetchStock,
  normalizePurchaseResponse,
  normalizeStockResponse,
  petpoojaInventoryConfig,
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

describe("petpoojaInventoryConfig", () => {
  it("is null (integration inert) when the inventory RID is missing", () => {
    setEnv({
      PETPOOJA_APP_KEY: "key",
      PETPOOJA_APP_SECRET: "secret",
      PETPOOJA_ACCESS_TOKEN: "token",
    });
    assert.equal(petpoojaInventoryConfig(), null);
  });

  it("is null when any credential is missing even with an RID", () => {
    setEnv({ PETPOOJA_INVENTORY_RID: "355738" });
    assert.equal(petpoojaInventoryConfig(), null);
  });

  it("defaults to the inventory host, which is NOT the POS host", () => {
    configure();
    const cfg = petpoojaInventoryConfig();
    assert.ok(cfg);
    assert.equal(cfg.baseUrl, "https://inventory.petpooja.com");
    assert.equal(cfg.rid, "355738");
    assert.ok(!cfg.baseUrl.includes("pos.petpooja.com"));
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

describe("normalizePurchaseResponse", () => {
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
  it("sends credentials, both identifier aliases and both date-range aliases", () => {
    configure();
    const cfg = petpoojaInventoryConfig();
    assert.ok(cfg);
    const body = buildPurchaseRequestBody(cfg, { startDate: "2026-07-01", endDate: "2026-07-08" });
    assert.equal(body["app_key"], "key");
    assert.equal(body["access_token"], "token");
    assert.equal(body["restID"], "355738");
    assert.equal(body["restaurantid"], "355738");
    assert.equal(body["start_date"], "2026-07-01");
    assert.equal(body["from_date"], "2026-07-01");
    assert.equal(body["end_date"], "2026-07-08");
    assert.equal(body["to_date"], "2026-07-08");
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

  it("posts to the inventory host and parses the response", async () => {
    configure();
    let seenUrl = "";
    let seenBody: Record<string, unknown> = {};
    const res = await fetchPurchases(range, {
      fetchImpl: (async (url, init) => {
        seenUrl = url;
        seenBody = JSON.parse(init?.body ?? "{}");
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify([{ item_name: "Dal", quantity: 2, unit: "kg", rate: 110 }]),
        };
      }) as FetchLike,
    });
    assert.equal(res.ok, true);
    assert.equal(seenUrl, "https://inventory.petpooja.com/api/get_purchase");
    assert.equal(seenBody["restID"], "355738");
    assert.equal(res.lines.length, 1);
    assert.equal(res.lines[0].unitPricePaise, 11000);
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

  it("succeeds-with-zero-lines and warns when the shape is unrecognised", async () => {
    configure();
    const warnings: unknown[] = [];
    const res = await fetchPurchases(range, {
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ totally: "different" }),
      })) as FetchLike,
      log: { warn: (o) => warnings.push(o) },
    });
    assert.equal(res.ok, true);
    assert.deepEqual(res.lines, []);
    assert.equal(warnings.length, 1);
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

describe("buildStockRequestBody", () => {
  it("sends the one date under every plausible key, plus a degenerate range", () => {
    configure();
    const cfg = petpoojaInventoryConfig();
    assert.ok(cfg);
    const body = buildStockRequestBody(cfg, { date: "2026-07-24" });
    assert.equal(body["app_key"], "key");
    assert.equal(body["restID"], "355738");
    assert.equal(body["date"], "2026-07-24");
    assert.equal(body["stock_date"], "2026-07-24");
    assert.equal(body["start_date"], "2026-07-24");
    assert.equal(body["end_date"], "2026-07-24");
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

  it("posts to the stock path on the inventory host and parses the response", async () => {
    configure();
    let seenUrl = "";
    const res = await fetchStock("2026-07-24", {
      fetchImpl: (async (url) => {
        seenUrl = url;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{ item_name: "Dal", closing_stock: 7, unit: "kg" }]),
        };
      }) as FetchLike,
    });
    assert.equal(res.ok, true);
    assert.equal(seenUrl, "https://inventory.petpooja.com/api/get_stock");
    assert.equal(res.lines.length, 1);
    assert.equal(res.lines[0].qty, 7);
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
    assert.equal(seenUrl, "https://inventory.petpooja.com/v2/stock");
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

  it("succeeds-with-zero-rows and warns when the shape is unrecognised", async () => {
    configure();
    const warnings: unknown[] = [];
    const res = await fetchStock("2026-07-24", {
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ totally: "different" }),
      })) as FetchLike,
      log: { warn: (o) => warnings.push(o) },
    });
    assert.equal(res.ok, true);
    assert.deepEqual(res.lines, []);
    assert.equal(warnings.length, 1);
  });
});
