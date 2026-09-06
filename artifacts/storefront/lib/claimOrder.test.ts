/**
 * Guest→account claim, client half (plan item 2.4).
 *
 * The endpoint is exercised for real in api-server's orders.claim.test.ts.
 * What is pinned here is the half a customer actually meets: the URL and method
 * the request uses, and that every refusal turns into a sentence naming a next
 * step instead of a raw code.
 *
 * Run: node --test --import tsx ./lib/claimOrder.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { ApiError } from "./apiClient";
import {
  CLAIM_OFFER_COPY,
  CLAIM_SUCCESS_COPY,
  claimCodeOf,
  claimOrder,
  claimRefusalCopy,
  isOnAccount,
  type ClaimCode,
} from "./claimOrder";

const REFUSALS: ClaimCode[] = ["owned_by_other", "unprovable", "phone_mismatch", "unknown_order"];

function stubFetch(status: number, body: unknown): { calls: Request[]; impl: typeof fetch } {
  const calls: Request[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), ...init } as unknown as Request);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

test("a claim POSTs to the order's own claim path", async () => {
  const { calls, impl } = stubFetch(200, { ok: true, claimed: true, code: "claimable" });
  const out = await claimOrder("alc-123", impl);
  assert.equal(out.claimed, true);
  const call = calls[0] as unknown as { url: string; method: string };
  assert.match(call.url, /\/api\/orders\/alc-123\/claim$/);
  assert.equal(call.method, "POST");
});

test("an order id is escaped into the path, never concatenated raw", () => {
  // externalOrderId is client-generated at checkout and round-trips through a
  // URL. A `/` or `?` in one would silently address a different endpoint.
  const src = fs.readFileSync(new URL("./claimOrder.ts", import.meta.url), "utf8");
  assert.match(src, /encodeURIComponent\(externalOrderId\)/);
});

test("already_yours is a success, not an error", async () => {
  // The island claims on mount, and the confirmation page can be refreshed.
  const { impl } = stubFetch(200, { ok: true, claimed: false, code: "already_yours" });
  const out = await claimOrder("alc-1", impl);
  assert.equal(out.claimed, false);
  assert.equal(isOnAccount(out.code), true);
});

test("a refusal's reason is read from the body code, not the status", async () => {
  // Every refusal is 403 on purpose — the status must not answer "does this
  // order exist". So the code is the only signal there is.
  const { impl } = stubFetch(403, { error: "phone_mismatch", code: "phone_mismatch" });
  await assert.rejects(
    () => claimOrder("alc-1", impl),
    (e: unknown) => {
      assert.equal(claimCodeOf(e), "phone_mismatch");
      return true;
    },
  );
});

test("an unrecognised failure is not mistaken for a decision", () => {
  // A 502 from the proxy or a 500 must fall through to generic error handling,
  // not render "this order belongs to someone else".
  assert.equal(claimCodeOf(new ApiError(502, "bad_response", "Received an invalid response")), null);
  assert.equal(claimCodeOf(new ApiError(500, "error", "Internal Server Error")), null);
  assert.equal(claimCodeOf(new Error("network down")), null);
});

test("every refusal names a next step", () => {
  // Law 9. Stating only the fact — "this order belongs to another account" —
  // leaves someone on a confirmation screen with nothing to do.
  for (const code of REFUSALS) {
    const copy = claimRefusalCopy(code);
    assert.ok(copy.length > 40, `${code} needs a sentence, not a label`);
    // "WhatsApp" is a next step because it is now THE support channel
    // (owner, 2026-09-06); "support" stays for refusals that still say it.
    assert.match(copy, /sign in|support|WhatsApp|confirmation message/i, code);
  }
});

test("no refusal is the raw server code", () => {
  for (const code of REFUSALS) {
    assert.doesNotMatch(claimRefusalCopy(code), /_/, `${code} leaked machine vocabulary`);
  }
});

test("no refusal names the account that holds the order", () => {
  // "Already saved to +9198…3210" hands one customer another's number.
  for (const code of REFUSALS) {
    assert.doesNotMatch(claimRefusalCopy(code), /\d{4,}/, code);
  }
});

test("the offer promises only what the claim can deliver", () => {
  // It attaches THIS order to the number that placed it. It cannot carry the
  // order onto a different number, so the copy must not imply that any sign-in
  // will do.
  assert.match(CLAIM_OFFER_COPY, /number you just used/i);
  assert.match(CLAIM_SUCCESS_COPY, /orders/i);
});

// ── Wiring ────────────────────────────────────────────────────────────────────

test("the confirmation screen actually renders the offer", () => {
  // A claim endpoint nothing calls is the same defect as no endpoint.
  const page = fs.readFileSync(
    new URL("../app/(focus)/order/confirmed/[orderId]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /<ClaimOrder\b/);
  assert.match(page, /orderId=\{orderId\}/);
});

test("the island offers sign-in inline instead of routing away", () => {
  // A confirmation screen is the worst possible place to bounce someone to
  // /login: they have just paid, and the page they would leave is the receipt.
  const src = fs.readFileSync(new URL("../components/order/ClaimOrder.tsx", import.meta.url), "utf8");
  assert.match(src, /<PhoneAuth\b/);
  assert.doesNotMatch(src, /router\.(push|replace)\(\s*["'`]\/login/);
});

test("the island claims only after the session exists", () => {
  // Claiming while signed out would spend the customer's rate-limit budget on
  // a call that can only 401.
  const src = fs.readFileSync(new URL("../components/order/ClaimOrder.tsx", import.meta.url), "utf8");
  const probe = src.indexOf("getAuthUser");
  const call = src.indexOf("claimOrder(");
  assert.ok(probe > 0 && call > probe, "probe the session before claiming");
});
