// Run: cd artifacts/api-server && DATABASE_URL=postgres://x node --test --import tsx ./src/lib/eventForwarders.test.ts
// (DB-free: the module never touches the database; the URL only satisfies
// the workspace's module-load guard.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGa4Payload, buildMetaPayload, forwardFunnelEvent, type FunnelEventRow } from "./eventForwarders";

const purchase: FunnelEventRow = {
  name: "purchase",
  props: { order_id: "TAN-1", amount_paise: 65700, method: "upi", src: "gym12", source: "server" },
  sessionId: "fs_abc",
  userId: "u1",
  path: "server",
};

function fakeFetch(calls: Array<{ url: string; body: unknown }>, ok = true): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return { ok, status: ok ? 204 : 400 } as Response;
  }) as typeof fetch;
}

test("nothing is forwarded when no destination is configured", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const r = await forwardFunnelEvent(purchase, {}, { env: {}, fetchImpl: fakeFetch(calls) });
  assert.deepEqual(r, { ga4: false, meta: false });
  assert.equal(calls.length, 0);
});

test("GA4: purchase carries transaction_id, value in rupees, INR, and a stable client_id from the session", () => {
  const p = buildGa4Payload(purchase) as { client_id: string; user_id?: string; events: Array<{ name: string; params: Record<string, unknown> }> };
  assert.equal(p.events[0]!.name, "purchase");
  assert.equal(p.events[0]!.params.transaction_id, "TAN-1");
  assert.equal(p.events[0]!.params.value, 657);
  assert.equal(p.events[0]!.params.currency, "INR");
  assert.equal(p.events[0]!.params.src, "gym12");
  assert.equal(p.user_id, "u1");
  assert.equal(p.client_id, (buildGa4Payload(purchase) as { client_id: string }).client_id, "same session → same client_id");
  assert.equal("amount_paise" in p.events[0]!.params, false, "paise never leaks as a second amount");
});

test("GA4: our names map onto GA4's recommended events; unmapped names pass through", () => {
  const name = (n: string) => (buildGa4Payload({ ...purchase, name: n }) as { events: Array<{ name: string }> }).events[0]!.name;
  assert.equal(name("begin_checkout"), "begin_checkout");
  assert.equal(name("payment_opened"), "add_payment_info");
  assert.equal(name("view_dish"), "view_item");
  assert.equal(name("qr_landing_view"), "qr_landing_view");
});

test("Meta: purchase is a Purchase with the order id as event_id (dedupes against a browser copy)", () => {
  const p = buildMetaPayload(purchase, { clientIp: "1.2.3.4", userAgent: "UA" }, {}, 1_700_000_000_000) as {
    data: Array<Record<string, unknown>>;
  };
  const ev = p.data[0]!;
  assert.equal(ev.event_name, "Purchase");
  assert.equal(ev.event_id, "purchase:TAN-1");
  assert.equal(ev.action_source, "system_generated");
  assert.deepEqual(ev.custom_data, { value: 657, currency: "INR", order_id: "TAN-1" });
  const ud = ev.user_data as Record<string, unknown>;
  assert.equal(ud.client_ip_address, "1.2.3.4");
  assert.equal(typeof ud.external_id, "string", "user id is hashed, never raw");
  assert.notEqual(ud.external_id, "u1");
});

test("Meta: a browser beacon is a website event at its path; an unmapped or match-less event is skipped", () => {
  const add = buildMetaPayload(
    { name: "add_to_cart", props: { dish_id: "a", price_paise: 19900 }, sessionId: "s1", userId: null, path: "/menu" },
    { clientIp: "1.2.3.4", userAgent: "UA" },
    {},
    60_000,
  ) as { data: Array<Record<string, unknown>> };
  assert.equal(add.data[0]!.event_name, "AddToCart");
  assert.equal(add.data[0]!.action_source, "website");
  assert.equal(add.data[0]!.event_source_url, "/menu");
  assert.equal(add.data[0]!.event_id, "add_to_cart:s1:1");
  assert.equal(buildMetaPayload({ ...purchase, name: "qr_landing_view" }, { clientIp: "1.2.3.4" }, {}, 0), null);
  assert.equal(buildMetaPayload({ ...purchase, userId: null }, {}, {}, 0), null, "no user_data → not sent");
});

test("both destinations are posted when configured, and a vendor rejection never throws", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const env = { GA4_MEASUREMENT_ID: "G-1", GA4_API_SECRET: "sec", META_PIXEL_ID: "px", META_CAPI_ACCESS_TOKEN: "tok" };
  const r = await forwardFunnelEvent(purchase, { clientIp: "1.2.3.4" }, { env, fetchImpl: fakeFetch(calls) });
  assert.deepEqual(r, { ga4: true, meta: true });
  assert.equal(calls.length, 2);
  assert.match(calls[0]!.url, /google-analytics\.com\/mp\/collect\?measurement_id=G-1&api_secret=sec/);
  assert.match(calls[1]!.url, /graph\.facebook\.com\/v21\.0\/px\/events/);
  const rejected = await forwardFunnelEvent(purchase, { clientIp: "1.2.3.4" }, { env, fetchImpl: fakeFetch([], false) });
  assert.deepEqual(rejected, { ga4: false, meta: false });
  const thrown = await forwardFunnelEvent(purchase, {}, {
    env,
    fetchImpl: (async () => { throw new Error("network"); }) as typeof fetch,
  });
  assert.deepEqual(thrown, { ga4: false, meta: false });
});
