import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchReferralOffer } from "./referralOfferApi";

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

test("fetchReferralOffer uppercases the code into the request path", async () => {
  let url = "";
  const fetchImpl = (async (u: string) => {
    url = u;
    return new Response(JSON.stringify({ valid: true, refereeAwardPaise: 30000 }));
  }) as unknown as typeof fetch;
  await fetchReferralOffer("a1b2c3d4", "https://api.test", fetchImpl);
  assert.equal(url, "https://api.test/api/referral/offer/A1B2C3D4");
});

test("fetchReferralOffer returns the server's award and referrer name", async () => {
  const offer = await fetchReferralOffer(
    "A1B2C3D4",
    "https://api.test",
    jsonFetch({ valid: true, code: "A1B2C3D4", referrerFirstName: "Rohit", refereeAwardPaise: 30000 }),
  );
  assert.deepEqual(offer, {
    valid: true,
    code: "A1B2C3D4",
    referrerFirstName: "Rohit",
    refereeAwardPaise: 30000,
  });
});

test("fetchReferralOffer omits a blank referrer name so the caller says 'a friend'", async () => {
  const offer = await fetchReferralOffer(
    "A1B2C3D4",
    "https://api.test",
    jsonFetch({ valid: true, referrerFirstName: "   ", refereeAwardPaise: 30000 }),
  );
  assert.equal(offer?.referrerFirstName, undefined);
});

test("fetchReferralOffer never spends a request on a malformed code", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("{}");
  }) as unknown as typeof fetch;
  assert.equal(await fetchReferralOffer("no", "https://api.test", fetchImpl), null);
  assert.equal(called, false);
});

test("fetchReferralOffer returns null rather than throwing on any failure", async () => {
  // A friend's bad link must never cost the visit — the landing renders its
  // standing offer with no referral line at all.
  assert.equal(
    await fetchReferralOffer("A1B2C3D4", "https://api.test", jsonFetch({}, 429)),
    null,
  );
  const dead = (async () => {
    throw new Error("ECONNREFUSED");
  }) as unknown as typeof fetch;
  assert.equal(await fetchReferralOffer("A1B2C3D4", "https://api.test", dead), null);
});

test("fetchReferralOffer rejects a body with no usable award amount", async () => {
  // Rendering a referral card with an undefined amount would promise nothing
  // in a sentence shaped like a promise.
  assert.equal(
    await fetchReferralOffer("A1B2C3D4", "https://api.test", jsonFetch({ valid: true })),
    null,
  );
  assert.equal(
    await fetchReferralOffer("A1B2C3D4", "https://api.test", jsonFetch({ valid: true, refereeAwardPaise: -1 })),
    null,
  );
});

test("fetchReferralOffer reports an unknown code as invalid, not as an error", async () => {
  const offer = await fetchReferralOffer(
    "DEADBEEF",
    "https://api.test",
    jsonFetch({ valid: false, refereeAwardPaise: 30000 }),
  );
  assert.deepEqual(offer, { valid: false, refereeAwardPaise: 30000 });
});
