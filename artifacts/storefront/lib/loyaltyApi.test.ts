/**
 * Loyalty-progress client's wire contract (injected fetch, no network).
 * Run: node --test --import tsx ./lib/loyaltyApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import { getLoyaltyProgress } from "./loyaltyApi";

interface Call { method: string; url: string; credentials?: string }

function fakeFetch(calls: Call[], respond: () => { status: number; body: unknown }): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown>) => {
    calls.push({ method: String(init.method), url: String(url), credentials: init.credentials as string | undefined });
    const { status, body } = respond();
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      text: async () => (body === undefined ? "" : JSON.stringify(body)),
    };
  }) as unknown as typeof fetch;
}

test("getLoyaltyProgress: GET /api/loyalty/progress, cookie-authed", async () => {
  const calls: Call[] = [];
  const res = await getLoyaltyProgress(
    fakeFetch(calls, () => ({
      status: 200,
      body: {
        progress: [
          {
            subscriptionId: 7,
            deliveredCount: 8,
            freeEveryN: 4,
            deliveriesUntilFree: 4,
            premiumUnlockAt: 8,
            deliveriesUntilPremium: 0,
            premiumUnlocked: true,
          },
        ],
      },
    })),
  );
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "GET");
  assert.match(c.url, /\/api\/loyalty\/progress$/);
  assert.equal(c.credentials, "include");
  assert.equal(res.progress[0]?.premiumUnlocked, true);
  assert.equal(res.progress[0]?.deliveredCount, 8);
  assert.equal(res.progress[0]?.deliveriesUntilPremium, 0);
});

test("getLoyaltyProgress: 401 surfaces as a typed ApiError", async () => {
  await assert.rejects(
    getLoyaltyProgress(fakeFetch([], () => ({ status: 401, body: { error: "unauthorized" } }))),
    (e) => e instanceof ApiError && e.status === 401,
  );
});
