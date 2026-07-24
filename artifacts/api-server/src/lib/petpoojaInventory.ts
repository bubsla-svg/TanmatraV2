/**
 * PetPooja **Inventory** API client (purchase / supplier-invoice reads).
 *
 * This is a DIFFERENT service from the POS integration in `petpoojaClient.ts`:
 *
 *   | Concern            | Host                        | Identifier                   |
 *   |--------------------|-----------------------------|------------------------------|
 *   | Orders + menu (POS)| pos.petpooja.com            | Menu Sharing Code (cq5hnj…)  |
 *   | Inventory reads    | inventory.petpooja.com      | RID (355738)                 |
 *
 * The two identifiers are NOT interchangeable — see
 * `PETPOOJA_RESTAURANT_ID` (sharing code) vs `PETPOOJA_INVENTORY_RID`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ UNVERIFIED VENDOR CONTRACT
 * ─────────────────────────────────────────────────────────────────────────
 * PetPooja's Inventory API reference (https://inventory.petpooja.com/inventory_api)
 * is a client-rendered page and returns an empty document to HTTP fetchers, so
 * the endpoint path, the request-body key names and the response shape below
 * could NOT be read from the spec. They are best-effort guesses modelled on the
 * POS API's conventions.
 *
 * Everything that depends on those guesses is confined to this file, and the
 * response parser (`normalizePurchaseResponse`) is deliberately shape-agnostic:
 * it walks whatever JSON comes back looking for purchase-line-shaped objects
 * under a broad set of key aliases, rather than binding to one schema. So a
 * wrong guess degrades to "zero lines parsed + a logged warning", never to a
 * crash or to bad prices.
 *
 * To correct a guess, override via env (no code change / redeploy of logic):
 *   PETPOOJA_INVENTORY_BASE_URL      default https://inventory.petpooja.com
 *   PETPOOJA_PURCHASE_PATH           default /api/get_purchase
 *   PETPOOJA_STOCK_PATH              default /api/get_stock          (Slice B)
 *
 * The whole module is inert unless the three PetPooja secrets AND
 * PETPOOJA_INVENTORY_RID are present — `petpoojaInventoryConfig()` returns null
 * and every caller no-ops, exactly like `petpoojaConfig()` in petpoojaClient.ts.
 */

export interface PetpoojaInventoryConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  /** Inventory RID (e.g. "355738") — NOT the menu sharing code. */
  rid: string;
  baseUrl: string;
  purchasePath: string;
  stockPath: string;
}

export interface InventoryLogger {
  info?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
}

const DEFAULT_BASE_URL = "https://inventory.petpooja.com";
const DEFAULT_PURCHASE_PATH = "/api/get_purchase";
const DEFAULT_STOCK_PATH = "/api/get_stock";
const REQUEST_TIMEOUT_MS = 15_000;

/** Fully-configured inventory config, or null when the integration is off. */
export function petpoojaInventoryConfig(): PetpoojaInventoryConfig | null {
  const appKey = process.env["PETPOOJA_APP_KEY"];
  const appSecret = process.env["PETPOOJA_APP_SECRET"];
  const accessToken = process.env["PETPOOJA_ACCESS_TOKEN"];
  const rid = process.env["PETPOOJA_INVENTORY_RID"];
  if (!appKey || !appSecret || !accessToken || !rid) return null;
  return {
    appKey,
    appSecret,
    accessToken,
    rid,
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
const UNIT_KEYS = ["unit", "uom", "unit_name", "unitname", "item_unit", "measurement"];
const UNIT_PRICE_KEYS = [
  "rate", "unit_price", "unitprice", "purchase_price", "purchaseprice",
  "item_rate", "itemrate", "price", "cost", "unit_cost",
];
const LINE_TOTAL_KEYS = [
  "amount", "total", "line_total", "linetotal", "net_amount", "netamount",
  "taxable_amount", "item_amount", "itemamount", "total_amount", "gross_amount",
];
const SUPPLIER_KEYS = [
  "supplier_name", "suppliername", "vendor_name", "vendorname",
  "party_name", "partyname", "supplier", "vendor", "party",
];
const INVOICE_NO_KEYS = [
  "invoice_no", "invoiceno", "invoice_number", "invoicenumber",
  "bill_no", "billno", "purchase_no", "purchaseno", "reference_no", "referenceno",
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

  const unitRaw = pickString(flat, UNIT_KEYS);
  return {
    product,
    qty,
    unit: (unitRaw ?? "").toLowerCase().trim(),
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
 * Shape-agnostic parser: pull every purchase-line-shaped object out of the
 * vendor response, inheriting supplier/invoice fields from enclosing objects.
 * Returns `[]` (never throws) when nothing matches.
 */
export function normalizePurchaseResponse(body: unknown): PetpoojaPurchaseLine[] {
  const out: PetpoojaPurchaseLine[] = [];
  walk<PetpoojaPurchaseLine, HeaderCtx>(
    body,
    { supplierName: null, invoiceNo: null, invoiceDate: null },
    out,
    0,
    { mergeHeader, asLine },
  );
  return out;
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

  const unitRaw = pickString(flat, UNIT_KEYS);
  return {
    product,
    qty,
    unit: (unitRaw ?? "").toLowerCase().trim(),
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
 * ⚠ UNVERIFIED. Request body for Get Purchase. Credentials mirror the POS Save
 * Order convention (body-level app_key/app_secret/access_token). Both the
 * identifier key and the date-range keys are sent under their plausible
 * aliases, because the spec could not be read — extra keys are ignored by
 * every PetPooja endpoint we have observed, a missing key is a hard failure.
 */
export function buildPurchaseRequestBody(
  cfg: PetpoojaInventoryConfig,
  range: PurchaseDateRange,
): Record<string, string> {
  return {
    app_key: cfg.appKey,
    app_secret: cfg.appSecret,
    access_token: cfg.accessToken,
    restID: cfg.rid,
    restaurantid: cfg.rid,
    start_date: range.startDate,
    end_date: range.endDate,
    from_date: range.startDate,
    to_date: range.endDate,
  };
}

/**
 * ⚠ UNVERIFIED. Request body for Get Stock. PetPooja support described this as
 * "stock levels for a given date", so one date is sent under every plausible
 * key, including a degenerate start==end range in case it is range-shaped.
 */
export function buildStockRequestBody(
  cfg: PetpoojaInventoryConfig,
  opts: { date: string },
): Record<string, string> {
  return {
    app_key: cfg.appKey,
    app_secret: cfg.appSecret,
    access_token: cfg.accessToken,
    restID: cfg.rid,
    restaurantid: cfg.rid,
    date: opts.date,
    stock_date: opts.date,
    start_date: opts.date,
    end_date: opts.date,
  };
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
 * One POST to the inventory host. Never throws: a vendor outage must not take
 * down the scheduler. Credentials go in the body (mirroring the POS API's Save
 * Order convention) AND in headers, because which one this service wants could
 * not be read from the spec.
 */
async function postToInventory(
  cfg: PetpoojaInventoryConfig,
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
      headers: {
        "Content-Type": "application/json",
        // Header-style credentials, in case this service authenticates that way.
        "app-key": cfg.appKey,
        "app-secret": cfg.appSecret,
        "access-token": cfg.accessToken,
      },
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
  const url = `${cfg.baseUrl}${cfg.purchasePath}`;
  const res = await postToInventory(
    cfg,
    url,
    buildPurchaseRequestBody(cfg, range),
    "get_purchase",
    opts.log,
    opts.fetchImpl,
  );
  if (!res.ok) {
    return { ok: false, status: res.status, lines: [], error: res.error };
  }
  const lines = normalizePurchaseResponse(res.parsed);
  if (lines.length === 0) {
    opts.log?.warn?.(
      { url, range, status: res.status },
      "petpooja inventory: get_purchase returned no parseable lines — the response shape may differ from the assumed contract",
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
    cfg,
    url,
    buildStockRequestBody(cfg, { date }),
    "get_stock",
    opts.log,
    opts.fetchImpl,
  );
  if (!res.ok) {
    return { ok: false, status: res.status, lines: [], error: res.error };
  }
  const lines = normalizeStockResponse(res.parsed);
  if (lines.length === 0) {
    opts.log?.warn?.(
      { url, date, status: res.status },
      "petpooja inventory: get_stock returned no parseable rows — the response shape may differ from the assumed contract",
    );
  }
  return { ok: true, status: res.status, lines };
}
