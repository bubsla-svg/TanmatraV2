import { createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { PetpoojaSaveOrderPayload } from "./petpooja";

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
  totalPaise: number;
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

/** Build the Petpooja Save Order payload from one of our order rows. */
export function serializeOrderToPetpooja(
  order: OrderRow,
  cfg: PetpoojaConfig,
  customer: { name?: string | null; email?: string | null },
  now: Date,
): PetpoojaSaveOrderPayload {
  const items = (Array.isArray(order.items) ? order.items : []) as Array<{
    id: number | string;
    name: string;
    qty?: number;
    quantity?: number;
    price: number;
  }>;
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
            delivery_charges: "0",
            packing_charges: "0",
            order_type: petpoojaOrderType(order.fulfillmentType),
            payment_type: "ONLINE",
            total: (order.totalPaise / 100).toFixed(2),
            tax_total: "0",
            discount_total: "0",
            urgent_order: order.priority === "urgent" || order.priority === "stat",
            description: order.deliveryInstructions || "",
            created_on: `${fmtDate(now)} ${fmtTime(now)}`,
          },
        },
        OrderItem: {
          details: items.map((it) => {
            const qty = Number(it.qty ?? it.quantity ?? 1);
            const priceRupees = (Number(it.price ?? 0) / 100).toFixed(2);
            return {
              id: String(it.id),
              name: it.name,
              price: priceRupees,
              final_price: (Number(it.price ?? 0) / 100 * qty).toFixed(2),
              quantity: String(qty),
            };
          }),
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
