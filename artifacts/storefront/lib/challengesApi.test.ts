/**
 * Challenges client wire contract (injected fetch, no network). Covers the
 * server list/detail unwrap + resilience, and the client (cookie-authed)
 * membership/join/post calls incl. the ApiError-on-non-2xx path.
 * Run: node --test --import tsx ./lib/challengesApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import {
  getChallenges,
  getChallenge,
  loadChallengeState,
  joinChallenge,
  postToChallenge,
  challengeStatus,
  type Challenge,
} from "./challengesApi";

const CH: Challenge = {
  id: 1, slug: "sugar-reset", title: "14-Day Sugar Reset", tagline: "Break the afternoon crash.",
  description: "d", image: null, rdName: "Anjali Nair", durationDays: 14,
  startsAt: "2026-08-01T00:00:00.000Z", endsAt: "2026-08-15T00:00:00.000Z",
  goalTags: ["low-gi"], bundleSlug: null, featured: 1, memberCount: 42, createdAt: "2026-07-01T00:00:00.000Z",
};

interface Call { url: string; method?: string; credentials?: string; body?: unknown }
function fake(calls: Call[], body: unknown, status = 200): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown> = {}) => {
    calls.push({ url: String(url), method: init.method as string, credentials: init.credentials as string, body: init.body });
    return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
  }) as unknown as typeof fetch;
}

test("challengeStatus: soon / live / ended from the window", () => {
  const s = "2026-08-01T00:00:00.000Z", e = "2026-08-15T00:00:00.000Z";
  assert.equal(challengeStatus(s, e, Date.parse("2026-07-20T00:00:00Z")), "soon");
  assert.equal(challengeStatus(s, e, Date.parse("2026-08-07T00:00:00Z")), "live");
  assert.equal(challengeStatus(s, e, Date.parse("2026-09-01T00:00:00Z")), "ended");
});

test("getChallenges: GETs /api/challenges, unwraps {challenges}, [] on failure", async () => {
  const calls: Call[] = [];
  const out = await getChallenges(fake(calls, { challenges: [CH] }));
  assert.match(calls[0]!.url, /\/api\/challenges$/);
  assert.equal(out[0]!.slug, "sugar-reset");
  const failing = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
  assert.deepEqual(await getChallenges(failing), []);
});

test("getChallenge: unwraps {challenge,joined,posts,checkIns}; 404→null", async () => {
  const detail = { challenge: CH, joined: false, posts: [{ id: 1, authorName: "A", body: "hi", createdAt: "x" }], checkIns: [] };
  const out = await getChallenge("sugar-reset", fake([], detail));
  assert.equal(out?.challenge.slug, "sugar-reset");
  assert.equal(out?.posts.length, 1);
  assert.equal(await getChallenge("nope", fake([], { error: "not found" }, 404)), null);
});

test("loadChallengeState: cookie-authed GET returns the member view", async () => {
  const calls: Call[] = [];
  const detail = { challenge: CH, joined: true, posts: [], checkIns: [{ id: 5, title: "Kickoff", scheduledAt: "x", joinUrl: "https://z" }] };
  const out = await loadChallengeState("sugar-reset", fake(calls, detail));
  assert.match(calls[0]!.url, /\/api\/challenges\/sugar-reset$/);
  assert.equal(calls[0]!.credentials, "include");
  assert.equal(out.joined, true);
  assert.equal(out.checkIns.length, 1);
});

test("joinChallenge: cookie-authed POST to /join", async () => {
  const calls: Call[] = [];
  const out = await joinChallenge("sugar-reset", fake(calls, { ok: true, joined: true }));
  assert.match(calls[0]!.url, /\/api\/challenges\/sugar-reset\/join$/);
  assert.equal(calls[0]!.method, "POST");
  assert.equal(calls[0]!.credentials, "include");
  assert.equal(out.joined, true);
});

test("postToChallenge: POSTs {body}, returns the created post", async () => {
  const calls: Call[] = [];
  const post = { id: 9, authorName: "Me", body: "day 1 done", createdAt: "x" };
  const out = await postToChallenge("sugar-reset", "day 1 done", fake(calls, { post }));
  assert.match(calls[0]!.url, /\/api\/challenges\/sugar-reset\/posts$/);
  assert.deepEqual(JSON.parse(String(calls[0]!.body)), { body: "day 1 done" });
  assert.equal(out.id, 9);
});

test("a non-2xx client call rejects as a typed ApiError", async () => {
  await assert.rejects(
    joinChallenge("sugar-reset", fake([], { error: "login required" }, 401)),
    (e) => e instanceof ApiError && e.status === 401,
  );
});
