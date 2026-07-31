/**
 * OA-MED-1.5 / 1.7 / 1.9 — the AI cost-and-reliability hardening batch.
 *
 * DB-free except the rate-limit scope test, which needs the Postgres-backed
 * limiter (same as rateLimitMiddleware.webhookExemption.test.ts).
 *
 * Run with:
 *   DATABASE_URL=... node --test --import tsx ./src/lib/ai/aiHardening.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { type AddressInfo } from "node:net";
import http from "node:http";
import express, { type Express } from "express";

import { retryDelayMs } from "./gateway";
import { ChatTurnSchema, ChatHistorySchema, MAX_CHAT_TURN_CHARS } from "./chatSchema";
import { aiRateLimit, aiStaffRateLimit } from "../../middlewares/rateLimitMiddleware";

// ── OA-MED-1.5: gateway retry backoff + jitter ────────────────────────────

test("retryDelayMs: ceiling doubles per attempt (exponential), capped at 8s", () => {
  // rand() === 1 yields the full ceiling, which is what the cap applies to.
  const ceilingAt = (attempt: number) => retryDelayMs(attempt, () => 1);
  assert.equal(ceilingAt(1), 500);
  assert.equal(ceilingAt(2), 1000);
  assert.equal(ceilingAt(3), 2000);
  assert.equal(ceilingAt(4), 4000);
  assert.equal(ceilingAt(5), 8000);
  // Capped from here on — without the cap attempt 6 would be 16000.
  assert.equal(ceilingAt(6), 8000);
  assert.equal(ceilingAt(20), 8000);
});

test("retryDelayMs: full jitter spans [0, ceiling], so retries don't re-synchronise", () => {
  // The whole point of jitter is that two callers failing at the same instant
  // do NOT wake at the same instant. Pinning rand() proves the delay actually
  // varies with it rather than being a fixed backoff with a decorative name.
  assert.equal(retryDelayMs(3, () => 0), 0);
  assert.equal(retryDelayMs(3, () => 0.5), 1000);
  assert.equal(retryDelayMs(3, () => 1), 2000);

  // And with real randomness: distinct draws, all inside the ceiling.
  const draws = Array.from({ length: 200 }, () => retryDelayMs(4));
  assert.ok(
    draws.every((d) => d >= 0 && d <= 4000),
    "every jittered delay must fall inside [0, ceiling]",
  );
  assert.ok(
    new Set(draws).size > 1,
    "jitter must actually vary — a constant delay is the bug this fixes",
  );
});

// ── OA-MED-1.7: chat history turn caps ────────────────────────────────────

test("ChatTurnSchema caps turn text at 8000 chars", () => {
  const atLimit = ChatTurnSchema.safeParse({ role: "user", text: "x".repeat(MAX_CHAT_TURN_CHARS) });
  assert.equal(atLimit.success, true, "a turn exactly at the cap must be accepted");

  const overLimit = ChatTurnSchema.safeParse({
    role: "user",
    text: "x".repeat(MAX_CHAT_TURN_CHARS + 1),
  });
  assert.equal(overLimit.success, false, "one char over the cap must be rejected");
});

test("ChatHistorySchema rejects an oversized turn anywhere in the array", () => {
  // The billing lever was a LONG turn, not just many turns — a 50-turn history
  // that passes the length check but carries one 10 MB turn is the case the
  // old schema let through.
  const withOneHugeTurn = ChatHistorySchema.safeParse([
    { role: "user", text: "hello" },
    { role: "agent", text: "x".repeat(MAX_CHAT_TURN_CHARS + 1) },
  ]);
  assert.equal(withOneHugeTurn.success, false);
});

test("ChatHistorySchema still caps the turn COUNT at 50", () => {
  const turn = { role: "user" as const, text: "hi" };
  assert.equal(ChatHistorySchema.safeParse(Array(50).fill(turn)).success, true);
  assert.equal(ChatHistorySchema.safeParse(Array(51).fill(turn)).success, false);
});

// ── OA-MED-1.9: staff vs customer rate-limit bucket isolation ─────────────

let server: http.Server;
let baseUrl = "";

function makeApp(): Express {
  const app = express();
  app.set("trust proxy", true);
  app.use("/api/ops-agent", aiStaffRateLimit);
  app.use("/api/coach-agent", aiRateLimit);
  app.get("/api/ops-agent/chat", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/api/coach-agent/chat", (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

async function hit(path: string, fakeIp: string): Promise<number> {
  const res = await fetch(`${baseUrl}${path}`, { headers: { "x-forwarded-for": fakeIp } });
  return res.status;
}

// Own fake source IP per test so the shared Postgres-backed counter can never
// collide across tests or runs.
function randomFakeIp(): string {
  return `198.51.100.${1 + Math.floor(Math.random() * 254)}`;
}

before(async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("exhausting the staff bucket does NOT lock the same IP out of the customer agent", async () => {
  // This is the whole finding: staff arrive from a handful of office/VPN
  // egress IPs, so before the split, a few operators could burn the shared
  // 20/min for every customer behind that same apparent IP.
  const fakeIp = randomFakeIp();

  const staffStatuses: number[] = [];
  for (let i = 0; i < 22; i++) staffStatuses.push(await hit("/api/ops-agent/chat", fakeIp));
  assert.equal(
    staffStatuses.filter((s) => s === 429).length,
    2,
    `staff bucket should throttle after 20, got: ${staffStatuses.join(",")}`,
  );

  // Same IP, customer route — must still be fully served.
  const customerStatus = await hit("/api/coach-agent/chat", fakeIp);
  assert.equal(
    customerStatus,
    200,
    "customer agent must be unaffected by a saturated staff bucket",
  );
});

test("each bucket still enforces its own 20/min limit", async () => {
  const fakeIp = randomFakeIp();
  const statuses: number[] = [];
  for (let i = 0; i < 22; i++) statuses.push(await hit("/api/coach-agent/chat", fakeIp));
  assert.equal(statuses.filter((s) => s === 200).length, 20);
  assert.equal(statuses.filter((s) => s === 429).length, 2);
});
