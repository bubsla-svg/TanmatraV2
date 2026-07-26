import { createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { PetpoojaSaveOrderPayload } from "./petpooja";
// The authoritative charge calculator, imported rather than re-derived. What we
// tell the POS an order cost has to move when what we bill moves, and the only
// way to guarantee that is to have one implementation. A second copy of the GST
// arithmetic here would be a copy that goes stale — see cartMath.ts, which is a
// deliberate display mirror and already hardcodes 0.05 / 0.18 / 50000 / 5000.
import { computeChargePaise } from "./loyaltyEngine";

/**
 * Petpooja OUTBOUND client + INBOUND webhook auth.
 *
 * The repo already had the inbound webhook routes + mapping library, but two
 * things were missing to make the integration production-safe:
 *   1. Authentication on the inbound webhooks (anyone could POST orders /
 *      flip stock / change order status).
 *   2. Outbound order push — orders placed on tanmatra.food were never sent
 *      to Petpooja's Save Order API, so they'd never reach the POS/kitchen.
 *
 * Everything here is gated behind PETPOOJA_* env. Outbound is a no-op when
 * unconfigured. Inbound webhooks FAIL CLOSED: unconfigured means "reject",
 * never "allow".
 *
 * ⚠ SECURITY CORRECTION (25 Jul 2026) — this file used to do the opposite.
 *
 * `petpoojaAuthOk()` returned `true` in two situations that both amounted to
 * "no authentication at all":
 *
 *   1. Integration unconfigured (any one PETPOOJA_* var missing) → allow.
 *   2. mode "lenient" + request presented NO credentials → allow.
 *
 * `/integrations/petpooja/push-menu` was a "lenient" route, and it bulk-upserts
 * `menu_items` — including `price_paise`. Combining (1) and (2), that endpoint
 * was reachable **without credentials in every deployment state**: unconfigured
 * because of rule 1, configured because of rule 2. Anyone who could reach the
 * server could rewrite the menu and every price on it.
 *
 * The header of this very file used to describe rule 1 as the integration being
 * "inert" when unconfigured. It was not inert. Outbound was inert; inbound was
 * wide open. Anyone reasoning from that sentence — including an operator
 * deciding how to switch Petpooja off — would have reached exactly the wrong
 * conclusion, because clearing PETPOOJA_* env disabled the *authentication*,
 * not the *endpoints*.
 *
 * Both holes are closed here. Decommissioning now means UNMOUNTING the router
 * (see `petpoojaWebhooksMounted`), not blanking env; and blanking env now
 * rejects rather than admits. The only way to get an unauthenticated webhook
 * surface is the explicit, production-refused dev flag below.
 */

export interface PetpoojaConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  restId: string;
  restName: string;
  saveOrderUrl: string;
  menuSharingCode: string;
}

/** Returns the fully-configured Petpooja config, or null if not configured. */
export function petpoojaConfig(): PetpoojaConfig | null {
  const appKey = process.env.PETPOOJA_APP_KEY;
  const appSecret = process.env.PETPOOJA_APP_SECRET;
  const accessToken = process.env.PETPOOJA_ACCESS_TOKEN;
  const restId = process.env.PETPOOJA_RESTAURANT_ID;
  if (!appKey || !appSecret || !accessToken || !restId) return null;
  return {
    appKey,
    appSecret,
    accessToken,
    restId,
    restName: process.env.PETPOOJA_RESTAURANT_NAME || "Wellness Foods",
    saveOrderUrl:
      process.env.PETPOOJA_SAVE_ORDER_URL ||
      "https://pos.petpooja.com/api/v1/save_order",
    menuSharingCode: process.env.PETPOOJA_MENU_SHARING_CODE || restId,
  };
}

export function isPetpoojaEnabled(): boolean {
  return petpoojaConfig() !== null;
}

/**
 * Verify an inbound Petpooja webhook. Petpooja includes app_key / app_secret
 * in the request body for order webhooks; for stock/store webhooks the shared
 * secret may instead arrive as the `x-petpooja-app-secret` header. We accept
 * either. Result:
 *   - { ok: true, configured: true }   → authenticated
 *   - { ok: true, configured: false }  → integration not configured; caller
 *                                        should allow but log a warning
 *   - { ok: false }                    → configured AND credentials mismatch
 */
export interface PetpoojaAuthResult {
  /** Fully authenticated — the caller may proceed. */
  ok: boolean;
  /** PETPOOJA_* env is complete. When false, `ok` is always false. */
  configured: boolean;
  /** The request carried something that looks like a credential. */
  presented: boolean;
  /** The shared secret matched, even if `app_key` was absent or wrong. */
  secretMatches: boolean;
}

/** Constant-time string compare that doesn't leak length via early return. */
function secretEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch; hash first so lengths always match.
  const ah = createHash("sha256").update(ab).digest();
  const bh = createHash("sha256").update(bb).digest();
  return timingSafeEqual(ah, bh);
}

export function verifyPetpoojaAuth(req: Request): PetpoojaAuthResult {
  const cfg = petpoojaConfig();
  // Unconfigured is NOT a pass. There is no secret to check against, so no
  // caller can be authenticated. `petpoojaAuthOk` decides what to do about it.
  if (!cfg) {
    return { ok: false, configured: false, presented: false, secretMatches: false };
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const headerSecret =
    (req.get("x-petpooja-app-secret") || req.get("x-petpooja-secret") || "").trim();
  const bodyKey = typeof body.app_key === "string" ? body.app_key : "";
  const bodySecret = typeof body.app_secret === "string" ? body.app_secret : "";

  // Two accepted channels, evaluated independently so a sender that supplies
  // both (a correct header alongside a stale body app_key, say) still passes:
  //   - body credentials      — order / status / rider webhooks
  //   - x-petpooja-app-secret — stock / store-status webhooks
  const presented = Boolean(bodyKey || bodySecret || headerSecret);
  if (!presented) {
    return { ok: false, configured: true, presented: false, secretMatches: false };
  }

  const headerOk = headerSecret ? secretEquals(headerSecret, cfg.appSecret) : false;
  const bodySecretOk = bodySecret ? secretEquals(bodySecret, cfg.appSecret) : false;
  const bodyOk = bodySecretOk && secretEquals(bodyKey, cfg.appKey);

  return {
    ok: headerOk || bodyOk,
    configured: true,
    presented: true,
    secretMatches: headerOk || bodySecretOk,
  };
}

/**
 * Dev-only escape hatch for running the inbound webhook surface without
 * credentials. Deliberately verbose, deliberately opt-in, and deliberately
 * refused in production — the point is that "unauthenticated" must be a thing
 * somebody typed on purpose, not a thing that happens when config is absent.
 */
export function petpoojaAllowUnauthenticated(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const v = (process.env.PETPOOJA_WEBHOOKS_INSECURE_ALLOW_UNAUTHENTICATED ?? "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/**
 * Should the inbound Petpooja webhook router be mounted at all?
 *
 * This is the decommissioning switch. Set `PETPOOJA_WEBHOOKS_ENABLED=false` and
 * the routes cease to exist (404), which is what "we turned the integration
 * off" should mean. Do NOT decommission by blanking PETPOOJA_* env — that used
 * to disable authentication rather than the endpoints, and the write paths
 * stayed live and open.
 *
 * Unconfigured also means unmounted: an inbound surface that cannot
 * authenticate anybody has no legitimate caller. The dev flag re-mounts it.
 */
export function petpoojaWebhooksMounted(): boolean {
  const flag = (process.env.PETPOOJA_WEBHOOKS_ENABLED ?? "").trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off" || flag === "no") return false;
  return isPetpoojaEnabled() || petpoojaAllowUnauthenticated();
}

/**
 * Express-style guard. Returns true when the request should proceed.
 *
 * Both modes reject an unconfigured integration and reject a request that
 * presents no credentials. They differ only in which credential shapes count:
 *
 *   - "strict"  — body `app_key`+`app_secret`, or the `x-petpooja-app-secret`
 *                 header. Used for order/status/rider webhooks.
 *   - "lenient" — same, and additionally tolerates a body that carries only
 *                 `app_secret` (some Petpooja senders omit `app_key`). It does
 *                 NOT tolerate the absence of credentials.
 *
 * "lenient" previously meant "no credentials is fine, Petpooja authenticates
 * these by menu sharing code" — a claim nothing verified, on endpoints that
 * write to our database. That is gone. See the SECURITY CORRECTION note above.
 */
export function petpoojaAuthOk(
  req: Request,
  log: Logger | undefined,
  mode: "strict" | "lenient" = "strict",
): boolean {
  const r = verifyPetpoojaAuth(req);

  if (!r.configured) {
    if (petpoojaAllowUnauthenticated()) {
      log?.warn?.(
        { path: req.path },
        "petpooja webhook allowed UNAUTHENTICATED — PETPOOJA_WEBHOOKS_INSECURE_ALLOW_UNAUTHENTICATED is set; never do this outside local dev",
      );
      return true;
    }
    log?.warn?.(
      { path: req.path },
      "petpooja webhook REJECTED — integration is not configured; the surface should not be mounted (set PETPOOJA_WEBHOOKS_ENABLED=false to decommission)",
    );
    return false;
  }

  if (r.ok) return true;

  if (mode === "lenient" && r.presented && r.secretMatches) {
    log?.warn?.(
      { path: req.path },
      "petpooja webhook accepted on secret alone — sender omitted app_key",
    );
    return true;
  }

  log?.warn?.(
    { path: req.path, presented: r.presented },
    "petpooja webhook auth REJECTED",
  );
  return false;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Petpooja order_type codes: H = home delivery, P = pickup, D = dine-in.
function petpoojaOrderType(fulfillmentType: string | null | undefined): string {
  if (fulfillmentType === "pickup") return "P";
  if (fulfillmentType === "dinein") return "D";
  return "H";
}

type OrderRow = {
  externalOrderId: string | null;
  // The meal subtotal after discounts and credit — explicitly NOT the billable
  // number. See the column comment in lib/db/src/schema/orders.ts.
  totalPaise: number;
  // THE amount Razorpay actually captured. Nullable, because the guest-checkout
  // and legacy paths never wrote it and their `totalPaise` already includes GST
  // and the delivery fee; `chargePaise ?? totalPaise` is the authoritative
  // amount in both worlds, which is exactly how routes/payments.ts reconciles a
  // capture. This field was missing here, which made the push path structurally
  // incapable of telling the POS what the customer paid.
  chargePaise: number | null;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  dropLat: number | null;
  dropLng: number | null;
  items: unknown;
  fulfillmentType: string | null;
  deliveryInstructions: string | null;
  priority: string | null;
  scheduledFor: Date | null;
  orderKind?: string | null;
};

type NormalizedItem = { id: string; name: string; qty: number; pricePaise: number };

function finite(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * One reading of `order.items`, shared by the payload's line items and by the
 * charge decomposition below.
 *
 * They have to agree. Petpooja reconciles `total` against the line items plus
 * the sibling charge fields, so two independent readings of the same array —
 * one defaulting a missing quantity to 1, another to 0 — is precisely how that
 * reconciliation stops holding without anything going red. `quantity` is
 * accepted alongside `qty` because both spellings exist in stored rows.
 */
function normalizeItems(items: unknown): NormalizedItem[] {
  const raw = (Array.isArray(items) ? items : []) as Array<{
    id: number | string;
    name: string;
    qty?: number;
    quantity?: number;
    price: number;
  }>;
  return raw.map((it) => ({
    id: String(it.id),
    name: it.name,
    qty: finite(it.qty ?? it.quantity ?? 1, 1),
    pricePaise: finite(it.price, 0),
  }));
}

function rupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

export interface PetpoojaChargeBreakdown {
  /** Goes in `total` — the grand total, always the authoritative amount. */
  totalPaise: number;
  taxPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  /**
   * Whether the components were *proven*, not guessed. False means the three
   * component fields are all zero and only `totalPaise` is being asserted.
   */
  reconciled: boolean;
}

/**
 * Split an order into the fields Petpooja's Save Order payload actually asks
 * for: a grand total plus its components.
 *
 * **`total` is the grand total, not the item subtotal.** This was the open
 * question — our payload has both `total` and per-item prices, and a POS could
 * plausibly mean either. It is settled by evidence rather than by reading the
 * field name: Petpooja's own read API (`get_orders_api`) returns `core_total`
 * *and* `total` as siblings, and across 82 real orders from this outlet every
 * single one satisfies
 *
 *     total = core_total - discount_total + tax_total + delivery_charges
 *             + container_charges + service_charge + tip + round_off
 *
 * with `core_total` equal to the sum of the line items, and **none** satisfies
 * `total = core_total`. So `total` is the money that changed hands, and the
 * sibling fields are its parts. We previously sent the meal subtotal there with
 * every component zeroed — a payload that balanced perfectly while describing
 * an order that never happened: one with no tax and no delivery fee.
 *
 * **Why the components are recomputed rather than read.** The order row stores
 * only two money columns, `total_paise` and `charge_paise`; the GST and
 * delivery-fee parts are computed at checkout and discarded. Recomputing needs
 * two inputs, and only one of them is a column: `computeChargePaise` decides
 * the delivery fee from the *pre-discount* subtotal, so that the fee tracks the
 * same free-delivery progress bar the customer saw. That subtotal is recovered
 * from the line items, which `finalizeOrder` stores at menu price — the same
 * array it summed to get `grossPaise` in the first place.
 *
 * **All or nothing.** The recomputed charge is checked against the stored
 * `charge_paise` before any of it is used. If they disagree — a legacy row, a
 * guest-checkout row whose `total_paise` already includes GST and fee, a row
 * hand-edited by ops — we send the authoritative total and *zero* components
 * rather than a plausible-looking split. A wrong `tax_total` is not a cosmetic
 * error; it is a number the outlet files GST against. An unbalanced payload is
 * a question someone can ask; a balanced wrong one is not.
 */
export function decomposeOrderCharge(order: OrderRow): PetpoojaChargeBreakdown {
  const authoritativePaise = order.chargePaise ?? order.totalPaise;
  const bare: PetpoojaChargeBreakdown = {
    totalPaise: authoritativePaise,
    taxPaise: 0,
    deliveryFeePaise: 0,
    discountPaise: 0,
    reconciled: false,
  };
  // No stored charge means nobody ever computed one for this row, so there is
  // nothing to check a recomputation against.
  if (order.chargePaise == null) return bare;

  const grossPaise = normalizeItems(order.items).reduce(
    (sum, it) => sum + Math.round(it.pricePaise * it.qty),
    0,
  );
  if (grossPaise <= 0) return bare;

  // `dinein` is not a shape checkout can produce, but it exists in the column.
  // It carries no delivery fee, which is what the pickup branch means here.
  const recomputed = computeChargePaise({
    finalPaise: order.totalPaise,
    subtotalPaise: grossPaise,
    fulfillmentType: order.fulfillmentType === "delivery" ? "delivery" : "pickup",
  });
  if (recomputed.chargePaise !== order.chargePaise) return bare;

  // Everything taken off the menu price on the way to `total_paise`: bundle,
  // pickup, preorder and first-order discounts plus any credit redeemed. The
  // row does not record them separately, but their sum is exactly this
  // difference, and the sum is what `discount_total` asks for.
  const discountPaise = grossPaise - order.totalPaise;
  if (discountPaise < 0) return bare;

  return {
    totalPaise: order.chargePaise,
    taxPaise: recomputed.gstPaise,
    deliveryFeePaise: recomputed.deliveryFeePaise,
    discountPaise,
    reconciled: true,
  };
}

/**
 * Build the Petpooja Save Order payload from one of our order rows.
 *
 * The money fields come from `decomposeOrderCharge`, and when it reconciles the
 * payload satisfies Petpooja's own reconciliation identity by construction:
 *
 *     total = Σ(item final_price) - discount_total + tax_total
 *             + delivery_charges + packing_charges
 *
 * which is asserted directly in petpoojaClient.test.ts. `packing_charges` stays
 * "0" because we do not levy one — the outlet's aggregator orders carry a ₹20
 * `container_charges`, but that is Zomato's line, not a component of anything
 * `computeChargePaise` bills. Zero is the truthful value and it keeps the
 * identity balanced.
 */
export function serializeOrderToPetpooja(
  order: OrderRow,
  cfg: PetpoojaConfig,
  customer: { name?: string | null; email?: string | null },
  now: Date,
): PetpoojaSaveOrderPayload {
  const items = normalizeItems(order.items);
  const charge = decomposeOrderCharge(order);
  const when = order.scheduledFor ? new Date(order.scheduledFor) : now;
  const addressParts = [order.addressLine, order.city, order.pincode].filter(Boolean).join(", ");

  return {
    app_key: cfg.appKey,
    app_secret: cfg.appSecret,
    access_token: cfg.accessToken,
    orderinfo: {
      OrderInfo: {
        Restaurant: {
          details: {
            res_name: cfg.restName,
            address: "",
            contact_information: "",
            restID: cfg.restId,
          },
        },
        Customer: {
          details: {
            email: customer.email || "",
            name: customer.name || "Guest",
            address: addressParts,
            phone: order.phone || "",
            latitude: order.dropLat != null ? String(order.dropLat) : undefined,
            longitude: order.dropLng != null ? String(order.dropLng) : undefined,
          },
        },
        Order: {
          details: {
            orderID: order.externalOrderId || "",
            preorder_date: fmtDate(when),
            preorder_time: fmtTime(when),
            delivery_charges: rupees(charge.deliveryFeePaise),
            packing_charges: "0",
            order_type: petpoojaOrderType(order.fulfillmentType),
            payment_type: "ONLINE",
            total: rupees(charge.totalPaise),
            tax_total: rupees(charge.taxPaise),
            discount_total: rupees(charge.discountPaise),
            urgent_order: order.priority === "urgent" || order.priority === "stat",
            description: order.deliveryInstructions || "",
            created_on: `${fmtDate(now)} ${fmtTime(now)}`,
          },
        },
        OrderItem: {
          // `final_price` uses the same `Math.round(price * qty)` the
          // decomposition uses to build `grossPaise`. Rounding once, the same
          // way, in both places is what makes Σ(final_price) equal the
          // `core_total` the identity above is stated against — rounding the
          // rupee string instead would drift by a paisa on fractional
          // quantities and Petpooja would reject the payload.
          details: items.map((it) => ({
            id: it.id,
            name: it.name,
            price: rupees(it.pricePaise),
            final_price: rupees(Math.round(it.pricePaise * it.qty)),
            quantity: String(it.qty),
          })),
        },
      },
    },
  };
}

export interface PetpoojaPushResult {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  body?: unknown;
  error?: string;
}

interface Logger {
  info?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
}

/**
 * Push an order to Petpooja's Save Order API. Never throws — the caller (the
 * payment-verify path) must not fail the customer's checkout if the POS is
 * unreachable; ops reconciles from logs. No-op when unconfigured.
 */
export async function pushOrderToPetpooja(
  order: OrderRow,
  customer: { name?: string | null; email?: string | null },
  log?: Logger,
): Promise<PetpoojaPushResult> {
  const cfg = petpoojaConfig();
  if (!cfg) {
    log?.info?.({ orderId: order.externalOrderId }, "petpooja outbound skipped — not configured");
    return { ok: false, skipped: true };
  }
  try {
    // Recomputed rather than threaded out of the serializer: `decomposeOrderCharge`
    // is pure, so calling it twice cannot disagree with itself, and keeping the
    // serializer's signature free of an out-parameter keeps it testable as a
    // plain function of its inputs.
    //
    // This warns on a row whose stored `charge_paise` does not match what
    // `computeChargePaise` produces from its own line items. The payload is still
    // correct — it asserts the authoritative total and zero components — but the
    // row itself is worth a human look, because it means either the order predates
    // the charge column, or its pricing was edited after capture, or the fee rules
    // changed underneath it. Silence here is how we would find out from the outlet
    // instead of from our logs.
    const breakdown = decomposeOrderCharge(order);
    if (!breakdown.reconciled) {
      log?.warn?.(
        {
          orderId: order.externalOrderId,
          totalPaise: order.totalPaise,
          chargePaise: order.chargePaise,
          sentTotalPaise: breakdown.totalPaise,
        },
        "petpooja outbound charge not reconciled — sending total with zero components",
      );
    }
    const payload = serializeOrderToPetpooja(order, cfg, customer, new Date());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(cfg.saveOrderUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    const ok = res.ok && (parsed as any)?.success !== "0";
    if (ok) {
      log?.info?.({ orderId: order.externalOrderId, status: res.status }, "petpooja order pushed");
    } else {
      log?.error?.(
        { orderId: order.externalOrderId, status: res.status, body: parsed },
        "petpooja order push rejected",
      );
    }
    return { ok, status: res.status, body: parsed };
  } catch (err) {
    log?.error?.({ orderId: order.externalOrderId, err }, "petpooja order push failed");
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * In-instance store delivery status (Petpooja polls get_store_status and pushes
 * update_store_status). NOTE: this is per-instance and not shared across Cloud
 * Run replicas — a `store_status` DB table is the follow-up for durable,
 * multi-instance state. Still an improvement over the previous hardcoded stub.
 */
let storeStatus: { status: "1" | "0"; turnOnTime: string | null; reason: string | null } = {
  status: "1",
  turnOnTime: null,
  reason: null,
};
export function getStoreStatus() {
  return storeStatus;
}
export function setStoreStatus(status: "1" | "0", turnOnTime: string | null, reason: string | null) {
  storeStatus = { status, turnOnTime, reason };
  return storeStatus;
}
