/**
 * PetPooja **Inventory** API client (purchase / supplier-invoice reads).
 *
 * A DIFFERENT endpoint family from the order push in `petpoojaClient.ts`, but —
 * contrary to what this file assumed until it was probed — the SAME host and the
 * SAME identifier:
 *
 *   | Concern             | Host             | Path                          | Identifier         |
 *   |---------------------|------------------|-------------------------------|--------------------|
 *   | Order push (POS)    | pos.petpooja.com | /api/v1/save_order            | Menu Sharing Code  |
 *   | Purchases/invoices  | api.petpooja.com | /V1/thirdparty/get_purchase/  | Menu Sharing Code  |
 *   | Stock balances      | api.petpooja.com | /V1/thirdparty/get_stock/     | Menu Sharing Code  |
 *
 * ─────────────────────────────────────────────────────────────────────────
 * VERIFIED VENDOR CONTRACT (probed live against outlet cq5hnj3629, 2026-07-24)
 * ─────────────────────────────────────────────────────────────────────────
 * An earlier revision of this file guessed the contract, because the vendor's
 * reference page is client-rendered and could not be read. Every one of those
 * guesses was wrong; recorded here so the same wrong turns are not retaken:
 *
 *   | Thing        | Guessed                        | Actual                        |
 *   |--------------|--------------------------------|-------------------------------|
 *   | host         | inventory.petpooja.com         | api.petpooja.com              |
 *   | purchase     | /api/get_purchase              | /V1/thirdparty/get_purchase/  |
 *   | stock        | /api/get_stock                 | /V1/thirdparty/get_stock/     |
 *   | identifier   | RID 355738                     | sharing code cq5hnj3629       |
 *   | date keys    | start_date/end_date            | from_date/to_date             |
 *   | failure      | non-2xx HTTP                   | HTTP 200 + success:"0"        |
 *
 * `inventory.petpooja.com` 404s every API path tried — it serves the billing
 * web UI, not the API. The numeric RID is rejected with code 103 ("error in
 * restaurant mapping"); the Menu Sharing Code is what `restID` wants, and the
 * response echoes it back. Confirmed constraints:
 *
 *   - get_purchase takes `from_date`/`to_date` (YYYY-MM-DD) and refuses a span
 *     wider than about a month with code 101. `MAX_PURCHASE_RANGE_DAYS` clamps.
 *   - A reversed range (to < from) is NOT an error — it returns "No record
 *     found." So a date bug reads as a quiet empty day. Refused locally.
 *   - get_stock takes `date`, and for this outlet answers code 301 "Provide
 *     date is not in your date range" with an EMPTY available_range for every
 *     date tried across a year and every format tried. Stock history appears
 *     not to be provisioned yet; purchases work fine. Until that is fixed with
 *     PetPooja the stock sync has nothing to read — which is exactly why it
 *     ships dry-run.
 *
 * Everything above is still env-overridable, so a vendor change is a config
 * edit rather than a redeploy:
 *   PETPOOJA_INVENTORY_BASE_URL      default https://api.petpooja.com
 *   PETPOOJA_PURCHASE_PATH           default /V1/thirdparty/get_purchase/
 *   PETPOOJA_STOCK_PATH              default /V1/thirdparty/get_stock/
 *   PETPOOJA_INVENTORY_REST_ID       default = menu sharing code
 *
 * The whole module is inert unless the three PetPooja secrets AND
 * PETPOOJA_INVENTORY_RID are present — `petpoojaInventoryConfig()` returns null
 * and every caller no-ops, exactly like `petpoojaConfig()` in petpoojaClient.ts.
 * The RID is kept as that arming switch even though it is not sent as `restID`:
 * it is the thing PetPooja provisioned inventory against, so "an operator has
 * confirmed this outlet is wired up" is precisely what its presence means.
 */

export interface PetpoojaInventoryConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  /**
   * The outlet's numeric inventory RID (e.g. "355738"). Recorded because it is
   * what PetPooja provisioned against and what any support thread will quote —
   * but deliberately NOT sent to the API, which rejects it with code 103. Its
   * presence is the arming switch; `restId` is the wire value.
   */
  rid: string;
  /** Menu Sharing Code (e.g. "cq5hnj3629") — the value `restID` wants. */
  restId: string;
  baseUrl: string;
  purchasePath: string;
  stockPath: string;
}

export interface InventoryLogger {
  info?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
}

const DEFAULT_BASE_URL = "https://api.petpooja.com";
const DEFAULT_PURCHASE_PATH = "/V1/thirdparty/get_purchase/";
const DEFAULT_STOCK_PATH = "/V1/thirdparty/get_stock/";
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Widest `from_date`..`to_date` span get_purchase accepts. The vendor says
 * "maximum 1 month" (code 101); probing put the real cut-off between 32 and 36
 * days, so this sits safely inside it rather than on the edge — the penalty for
 * being conservative is one extra request, and for being wrong is a sync that
 * fetches nothing and reports success.
 */
export const MAX_PURCHASE_RANGE_DAYS = 31;

/** Fully-configured inventory config, or null when the integration is off. */
export function petpoojaInventoryConfig(): PetpoojaInventoryConfig | null {
  const appKey = process.env["PETPOOJA_APP_KEY"];
  const appSecret = process.env["PETPOOJA_APP_SECRET"];
  const accessToken = process.env["PETPOOJA_ACCESS_TOKEN"];
  const rid = process.env["PETPOOJA_INVENTORY_RID"];
  // The sharing code the POS integration already uses, unless explicitly
  // overridden. Falling back to PETPOOJA_RESTAURANT_ID mirrors
  // petpoojaClient.ts, where the sharing code defaults to it when unset.
  const restId =
    process.env["PETPOOJA_INVENTORY_REST_ID"] ||
    process.env["PETPOOJA_MENU_SHARING_CODE"] ||
    process.env["PETPOOJA_RESTAURANT_ID"];
  if (!appKey || !appSecret || !accessToken || !rid || !restId) return null;
  return {
    appKey,
    appSecret,
    accessToken,
    rid,
    restId,
    baseUrl: (process.env["PETPOOJA_INVENTORY_BASE_URL"] || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    purchasePath: process.env["PETPOOJA_PURCHASE_PATH"] || DEFAULT_PURCHASE_PATH,
    stockPath: process.env["PETPOOJA_STOCK_PATH"] || DEFAULT_STOCK_PATH,
  };
}

export function isPetpoojaInventoryEnabled(): boolean {
  return petpoojaInventoryConfig() !== null;
}

/** One supplier-invoice line, normalized out of whatever the vendor returned. */
export interface PetpoojaPurchaseLine {
  /** Free-text product name as the vendor spells it. */
  product: string;
  /** Quantity purchased, in `unit`. Always > 0. */
  qty: number;
  /** Raw vendor unit, lowercased and trimmed ("kg", "gm", "ltr", "pcs", …). */
  unit: string;
  /** Price of ONE `unit`, in paise. Always > 0. */
  unitPricePaise: number;
  /** Line amount in paise when the vendor supplied one, else qty × unit price. */
  lineTotalPaise: number;
  supplierName: string | null;
  invoiceNo: string | null;
  /** ISO `YYYY-MM-DD` when parseable, else the raw string, else null. */
  invoiceDate: string | null;
}

// ── Key aliases (UNVERIFIED — widen freely, it costs nothing) ───────────────

const PRODUCT_KEYS = [
  "item_name", "itemname", "itemName", "product_name", "productname",
  "product", "name", "raw_material", "rawmaterial", "material_name",
  "ingredient_name", "description", "item",
];
const QTY_KEYS = [
  "quantity", "qty", "purchase_qty", "purchaseqty", "received_qty",
  "item_quantity", "itemquantity", "recd_qty", "purchase_quantity",
];
/**
 * `lbl_unit` FIRST and `unit` last, which is not cosmetic: PetPooja sends both,
 * and `unit` is an internal numeric id ("4365934") while `lbl_unit` is the human
 * label ("Kg", "Ltr.", "Piece", "BOX"). Reading the id is not a parse failure —
 * it is a perfectly good string — it just makes every downstream unit
 * conversion miss, so the feed silently matches nothing and looks like an empty
 * pantry rather than a bug. `sanitizeUnit` is the backstop.
 */
const UNIT_KEYS = [
  "lbl_unit", "lblunit", "unit_label", "unitlabel",
  "uom", "unit_name", "unitname", "item_unit", "measurement", "unit",
];
const UNIT_PRICE_KEYS = [
  "rate", "unit_price", "unitprice", "purchase_price", "purchaseprice",
  "item_rate", "itemrate", "price", "cost", "unit_cost",
];
const LINE_TOTAL_KEYS = [
  "amount", "total", "line_total", "linetotal", "net_amount", "netamount",
  "taxable_amount", "item_amount", "itemamount", "total_amount", "gross_amount",
];
/**
 * `receiver_name` is PetPooja's word for the supplier: on a purchase the outlet
 * is the *sender* ("Tanmatra") and the supplier is the *receiver* of the order.
 * `sender_name` is deliberately absent from this list — picking it up would
 * label every invoice as bought from ourselves.
 */
const SUPPLIER_KEYS = [
  "supplier_name", "suppliername", "receiver_name", "receivername",
  "vendor_name", "vendorname", "party_name", "partyname",
  "supplier", "vendor", "party",
];
/**
 * `invoice_number` is usually "" on this outlet's data (only 1 of 6 invoices
 * carried one), so `purchase_id` — stable and unique — is the real fallback.
 * `mrn_no` is last: it is a per-outlet sequence that has been observed as "0".
 */
const INVOICE_NO_KEYS = [
  "invoice_no", "invoiceno", "invoice_number", "invoicenumber",
  "bill_no", "billno", "purchase_no", "purchaseno", "reference_no", "referenceno",
  "purchase_id", "purchaseid", "mrn_no", "mrnno",
];
const INVOICE_DATE_KEYS = [
  "invoice_date", "invoicedate", "bill_date", "billdate",
  "purchase_date", "purchasedate", "date", "created_on", "createdon",
];

/**
 * Stock-quantity aliases, most specific first. A separate list from `QTY_KEYS`
 * because a stock row's defining field is a closing/available balance; the bare
 * `quantity`/`qty` fallbacks sit last, for a feed that labels the balance
 * generically. This does NOT distinguish a stock row from an invoice line — the
 * two are genuinely indistinguishable by shape — so it is only ever applied to
 * a get_stock response. What it does do is refuse the envelope: `{success, data}`
 * carries no product name, so the walker recurses past it rather than emitting.
 */
const STOCK_QTY_KEYS = [
  "closing_stock", "closingstock", "closing_qty", "closingqty",
  "current_stock", "currentstock", "available_qty", "availableqty",
  "balance_qty", "balanceqty", "physical_stock", "physicalstock",
  "in_hand", "inhand", "on_hand", "onhand", "stock_qty", "stockqty",
  "stock", "quantity", "qty",
];
const STOCK_DATE_KEYS = [
  "stock_date", "stockdate", "as_on", "ason", "as_on_date", "asondate",
  "report_date", "reportdate", "date",
];

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function canon(k: string): string {
  return k.toLowerCase().replace(/[\s_-]/g, "");
}

/** Flatten one object's own keys to a canonical-key lookup, built once per node. */
function flatten(node: Rec): Map<string, unknown> {
  const flat = new Map<string, unknown>();
  for (const [k, v] of Object.entries(node)) flat.set(canon(k), v);
  return flat;
}

/** First present alias, ignoring case, spaces, underscores and dashes. */
function pick(flat: Map<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = flat.get(canon(k));
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function pickString(flat: Map<string, unknown>, keys: string[]): string | null {
  const v = pick(flat, keys);
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

/** "1,234.50", "₹1234.5", 1234.5 → 123450 paise. Rejects junk and negatives. */
export function toPaise(v: unknown): number | null {
  const n = toNumber(v);
  if (n === null || n <= 0) return null;
  return Math.round(n * 100);
}

/** Tolerant numeric parse: strips currency symbols, thousands separators. */
export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[^\d.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Best-effort ISO date. Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY. */
export function toIsoDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Indian POS systems overwhelmingly emit day-first.
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${m}-${d}`;
  }
  return s;
}

/** Trimmed non-empty string, or null. Numbers are stringified (ids arrive both ways). */
function asTrimmed(v: unknown): string | null {
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
  if (typeof v !== "string") return null;
  return v.trim() || null;
}

/**
 * Normalize a vendor unit label, and refuse the ones that are not units.
 *
 * Two specific hazards, both observed live:
 *   - "4365934" — PetPooja's internal unit id, which is what the `unit` field
 *     actually holds. An all-digit "unit" can never be real, and letting it
 *     through would have every conversion miss silently.
 *   - "Ltr." — a trailing period, which would not equal "ltr" anywhere
 *     downstream. Stripped along with case and surrounding space.
 *
 * Returns "" for anything unusable, which callers already treat as "no unit".
 */
export function sanitizeUnit(v: unknown): string {
  const raw = asTrimmed(v);
  if (!raw) return "";
  const cleaned = raw.toLowerCase().replace(/\.+$/, "").trim();
  if (!cleaned || /^\d+$/.test(cleaned)) return "";
  return cleaned;
}

interface HeaderCtx {
  supplierName: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
}

function mergeHeader(flat: Map<string, unknown>, parent: HeaderCtx): HeaderCtx {
  return {
    supplierName: pickString(flat, SUPPLIER_KEYS) ?? parent.supplierName,
    invoiceNo: pickString(flat, INVOICE_NO_KEYS) ?? parent.invoiceNo,
    invoiceDate: toIsoDate(pickString(flat, INVOICE_DATE_KEYS)) ?? parent.invoiceDate,
  };
}

/** Try to read one object as a purchase line. Returns null if it isn't one. */
function asLine(
  flat: Map<string, unknown>,
  header: HeaderCtx,
): PetpoojaPurchaseLine | null {
  const product = pickString(flat, PRODUCT_KEYS);
  if (!product) return null;

  const qty = toNumber(pick(flat, QTY_KEYS));
  if (qty === null || qty <= 0) return null;

  const lineTotalPaise = toPaise(pick(flat, LINE_TOTAL_KEYS));
  let unitPricePaise = toPaise(pick(flat, UNIT_PRICE_KEYS));

  // Many invoice exports carry only the line amount; derive the unit price.
  if (unitPricePaise === null && lineTotalPaise !== null) {
    unitPricePaise = Math.round(lineTotalPaise / qty);
  }
  if (unitPricePaise === null || unitPricePaise <= 0) return null;

  return {
    product,
    qty,
    unit: sanitizeUnit(pick(flat, UNIT_KEYS)),
    unitPricePaise,
    lineTotalPaise: lineTotalPaise ?? Math.round(unitPricePaise * qty),
    ...header,
  };
}

/**
 * Generic shape-agnostic traversal, shared by the purchase and stock parsers.
 *
 * Line-shaped objects win: a real line carries the fields `asLine` insists on,
 * which envelopes and headers do not. Anything else is treated as a wrapper and
 * we descend, carrying this node's header fields down with us — that is how a
 * nested `{ invoice_no, supplier, items: [...] }` shape gets its header fields
 * onto each line.
 */
function walk<T, H>(
  node: unknown,
  header: H,
  out: T[],
  depth: number,
  spec: {
    mergeHeader: (flat: Map<string, unknown>, parent: H) => H;
    asLine: (flat: Map<string, unknown>, header: H) => T | null;
  },
): void {
  if (depth > 8 || out.length >= 20_000) return;
  if (Array.isArray(node)) {
    for (const el of node) walk(el, header, out, depth + 1, spec);
    return;
  }
  if (!isRec(node)) return;

  const flat = flatten(node);
  const here = spec.mergeHeader(flat, header);

  const line = spec.asLine(flat, here);
  if (line) {
    out.push(line);
    return;
  }
  for (const v of Object.values(node)) {
    if (Array.isArray(v) || isRec(v)) walk(v, here, out, depth + 1, spec);
  }
}

/**
 * Header fields for one verified-shape purchase.
 *
 * The supplier is the reason this cannot be left to `walk`. It lives at
 * `restaurant_details.receiver.receiver_name`, which is a SIBLING subtree of
 * `item_details`, not an ancestor of it — and `walk` only ever inherits header
 * fields downward from enclosing objects. No widening of the alias lists fixes
 * that; it is a shape problem, not a naming one. So the verified shape gets a
 * parser that knows where to look.
 */
function verifiedPurchaseHeader(p: Rec): HeaderCtx {
  const details = isRec(p["restaurant_details"]) ? p["restaurant_details"] : null;
  const receiver = details && isRec(details["receiver"]) ? details["receiver"] : null;
  const flat = flatten(p);
  return {
    // `sender` is us; only ever read `receiver`.
    supplierName: receiver ? asTrimmed(receiver["receiver_name"]) : null,
    invoiceNo:
      asTrimmed(p["invoice_number"]) ??
      asTrimmed(p["purchase_id"]) ??
      asTrimmed(p["mrn_no"]),
    invoiceDate: toIsoDate(pickString(flat, INVOICE_DATE_KEYS)),
  };
}

/**
 * Exact parser for the verified `{ purchases: [{ …, item_details: [...] }] }`
 * shape. Returns null — not [] — when the body is not that shape, so the caller
 * can tell "not this contract, try the generic walker" apart from "this
 * contract, no invoices".
 */
function parseVerifiedPurchases(body: unknown): PetpoojaPurchaseLine[] | null {
  if (!isRec(body) || !Array.isArray(body["purchases"])) return null;
  const out: PetpoojaPurchaseLine[] = [];
  for (const p of body["purchases"]) {
    if (!isRec(p)) continue;
    const header = verifiedPurchaseHeader(p);
    const items = p["item_details"];
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      if (!isRec(it)) continue;
      const product = asTrimmed(it["itemname"]);
      if (!product) continue;
      const qty = toNumber(it["qty"]);
      if (qty === null || qty <= 0) continue;

      const lineTotalPaise = toPaise(it["amount"]);
      // `price` is per `lbl_unit`; `weighted_price` is the same number on the
      // rows observed, kept as a fallback. A zero-priced line (free stock, or
      // an invoice still being drafted) is dropped rather than learned from —
      // a 0 would otherwise land in buying_price_paise as a real price.
      let unitPricePaise = toPaise(it["price"]) ?? toPaise(it["weighted_price"]);
      if (unitPricePaise === null && lineTotalPaise !== null) {
        unitPricePaise = Math.round(lineTotalPaise / qty);
      }
      if (unitPricePaise === null || unitPricePaise <= 0) continue;

      out.push({
        product,
        qty,
        unit: sanitizeUnit(it["lbl_unit"] ?? it["unit"]),
        unitPricePaise,
        lineTotalPaise: lineTotalPaise ?? Math.round(unitPricePaise * qty),
        supplierName: header.supplierName,
        invoiceNo: header.invoiceNo,
        invoiceDate: toIsoDate(asTrimmed(it["invoice_date"])) ?? header.invoiceDate,
      });
    }
  }
  return out;
}

/**
 * Parse the vendor response into purchase lines. Tries the verified shape
 * first, then falls back to the shape-agnostic walker.
 *
 * The walker is kept rather than deleted because it costs nothing and covers
 * the case this file has already been burned by once: the vendor's actual
 * contract differing from the one we believed. Returns `[]` (never throws).
 */
export function normalizePurchaseResponse(body: unknown): PetpoojaPurchaseLine[] {
  const verified = parseVerifiedPurchases(body);
  if (verified && verified.length > 0) return verified;

  const out: PetpoojaPurchaseLine[] = [];
  walk<PetpoojaPurchaseLine, HeaderCtx>(
    body,
    { supplierName: null, invoiceNo: null, invoiceDate: null },
    out,
    0,
    { mergeHeader, asLine },
  );
  // An empty `purchases: []` is a real, correct answer ("no invoices that
  // window"); prefer it over whatever the walker scavenged from the envelope.
  return out.length > 0 ? out : (verified ?? out);
}

// ── Stock ───────────────────────────────────────────────────────────────────

/** One on-hand balance, normalized out of whatever the vendor returned. */
export interface PetpoojaStockLine {
  /** Free-text product name as the vendor spells it. */
  product: string;
  /** On-hand quantity in `unit`. Zero is a legitimate value here. */
  qty: number;
  /** Raw vendor unit, lowercased and trimmed. May be "". */
  unit: string;
  /** ISO `YYYY-MM-DD` the balance is as-of, when the vendor said. */
  asOfDate: string | null;
}

interface StockHeaderCtx {
  asOfDate: string | null;
}

function mergeStockHeader(flat: Map<string, unknown>, parent: StockHeaderCtx): StockHeaderCtx {
  return {
    asOfDate: toIsoDate(pickString(flat, STOCK_DATE_KEYS)) ?? parent.asOfDate,
  };
}

/**
 * Try to read one object as a stock balance. Returns null if it isn't one.
 *
 * Unlike a purchase line, qty **0 is valid and meaningful** — it is the whole
 * point of a stock feed — so the guard is "a stock-specific quantity key is
 * present and parses to a non-negative finite number", not "qty > 0".
 * A negative balance is refused: PetPooja can emit one after a bad adjustment,
 * and feeding it to the reorder engine understates what we hold.
 */
function asStockLine(
  flat: Map<string, unknown>,
  header: StockHeaderCtx,
): PetpoojaStockLine | null {
  const product = pickString(flat, PRODUCT_KEYS);
  if (!product) return null;

  const raw = pick(flat, STOCK_QTY_KEYS);
  if (raw === undefined) return null;
  const qty = toNumber(raw);
  if (qty === null || qty < 0) return null;

  return {
    product,
    qty,
    unit: sanitizeUnit(pick(flat, UNIT_KEYS)),
    asOfDate: header.asOfDate,
  };
}

/** Shape-agnostic stock parser. Returns `[]` (never throws) when nothing matches. */
export function normalizeStockResponse(body: unknown): PetpoojaStockLine[] {
  const out: PetpoojaStockLine[] = [];
  walk<PetpoojaStockLine, StockHeaderCtx>(body, { asOfDate: null }, out, 0, {
    mergeHeader: mergeStockHeader,
    asLine: asStockLine,
  });
  return out;
}

export interface PurchaseDateRange {
  /** `YYYY-MM-DD`, inclusive. */
  startDate: string;
  /** `YYYY-MM-DD`, inclusive. */
  endDate: string;
}

/**
 * Request body for Get Purchase. VERIFIED: credentials at body level, `restID`
 * = the menu sharing code, and `from_date`/`to_date` as the date keys.
 *
 * The earlier version of this also sent `start_date`/`end_date` as aliases, on
 * the theory that extra keys are free. They are not quite free: with only
 * `start_date`/`end_date` present the endpoint answers code 100 "Please provide
 * all request parameters", so the aliases were never doing anything, and having
 * them there disguised which pair was load-bearing.
 */
export function buildPurchaseRequestBody(
  cfg: PetpoojaInventoryConfig,
  range: PurchaseDateRange,
): Record<string, string> {
  return {
    app_key: cfg.appKey,
    app_secret: cfg.appSecret,
    access_token: cfg.accessToken,
    restID: cfg.restId,
    from_date: range.startDate,
    to_date: range.endDate,
  };
}

/**
 * Request body for Get Stock. VERIFIED key name (`date`); the endpoint reads it
 * and answers about the date's validity, which is how we know it is the right
 * key. `stock_date` alone gets code 100.
 */
export function buildStockRequestBody(
  cfg: PetpoojaInventoryConfig,
  opts: { date: string },
): Record<string, string> {
  return {
    app_key: cfg.appKey,
    app_secret: cfg.appSecret,
    access_token: cfg.accessToken,
    restID: cfg.restId,
    date: opts.date,
  };
}

/** The vendor's verdict on a request, read out of the body rather than the status. */
export interface VendorEnvelope {
  /** False when PetPooja rejected the request, whatever the HTTP status said. */
  ok: boolean;
  /** `code` ("101") or `errorCode` ("GN_105"), depending which layer refused. */
  code: string | null;
  message: string | null;
}

/**
 * Read PetPooja's success flag out of a response body.
 *
 * This exists because PetPooja answers **HTTP 200 for everything** — including
 * `{"success":"0","message":"Invalid client credentials.","errorCode":"GN_105"}`.
 * Trusting the status code turns a wrong password into "zero rows parsed",
 * which then reads as a response-shape problem and sends whoever is on call to
 * the parser instead of to the credentials. Both failure envelopes have been
 * observed live: `code` for endpoint-level refusals (100/101/103/301) and
 * `errorCode` for gateway-level ones (GN_103/GN_105).
 *
 * A body with no `success` field at all is treated as OK-but-unknown rather
 * than as a failure: that is the vendor-changed-shape case, and the parsers
 * below are the better judge of it than a missing flag is.
 */
export function readVendorEnvelope(parsed: unknown): VendorEnvelope {
  if (!isRec(parsed)) return { ok: true, code: null, message: null };
  const code = asTrimmed(parsed["code"]) ?? asTrimmed(parsed["errorCode"]);
  const message = asTrimmed(parsed["message"]);
  if (!("success" in parsed)) return { ok: true, code, message };
  const success = parsed["success"];
  const ok = success === "1" || success === 1 || success === true;
  return { ok, code, message };
}

export interface PurchaseFetchResult {
  ok: boolean;
  /** True when the integration is unconfigured — not an error. */
  skipped?: boolean;
  status?: number;
  lines: PetpoojaPurchaseLine[];
  error?: string;
}

export interface StockFetchResult {
  ok: boolean;
  /** True when the integration is unconfigured — not an error. */
  skipped?: boolean;
  status?: number;
  lines: PetpoojaStockLine[];
  error?: string;
}

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

interface RawPost {
  ok: boolean;
  status?: number;
  parsed?: unknown;
  error?: string;
}

/**
 * One POST to the vendor. Never throws: a vendor outage must not take down the
 * scheduler.
 *
 * Credentials go in the body and ONLY in the body. An earlier revision also
 * mirrored them into `app-key`/`app-secret`/`access-token` request headers,
 * hedging on which the service wanted; a body-only request is now confirmed to
 * work, so the headers are gone. Headers are the copy that leaks — they are
 * what proxies, gateways and HTTP client debug logs echo by default.
 *
 * POST rather than GET despite the vendor's example using `GET` with a body:
 * both were confirmed to return identical responses, and a GET with a body is
 * outside the fetch spec — Node's own `fetch` rejects it outright.
 */
async function postToInventory(
  url: string,
  body: Record<string, string>,
  label: string,
  log: InventoryLogger | undefined,
  fetchImpl: FetchLike | undefined,
): Promise<RawPost> {
  const doFetch = fetchImpl ?? (fetch as unknown as FetchLike);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw text — the normalizers will simply find nothing */
    }
    if (!res.ok) {
      log?.error?.(
        { url, status: res.status, body: typeof parsed === "string" ? parsed.slice(0, 500) : parsed },
        `petpooja inventory: ${label} rejected`,
      );
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status, parsed };
  } catch (err) {
    log?.error?.({ url, err }, `petpooja inventory: ${label} failed`);
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(timeout);
  }
}

/** Whole days between two `YYYY-MM-DD` strings, or null if either is unparseable. */
function daysBetween(startDate: string, endDate: string): number | null {
  const a = Date.parse(`${startDate}T00:00:00Z`);
  const b = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Clamp a requested window to what the vendor will actually serve.
 *
 * Two distinct hazards, both silent:
 *   - Too wide → code 101, zero lines, and (before `readVendorEnvelope`) an
 *     "ok" result. Clamped forward, keeping `endDate`, because recent prices
 *     are the ones the reorder engine is about to use.
 *   - Reversed (`end` < `start`) → the vendor cheerfully answers "No record
 *     found." rather than complaining, so a date bug looks exactly like a quiet
 *     week. Refused here instead.
 */
function clampPurchaseRange(
  range: PurchaseDateRange,
  log: InventoryLogger | undefined,
): PurchaseDateRange | null {
  const span = daysBetween(range.startDate, range.endDate);
  if (span === null) {
    log?.error?.({ range }, "petpooja inventory: get_purchase range is not a valid date pair");
    return null;
  }
  if (span < 0) {
    log?.error?.(
      { range },
      "petpooja inventory: get_purchase refused — end date precedes start date (the vendor would answer 'No record found' and hide this)",
    );
    return null;
  }
  if (span <= MAX_PURCHASE_RANGE_DAYS) return range;
  const start = new Date(Date.parse(`${range.endDate}T00:00:00Z`) - MAX_PURCHASE_RANGE_DAYS * 86_400_000);
  const clamped = { startDate: start.toISOString().slice(0, 10), endDate: range.endDate };
  log?.warn?.(
    { requested: range, clamped, maxDays: MAX_PURCHASE_RANGE_DAYS },
    "petpooja inventory: get_purchase window wider than the vendor allows — clamped to the most recent window",
  );
  return clamped;
}

/**
 * Fetch supplier-invoice lines for a date range. Returns `{ ok: false }` on any
 * failure rather than throwing.
 *
 * `fetchImpl` is injectable so tests exercise the parse path without network.
 */
export async function fetchPurchases(
  range: PurchaseDateRange,
  opts: { fetchImpl?: FetchLike; log?: InventoryLogger } = {},
): Promise<PurchaseFetchResult> {
  const cfg = petpoojaInventoryConfig();
  if (!cfg) {
    opts.log?.info?.({ range }, "petpooja inventory: get_purchase skipped — not configured");
    return { ok: false, skipped: true, lines: [] };
  }
  const window = clampPurchaseRange(range, opts.log);
  if (!window) {
    return { ok: false, lines: [], error: "invalid_date_range" };
  }
  const url = `${cfg.baseUrl}${cfg.purchasePath}`;
  const res = await postToInventory(
    url,
    buildPurchaseRequestBody(cfg, window),
    "get_purchase",
    opts.log,
    opts.fetchImpl,
  );
  if (!res.ok) {
    return { ok: false, status: res.status, lines: [], error: res.error };
  }
  const envelope = readVendorEnvelope(res.parsed);
  if (!envelope.ok) {
    opts.log?.error?.(
      { url, range: window, status: res.status, code: envelope.code, message: envelope.message },
      "petpooja inventory: get_purchase rejected by the vendor",
    );
    return {
      ok: false,
      status: res.status,
      lines: [],
      error: `${envelope.code ?? "vendor_error"}: ${envelope.message ?? "rejected"}`,
    };
  }
  const lines = normalizePurchaseResponse(res.parsed);
  if (lines.length === 0) {
    // Now that a vendor rejection is caught above, "accepted but empty" really
    // does mean no invoices in the window — a normal, common answer for a
    // kitchen that buys weekly. Logged at info, not warn.
    opts.log?.info?.(
      { url, range: window, status: res.status, message: envelope.message },
      "petpooja inventory: get_purchase returned no invoice lines for the window",
    );
  }
  return { ok: true, status: res.status, lines };
}

/**
 * Fetch on-hand balances as of one date. Same never-throws contract as
 * `fetchPurchases`; `fetchImpl` is injectable for tests.
 */
export async function fetchStock(
  date: string,
  opts: { fetchImpl?: FetchLike; log?: InventoryLogger } = {},
): Promise<StockFetchResult> {
  const cfg = petpoojaInventoryConfig();
  if (!cfg) {
    opts.log?.info?.({ date }, "petpooja inventory: get_stock skipped — not configured");
    return { ok: false, skipped: true, lines: [] };
  }
  const url = `${cfg.baseUrl}${cfg.stockPath}`;
  const res = await postToInventory(
    url,
    buildStockRequestBody(cfg, { date }),
    "get_stock",
    opts.log,
    opts.fetchImpl,
  );
  if (!res.ok) {
    return { ok: false, status: res.status, lines: [], error: res.error };
  }
  const envelope = readVendorEnvelope(res.parsed);
  if (!envelope.ok) {
    // Code 301 ("Provide date is not in your date range", with an empty
    // available_range) is the answer this outlet gives for EVERY date tried
    // across a year and every date format — i.e. stock history is not
    // provisioned yet. That is a PetPooja-side fix, not a code change, so it is
    // surfaced as a vendor rejection with the code intact rather than being
    // flattened into "no rows".
    opts.log?.error?.(
      { url, date, status: res.status, code: envelope.code, message: envelope.message },
      "petpooja inventory: get_stock rejected by the vendor",
    );
    return {
      ok: false,
      status: res.status,
      lines: [],
      error: `${envelope.code ?? "vendor_error"}: ${envelope.message ?? "rejected"}`,
    };
  }
  const lines = normalizeStockResponse(res.parsed);
  if (lines.length === 0) {
    // An accepted-but-empty stock response is NOT routine the way an empty
    // purchase window is: a working kitchen always holds something, so zero
    // rows means the shape changed or the outlet genuinely has nothing.
    opts.log?.warn?.(
      { url, date, status: res.status, message: envelope.message },
      "petpooja inventory: get_stock was accepted but returned no parseable rows",
    );
  }
  return { ok: true, status: res.status, lines };
}
