import assert from "node:assert/strict";
import { test } from "node:test";
import { GENERIC_LANDING } from "./qrPlacement";
import { resolveScan } from "./qrScanApi";

function jsonFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

test("resolveScan posts the code, ref and session id to the scan endpoint", async () => {
  let seen: { url: string; body: unknown } | null = null;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen = { url, body: JSON.parse(String(init.body)) };
    return new Response(JSON.stringify({ src: "box", known: true, destination: "/start" }));
  }) as unknown as typeof fetch;

  await resolveScan({ code: "BOX", ref: "A1B2C3D4", sessionId: "abc123ef" }, "https://api.test", fetchImpl);

  assert.deepEqual(seen, {
    url: "https://api.test/api/qr/scan",
    body: { code: "BOX", ref: "A1B2C3D4", sessionId: "abc123ef" },
  });
});

test("resolveScan omits absent optional fields rather than sending nulls", async () => {
  let body: unknown = null;
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ src: "box", known: true, destination: "/start" }));
  }) as unknown as typeof fetch;

  await resolveScan({ code: "box" }, "https://api.test", fetchImpl);
  assert.deepEqual(body, { code: "box" });
});

test("resolveScan returns the server's resolution", async () => {
  const r = await resolveScan(
    { code: "gym12" },
    "https://api.test",
    jsonFetch({ src: "gym12", known: true, destination: "/start?goal=protein" }),
  );
  assert.deepEqual(r, { src: "gym12", known: true, destination: "/start?goal=protein" });
});

test("resolveScan lands on the generic page when the api rejects the request", async () => {
  // Never an error page: the person is standing in front of a poster.
  const r = await resolveScan({ code: "BOX" }, "https://api.test", jsonFetch({}, false, 500));
  assert.deepEqual(r, { src: "box", known: false, destination: GENERIC_LANDING });
});

test("resolveScan lands on the generic page when the api is unreachable", async () => {
  const fetchImpl = (async () => {
    throw new Error("ECONNREFUSED");
  }) as unknown as typeof fetch;
  const r = await resolveScan({ code: "GYM12" }, "https://api.test", fetchImpl);
  assert.deepEqual(r, { src: "gym12", known: false, destination: GENERIC_LANDING });
});

test("resolveScan survives a malformed body without throwing", async () => {
  const fetchImpl = (async () => new Response("<html>502</html>")) as unknown as typeof fetch;
  const r = await resolveScan({ code: "box" }, "https://api.test", fetchImpl);
  assert.deepEqual(r, { src: "box", known: false, destination: GENERIC_LANDING });
});

test("resolveScan never returns an empty destination", async () => {
  // A blank string would redirect to the current URL and loop the scan.
  const r = await resolveScan(
    { code: "box" },
    "https://api.test",
    jsonFetch({ src: "box", known: true, destination: "" }),
  );
  assert.equal(r.destination, GENERIC_LANDING);
});

test("resolveScan normalizes the fallback src so an unresolved scan still groups", async () => {
  const r = await resolveScan({ code: "  BOX " }, "https://api.test", jsonFetch({}, false, 503));
  assert.equal(r.src, "box");
  const junk = await resolveScan({ code: "../etc" }, "https://api.test", jsonFetch({}, false, 503));
  assert.equal(junk.src, null);
});
