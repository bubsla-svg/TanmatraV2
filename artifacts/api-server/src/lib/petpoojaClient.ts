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
 * Everything here is gated behind PETPOOJA_* env. When unconfigured the
 * integration is inert (outbound is a no-op, inbound auth logs a warning and
 * allows through so dev/test isn't broken). When configured, outbound pushes
 * are made and inbound webhooks are authenticated.
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
export function verifyPetpoojaAuth(
  req: Request,
): { ok: boolean; configured: boolean; presented: boolean } {
  const cfg = petpoojaConfig();
  if (!cfg) return { ok: true, configured: false, presented: false };

  const body = (req.body ?? {}) as Record<string, unknown>;
  const headerSecret =
    (req.get("x-petpooja-app-secret") || req.get("x-petpooja-secret") || "").trim();
  const bodyKey = typeof body.app_key === "string" ? body.app_key : "";
  const bodySecret = typeof body.app_secret === "string" ? body.app_secret : "";

  // Primary: body credentials (order / status / rider webhooks).
  if (bodyKey || bodySecret) {
    return {
      ok: bodyKey === cfg.appKey && bodySecret === cfg.appSecret,
      configured: true,
      presented: true,
    };
  }
  // Fallback: shared-secret header (stock / store-status webhooks configured
  // to send x-petpooja-app-secret).
  if (headerSecret) {
    return { ok: headerSecret === cfg.appSecret, configured: true, presented: true };
  }
  // Configured but the request presented no credentials at all.
  return { ok: false, configured: true, presented: false };
}

/**
 * Express-style guard. `mode: "strict"` (default) rejects when configured and
 * auth fails for any reason. `mode: "lenient"` only rejects when credentials
 * were presented but wrong — used for endpoints Petpooja authenticates by a
 * different mechanism (menu sharing code) so we don't break legitimate calls.
 * Returns true when the request should proceed.
 */
export function petpoojaAuthOk(
  req: Request,
  log: Logger | undefined,
  mode: "strict" | "lenient" = "strict",
): boolean {
  const r = verifyPetpoojaAuth(req);
  if (!r.configured) {
    log?.warn?.({ path: req.path }, "petpooja webhook auth not configured — allowing (set PETPOOJA_APP_SECRET to enforce)");
    return true;
  }
  if (r.ok) return true;
  if (mode === "lenient" && !r.presented) {
    log?.warn?.({ path: req.path }, "petpooja webhook without credentials — allowed (lenient); configure sender to send x-petpooja-app-secret");
    return true;
  }
  log?.warn?.({ path: req.path, presented: r.presented }, "petpooja webhook auth REJECTED");
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
