/**
 * What the limiter does when the LIMITER ITSELF cannot run.
 *
 * The store is Postgres. When it is unreachable, timing out, or the pool is
 * exhausted, the check throws — and the middleware then has to choose between
 * admitting the request (fail open) and refusing it (fail closed). Public
 * reads take the first branch and money routes take the second; see
 * RateLimitOptions.failClosed for why.
 *
 * The failure is induced honestly rather than mocked: this file points
 * DATABASE_URL at a closed port BEFORE anything imports the db module, so the
 * real drizzle call raises the real connection error and the real catch block
 * runs. A mocked `rateLimit` would prove only that the branch exists.
 *
 * That also means this file must run in its own process — it deliberately
 * breaks the shared db handle. It is listed on its own in verify.yml.
 *
 * Run with:
 *   node --test --import tsx ./src/middlewares/rateLimitMiddleware.failClosed.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { type AddressInfo } from "node:net";
import http from "node:http";

// Port 1 is privileged and unbound: connections are refused immediately
// rather than hanging, so the failure path resolves fast and deterministically.
process.env["DATABASE_URL"] = "postgres://nobody:nobody@127.0.0.1:1/nonexistent";

const express = (await import("express")).default;
const { rateLimitMiddleware } = await import("./rateLimitMiddleware");

let server: http.Server;
let baseUrl = "";

before(async () => {
  const app = express();
  app.set("trust proxy", true);

  // Two limiters over the same broken store, differing only in failClosed.
  app.use("/open", rateLimitMiddleware("test:failopen", 5, 60_000));
  app.get("/open", (_req, res) => {
    res.status(200).json({ reached: true });
  });

  app.use("/closed", rateLimitMiddleware("test:failclosed", 5, 60_000, {
    failClosed: true,
    code: "TEST_FAIL_CLOSED",
  }));
  app.get("/closed", (_req, res) => {
    res.status(200).json({ reached: true });
  });

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("store unreachable + fail-open: the request is admitted", async () => {
  const res = await fetch(`${baseUrl}/open`);
  assert.equal(res.status, 200, "public reads must survive a limiter outage");
  assert.deepEqual(await res.json(), { reached: true });
});

test("store unreachable + fail-closed: 429, and the handler never runs", async () => {
  const res = await fetch(`${baseUrl}/closed`);
  assert.equal(res.status, 429, "money routes must not admit unmetered traffic");

  const body = (await res.json()) as { error: string; code: string; retryAfterSeconds: number };
  // The typed code must survive the failure path — a client distinguishing
  // "you are over budget" from "we cannot tell" reads this field, and the
  // refusal is useless if it degrades to the generic code.
  assert.equal(body.code, "TEST_FAIL_CLOSED");
  assert.equal(body.error, "rate_limited");

  // Retry-After is what makes a shed request retryable instead of a dead end,
  // and it is the whole reason 429 beats the 500 the handler was heading for.
  assert.equal(res.headers.get("retry-after"), "60");
  assert.equal(body.retryAfterSeconds, 60);
});

test("fail-closed refuses BEFORE the handler, so nothing is half-done", async () => {
  // The 429 above carried no `reached` field, which is the observable proof:
  // the handler that would have set it never ran. Re-assert explicitly so a
  // future refactor that moves the check after the handler fails here.
  const res = await fetch(`${baseUrl}/closed`);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body["reached"], undefined);
});
