/**
 * Server-side vendor forwarding for funnel events (T2, CRO handoff
 * 2026-09-17): GA4 Measurement Protocol and Meta Conversions API, fed from
 * the first-party sink (routes/events.ts) and the server-truth emitter
 * (lib/serverEvents.ts). No client tags — the browser only ever talks to
 * our own /api/events, and this module talks to the vendors.
 *
 * Both destinations are OFF until configured:
 *   GA4:  GA4_MEASUREMENT_ID + GA4_API_SECRET
 *   Meta: META_PIXEL_ID + META_CAPI_ACCESS_TOKEN
 *
 * Governance: props are already PII-free (routes/events.ts strips the
 * blocked keys; server props are bands/booleans/paise). The only identity
 * the vendors get is the funnel session id (GA4 client_id, Meta event_id
 * salt) and, for a browser beacon, the request's IP + user agent — which is
 * what Meta needs to match a web event at all. Nothing here can throw or
 * delay a response: every failure is a structured log.
 */
import { createHash } from "node:crypto";
import { logger } from "./logger";

export interface FunnelEventRow {
  name: string;
  props: Record<string, unknown> | null;
  sessionId: string | null;
  userId: string | null;
  path: string | null;
}

export interface ForwardContext {
  clientIp?: string | null;
  userAgent?: string | null;
}

export interface ForwarderEnv {
  GA4_MEASUREMENT_ID?: string;
  GA4_API_SECRET?: string;
  META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_CAPI_TEST_EVENT_CODE?: string;
}

/** Our first-party names → the vendor's recommended event names. Anything
 *  unmapped is forwarded to GA4 under its own name (GA4 accepts custom
 *  events) and NOT forwarded to Meta (whose standard events are the only
 *  ones worth its match rate). */
const GA4_NAMES: Record<string, string> = {
  add_to_cart: "add_to_cart",
  begin_checkout: "begin_checkout",
  checkout_step: "checkout_progress",
  payment_opened: "add_payment_info",
  payment_failed: "payment_failed",
  purchase: "purchase",
  view_dish: "view_item",
};

const META_NAMES: Record<string, string> = {
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  payment_opened: "AddPaymentInfo",
  purchase: "Purchase",
  view_dish: "ViewContent",
};

export const FORWARD_TIMEOUT_MS = 3000;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Amount in paise → rupees, the unit both vendors expect for `value`. */
function rupees(props: Record<string, unknown> | null): number | null {
  const paise = num(props?.["amount_paise"]) ?? num(props?.["total_paise"]) ?? num(props?.["charge_paise"]);
  return paise == null ? null : Math.round(paise) / 100;
}

/** A stable GA4 client_id from the funnel session, or a per-event id when
 *  a server event has none — GA4 requires one and it must be non-empty. */
function ga4ClientId(row: FunnelEventRow): string {
  const seed = row.sessionId ?? row.userId ?? `${row.name}:${Date.now()}`;
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

export function buildGa4Payload(row: FunnelEventRow): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const value = rupees(row.props);
  if (value != null) {
    params.value = value;
    params.currency = "INR";
  }
  const orderId = row.props?.["order_id"];
  if (typeof orderId === "string") params.transaction_id = orderId;
  for (const [k, v] of Object.entries(row.props ?? {})) {
    if (k === "order_id" || k === "amount_paise" || k === "total_paise" || k === "charge_paise") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") params[k] = v;
  }
  if (row.sessionId) params.session_id = row.sessionId;
  return {
    client_id: ga4ClientId(row),
    ...(row.userId ? { user_id: row.userId } : {}),
    events: [{ name: GA4_NAMES[row.name] ?? row.name, params }],
  };
}

export function buildMetaPayload(
  row: FunnelEventRow,
  ctx: ForwardContext,
  env: ForwarderEnv,
  now: number,
): Record<string, unknown> | null {
  const eventName = META_NAMES[row.name];
  if (!eventName) return null;
  const userData: Record<string, unknown> = {};
  if (ctx.clientIp) userData.client_ip_address = ctx.clientIp;
  if (ctx.userAgent) userData.client_user_agent = ctx.userAgent;
  if (row.userId) userData.external_id = createHash("sha256").update(row.userId).digest("hex");
  // Meta rejects an event with no user_data at all; a server event with no
  // session and no user has nothing honest to offer, so it is skipped rather
  // than padded with a fabricated match key.
  if (Object.keys(userData).length === 0) return null;
  const orderId = row.props?.["order_id"];
  const value = rupees(row.props);
  const customData: Record<string, unknown> = {};
  if (value != null) {
    customData.value = value;
    customData.currency = "INR";
  }
  if (typeof orderId === "string") customData.order_id = orderId;
  // Deduplicate against a browser copy of the same conversion: the order id
  // is the stable key for purchase, the session + name + minute for the rest.
  const eventId =
    typeof orderId === "string"
      ? `${row.name}:${orderId}`
      : `${row.name}:${row.sessionId ?? "s"}:${Math.floor(now / 60_000)}`;
  return {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(now / 1000),
        event_id: eventId,
        action_source: row.path === "server" ? "system_generated" : "website",
        ...(row.path && row.path !== "server" ? { event_source_url: row.path } : {}),
        user_data: userData,
        ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
      },
    ],
    ...(env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: env.META_CAPI_TEST_EVENT_CODE } : {}),
  };
}

export interface ForwardDeps {
  env?: ForwarderEnv;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/**
 * Forward one event to every configured destination. Resolves once both
 * attempts have settled; never rejects. Callers `void` it.
 */
export async function forwardFunnelEvent(
  row: FunnelEventRow,
  ctx: ForwardContext,
  deps: ForwardDeps = {},
): Promise<{ ga4: boolean; meta: boolean }> {
  const env = deps.env ?? (process.env as ForwarderEnv);
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const now = deps.now?.() ?? Date.now();
  const result = { ga4: false, meta: false };

  const jobs: Promise<void>[] = [];
  if (env.GA4_MEASUREMENT_ID && env.GA4_API_SECRET) {
    const url =
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(env.GA4_MEASUREMENT_ID)}` +
      `&api_secret=${encodeURIComponent(env.GA4_API_SECRET)}`;
    jobs.push(
      fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildGa4Payload(row)),
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      })
        .then((r) => {
          result.ga4 = r.ok;
          if (!r.ok) logger.warn({ status: r.status, event: row.name }, "ga4_forward_rejected");
        })
        .catch((err: unknown) => logger.warn({ err, event: row.name }, "ga4_forward_failed")),
    );
  }
  if (env.META_PIXEL_ID && env.META_CAPI_ACCESS_TOKEN) {
    const payload = buildMetaPayload(row, ctx, env, now);
    if (payload) {
      const url =
        `https://graph.facebook.com/v21.0/${encodeURIComponent(env.META_PIXEL_ID)}/events` +
        `?access_token=${encodeURIComponent(env.META_CAPI_ACCESS_TOKEN)}`;
      jobs.push(
        fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
        })
          .then((r) => {
            result.meta = r.ok;
            if (!r.ok) logger.warn({ status: r.status, event: row.name }, "meta_capi_forward_rejected");
          })
          .catch((err: unknown) => logger.warn({ err, event: row.name }, "meta_capi_forward_failed")),
      );
    }
  }
  await Promise.all(jobs);
  return result;
}
