/**
 * The funnel beacon's wire contract with the api-server sink.
 *
 * The sink (api-server routes/events.ts) validates with zod: `name` matching
 * /^[a-z0-9_]{2,64}$/, optional `props`/`path`/`ts` — and answers 204 to
 * EVERYTHING by design, so a payload it doesn't recognise is not an error
 * anyone sees; it is a row that silently never lands. That is exactly how the
 * first weeks of production funnel data were lost twice over: the beacon env
 * was never set in the deploy, and the payload said `event` where the sink
 * expects `name`. These tests pin the payload half of that contract.
 *
 * Run: node --test --import tsx ./lib/funnel.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { emitFunnel, funnelErrorCode } from "./funnel";

/** The sink's name rule, restated from api-server routes/events.ts. */
const SINK_NAME_RE = /^[a-z0-9_]{2,64}$/;

function withBeacon(body: (sent: string[]) => void): void {
  const g = globalThis as Record<string, unknown>;
  const prevWindow = g.window;
  // Node 22 defines globalThis.navigator as a getter-only accessor, so a
  // plain assignment throws — swap it via defineProperty and restore after.
  const prevNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const prevEnv = process.env.NEXT_PUBLIC_ANALYTICS_BEACON;
  const sent: string[] = [];
  g.window = { location: { pathname: "/checkout" } };
  Object.defineProperty(globalThis, "navigator", {
    value: { sendBeacon: (_url: string, payload: string) => (sent.push(payload), true) },
    configurable: true,
  });
  process.env.NEXT_PUBLIC_ANALYTICS_BEACON = "/api/events";
  try {
    body(sent);
  } finally {
    g.window = prevWindow;
    if (prevNavigator) Object.defineProperty(globalThis, "navigator", prevNavigator);
    if (prevEnv === undefined) delete process.env.NEXT_PUBLIC_ANALYTICS_BEACON;
    else process.env.NEXT_PUBLIC_ANALYTICS_BEACON = prevEnv;
  }
}

test("the beacon payload speaks the sink's schema: name, not event", () => {
  withBeacon((sent) => {
    emitFunnel("payment_opened", { method: "razorpay", total_paise: 39900 });
    assert.equal(sent.length, 1);
    const p = JSON.parse(sent[0]!);
    assert.equal(p.name, "payment_opened");
    assert.equal(p.event, undefined, "the sink's zod schema has no `event` key — it must not come back");
    assert.deepEqual(p.props, { method: "razorpay", total_paise: 39900 });
    assert.equal(p.path, "/checkout");
    assert.equal(typeof p.ts, "number");
    assert.match(p.name, SINK_NAME_RE);
  });
});

test("every emitted name satisfies the sink's name rule", () => {
  // FunnelEvent is a type, so the closed set can't be enumerated at runtime —
  // pin the property on the wire instead for a representative spread,
  // including the longest and most punctuated names in the vocabulary.
  withBeacon((sent) => {
    for (const name of [
      "cuj_router_answer",
      "begin_checkout",
      "payment_failed",
      "subscription_rescheduled",
      "order_claim_offered",
    ] as const) {
      emitFunnel(name);
    }
    for (const raw of sent) assert.match(JSON.parse(raw).name, SINK_NAME_RE);
  });
});

test("emitFunnel never throws without a beacon or a window", () => {
  // Server-side render path: no window at all.
  emitFunnel("view_dish");
  // Client with no sink configured: silently drops (dev logs only).
  const g = globalThis as Record<string, unknown>;
  const prevWindow = g.window;
  g.window = { location: { pathname: "/" } };
  const prevEnv = process.env.NEXT_PUBLIC_ANALYTICS_BEACON;
  delete process.env.NEXT_PUBLIC_ANALYTICS_BEACON;
  try {
    emitFunnel("view_dish");
  } finally {
    g.window = prevWindow;
    if (prevEnv !== undefined) process.env.NEXT_PUBLIC_ANALYTICS_BEACON = prevEnv;
  }
});

test("funnelErrorCode prefers the server's machine code", () => {
  assert.equal(funnelErrorCode({ code: "macro_cap_exceeded" }), "macro_cap_exceeded");
  assert.equal(funnelErrorCode(new Error("boom")), "unknown");
  assert.equal(funnelErrorCode(undefined), "unknown");
});
