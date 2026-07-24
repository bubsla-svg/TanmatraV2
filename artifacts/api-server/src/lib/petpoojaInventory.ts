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

function walk(
  node: unknown,
  header: HeaderCtx,
  out: PetpoojaPurchaseLine[],
  depth: number,
): void {
  if (depth > 8 || out.length >= 20_000) return;
  if (Array.isArray(node)) {
    for (const el of node) walk(el, header, out, depth + 1);
    return;
  }
  if (!isRec(node)) return;

  const flat = flatten(node);
  const here = mergeHeader(flat, header);

  // Line-shaped objects win: a real line carries product + qty + a price, which
  // invoice headers and envelopes do not. Anything else is treated as a wrapper
  // and we descend, carrying this node's supplier/invoice fields down with us —
  // that is how a nested { invoice_no, supplier, items: [...] } shape gets its
  // header fields onto each line.
  const line = asLine(flat, here);
  if (line) {
    out.push(line);
    return;
  }
  for (const v of Object.values(node)) {
    if (Array.isArray(v) || isRec(v)) walk(v, here, out, depth + 1);
  }
}

/**
 * Shape-agnostic parser: pull every purchase-line-shaped object out of the
 * vendor response, inheriting supplier/invoice fields from enclosing objects.
 * Returns `[]` (never throws) when nothing matches.
 */
export function normalizePurchaseResponse(body: unknown): PetpoojaPurchaseLine[] {
  const out: PetpoojaPurchaseLine[] = [];
  walk(body, { supplierName: null, invoiceNo: null, invoiceDate: null }, out, 0);
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

export interface PurchaseFetchResult {
  ok: boolean;
  /** True when the integration is unconfigured — not an error. */
  skipped?: boolean;
  status?: number;
  lines: PetpoojaPurchaseLine[];
  error?: string;
}

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

/**
 * Fetch supplier-invoice lines for a date range. Never throws: a vendor outage
 * must not take down the scheduler. Returns `{ ok: false }` on any failure.
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
  const doFetch = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const url = `${cfg.baseUrl}${cfg.purchasePath}`;
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
      body: JSON.stringify(buildPurchaseRequestBody(cfg, range)),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw text — normalize will simply find nothing */
    }
    if (!res.ok) {
      opts.log?.error?.(
        { url, status: res.status, body: typeof parsed === "string" ? parsed.slice(0, 500) : parsed },
        "petpooja inventory: get_purchase rejected",
      );
      return { ok: false, status: res.status, lines: [] };
    }
    const lines = normalizePurchaseResponse(parsed);
    if (lines.length === 0) {
      opts.log?.warn?.(
        { url, range, status: res.status },
        "petpooja inventory: get_purchase returned no parseable lines — the response shape may differ from the assumed contract",
      );
    }
    return { ok: true, status: res.status, lines };
  } catch (err) {
    opts.log?.error?.({ url, range, err }, "petpooja inventory: get_purchase failed");
    return { ok: false, lines: [], error: (err as Error).message };
  } finally {
    clearTimeout(timeout);
  }
}
