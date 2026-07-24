/**
 * Referral client's wire contract (injected fetch, no network). Locks
 * method/path/credentials against routes/loyalty.ts's /referral/* endpoints.
 * Run: node --test --import tsx ./lib/referralApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import { getMyReferral, redeemReferralCode } from "./referralApi";

interface Call { method: string; url: string; credentials?: string; body?: unknown }

function fakeFetch(calls: Call[], respond: () => { status: number; body: unknown }): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown>) => {
    calls.push({
      method: String(init.method),
      url: String(url),
      credentials: init.credentials as string | undefined,
      body: init.body,
    });
    const { status, body } = respond();
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      text: async () => (body === undefined ? "" : JSON.stringify(body)),
    };
  }) as unknown as typeof fetch;
}

test("getMyReferral: GET /api/referral/me, cookie-authed", async () => {
  const calls: Call[] = [];
  const res = await getMyReferral(
    fakeFetch(calls, () => ({
      status: 200,
      body: { code: "AB12CD34", awards: { referrerPaise: 30000, refereePaise: 30000 }, redemptions: [] },
    })),
  );
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "GET");
  assert.match(c.url, /\/api\/referral\/me$/);
  assert.equal(c.credentials, "include");
  assert.equal(res.code, "AB12CD34");
  assert.equal(res.awards.referrerPaise, 30000);
  assert.equal(res.awards.refereePaise, 30000);
  assert.deepEqual(res.redemptions, []);
});

test("getMyReferral: 401 surfaces as a typed ApiError (so the UI can offer sign-in)", async () => {
  await assert.rejects(
    getMyReferral(fakeFetch([], () => ({ status: 401, body: { error: "unauthorized" } }))),
    (e) => e instanceof ApiError && e.status === 401,
  );
});

test("redeemReferralCode: POST /api/referral/redeem sends {code} verbatim", async () => {
  const calls: Call[] = [];
  const res = await redeemReferralCode(
    "FRIEND01",
    fakeFetch(calls, () => ({
      status: 200,
      body: {
        redemption: {
          id: 1,
          codeId: 2,
          referrerUserId: "u1",
          refereeUserId: "u2",
          referrerAwardPaise: 30000,
          refereeAwardPaise: 30000,
          awardedAt: null,
          firstOrderId: null,
          createdAt: "2026-07-24T00:00:00.000Z",
        },
        awardedPaise: 0,
        status: "pending_first_order",
      },
    })),
  );
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "POST");
  assert.match(c.url, /\/api\/referral\/redeem$/);
  assert.equal(c.credentials, "include");
  assert.deepEqual(JSON.parse(String(c.body)), { code: "FRIEND01" });
  assert.equal(res.status, "pending_first_order");
  assert.equal(res.awardedPaise, 0);
  assert.equal(res.redemption.awardedAt, null);
});

test("redeemReferralCode surfaces 400 (own code), 404 (unknown), and 409 (already redeemed) as typed ApiErrors", async () => {
  await assert.rejects(
    redeemReferralCode("OWN0001", fakeFetch([], () => ({ status: 400, body: { error: "cannot redeem your own code" } }))),
    (e) => e instanceof ApiError && e.status === 400 && /own code/.test((e as Error).message),
  );
  await assert.rejects(
    redeemReferralCode("NOPE", fakeFetch([], () => ({ status: 404, body: { error: "code not found" } }))),
    (e) => e instanceof ApiError && e.status === 404,
  );
  await assert.rejects(
    redeemReferralCode("SOMEONE1", fakeFetch([], () => ({ status: 409, body: { error: "already redeemed a referral" } }))),
    (e) => e instanceof ApiError && e.status === 409 && /already redeemed/.test((e as Error).message),
  );
});
