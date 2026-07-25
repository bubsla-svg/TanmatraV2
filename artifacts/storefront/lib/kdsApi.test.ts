/**
 * Kitchen board — the wire contract, against an injected fetch (no network).
 *
 * The assertions worth reading twice are the ones that refuse to report an
 * empty board. On this screen "nothing to cook" is an instruction, and the
 * client must only ever give it when the server actually said so.
 *
 * Run: node --test --import tsx ../storefront/lib/kdsApi.test.ts  (from api-server)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { fetchBoard, markReady } from "./kdsApi";

const NOW = Date.parse("2026-07-25T09:00:00.000Z");

interface Call {
  method: string;
  url: string;
  credentials?: string;
  cache?: string;
}

interface Reply {
  status: number;
  body?: unknown;
  /** Raw text overrides `body` — used to feed the parser something invalid. */
  text?: string;
  dateHeader?: string;
}

function fakeFetch(calls: Call[], reply: Reply | (() => never)): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown> = {}) => {
    calls.push({
      method: String(init.method ?? "GET"),
      url: String(url),
      credentials: init.credentials as string | undefined,
      cache: init.cache as string | undefined,
    });
    if (typeof reply === "function") {
      reply();
      // Unreachable — `reply` always throws. Present so the union narrows on
      // the line below (a call returning `never` doesn't narrow a parameter).
      throw new Error("unreachable");
    }
    const { status, body, text, dateHeader } = reply;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (h: string) => (h.toLowerCase() === "date" ? (dateHeader ?? null) : null) },
      json: async () => {
        if (text !== undefined) return JSON.parse(text) as unknown;
        return body;
      },
    };
  }) as unknown as typeof fetch;
}

const ROW = {
  id: 11,
  externalOrderId: "alc-11",
  status: "placed",
  items: [{ id: 1, name: "Millet Khichdi", qty: 2, price: 30_000 }],
  createdAt: "2026-07-25T08:52:00.000Z",
};

// --- the board -------------------------------------------------------------

test("fetchBoard: GET /api/ops/kds/orders, cookie-authed, never cached", async () => {
  const calls: Call[] = [];
  const r = await fetchBoard(NOW, fakeFetch(calls, { status: 200, body: { orders: [ROW] } }));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "GET");
  assert.match(c.url, /\/api\/ops\/kds\/orders$/);
  // The ops scope is granted by the signed admin cookie — no shared secret
  // ever reaches client JS.
  assert.equal(c.credentials, "include");
  assert.equal(c.cache, "no-store");
  assert.equal(r.kind, "ok");
  if (r.kind !== "ok") return;
  assert.equal(r.tickets.length, 1);
  assert.equal(r.tickets[0]?.externalOrderId, "alc-11");
  assert.equal(r.dropped, 0);
});

test("an expired admin session is `forbidden`, not `unavailable`", async () => {
  // Different word, different fix. Retrying a 403 forever leaves a kitchen
  // watching a spinner because a seven-day cookie lapsed on a Tuesday.
  for (const status of [401, 403]) {
    const r = await fetchBoard(NOW, fakeFetch([], { status, body: { error: "ops scope required" } }));
    assert.equal(r.kind, "forbidden", `status ${status}`);
  }
});

test("a server error or a dead network is `unavailable`", async () => {
  assert.equal((await fetchBoard(NOW, fakeFetch([], { status: 500 }))).kind, "unavailable");
  assert.equal((await fetchBoard(NOW, fakeFetch([], { status: 502 }))).kind, "unavailable");
  const boom = fakeFetch([], (() => {
    throw new TypeError("Failed to fetch");
  }) as () => never);
  assert.equal((await fetchBoard(NOW, boom)).kind, "unavailable");
});

test("a response that isn't JSON is unavailable, not an empty board", async () => {
  const r = await fetchBoard(NOW, fakeFetch([], { status: 200, text: "<html>502</html>" }));
  assert.equal(r.kind, "unavailable");
});

test("`orders` that is not an array is unavailable, not an empty board", async () => {
  // THE assertion. A proxy, a rewritten error envelope, or a contract change
  // must never be reported to a kitchen as "nothing to cook".
  for (const body of [{}, { orders: null }, { orders: "none" }, { orders: { 0: ROW } }, []]) {
    const r = await fetchBoard(NOW, fakeFetch([], { status: 200, body }));
    assert.equal(r.kind, "unavailable", `body ${JSON.stringify(body)}`);
  }
});

test("a genuinely empty board is ok and empty", async () => {
  // The other half of the same rule: when the server really does say zero,
  // the board must say zero rather than crying outage.
  const r = await fetchBoard(NOW, fakeFetch([], { status: 200, body: { orders: [] } }));
  assert.equal(r.kind, "ok");
  if (r.kind !== "ok") return;
  assert.deepEqual(r.tickets, []);
  assert.equal(r.dropped, 0);
});

test("unreadable rows cost one ticket each and are counted, not hidden", async () => {
  const r = await fetchBoard(
    NOW,
    fakeFetch([], { status: 200, body: { orders: [ROW, { id: "x" }, null, { ...ROW, id: 12 }] } }),
  );
  assert.equal(r.kind, "ok");
  if (r.kind !== "ok") return;
  assert.deepEqual(r.tickets.map((t) => t.id), [11, 12]);
  assert.equal(r.dropped, 2, "the board tells the cook two rows were unreadable");
});

test("the Date header sets the clock offset when the API exposes it", async () => {
  const header = new Date(NOW + 90_000).toUTCString();
  const r = await fetchBoard(NOW, fakeFetch([], { status: 200, body: { orders: [] }, dateHeader: header }));
  assert.equal(r.kind, "ok");
  if (r.kind !== "ok") return;
  assert.equal(r.serverOffsetMs, 90_000);
});

test("no Date header (the cross-origin default) means no correction", async () => {
  const r = await fetchBoard(NOW, fakeFetch([], { status: 200, body: { orders: [] } }));
  assert.equal(r.kind, "ok");
  if (r.kind !== "ok") return;
  assert.equal(r.serverOffsetMs, 0);
});

// --- mark ready ------------------------------------------------------------

test("markReady: POST /api/ops/kds/orders/:id/ready", async () => {
  const calls: Call[] = [];
  const r = await markReady(11, fakeFetch(calls, { status: 200, body: { ok: true } }));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "POST");
  assert.match(c.url, /\/api\/ops\/kds\/orders\/11\/ready$/);
  assert.equal(c.credentials, "include");
  assert.equal(r.kind, "ok");
});

test("404 is `not_on_board` — the case the endpoint used to lie about", async () => {
  // Before the order-channel work this endpoint answered {ok:true} whatever
  // happened, so a second tap, or a tap on a stale board, reported success and
  // changed nothing. The server now says which; this is where the cook hears it.
  const r = await markReady(11, fakeFetch([], {
    status: 404,
    body: { ok: false, error: "no such order on this board", code: "order_not_on_board" },
  }));
  assert.equal(r.kind, "not_on_board");
});

test("markReady distinguishes an expired session from an outage", async () => {
  assert.equal((await markReady(11, fakeFetch([], { status: 403 }))).kind, "forbidden");
  assert.equal((await markReady(11, fakeFetch([], { status: 401 }))).kind, "forbidden");
  assert.equal((await markReady(11, fakeFetch([], { status: 500 }))).kind, "unavailable");
  const boom = fakeFetch([], (() => {
    throw new TypeError("Failed to fetch");
  }) as () => never);
  assert.equal((await markReady(11, boom)).kind, "unavailable");
});
