/**
 * Team client wire contract (injected fetch, no network). Verifies the endpoint
 * URLs + role query, the {profiles}/{profile,ownedDishSlugs} unwrapping, the
 * 404→null path, and the empty-on-error resilience the pages rely on.
 * Run: node --test --import tsx ./lib/teamApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getTeamProfiles, getTeamProfile, type TeamProfile } from "./teamApi";

const SAMPLE: TeamProfile = {
  id: 1, slug: "anjali-nair", name: "Anjali Nair", role: "rd", title: "Lead RD", bio: "b",
  signatureLine: "Food is the first medicine.", yearsExperience: 12, initials: "AN", accent: "gold",
  credentials: ["RD (India)"], kitchens: [], lifestyles: ["diabetes"], ownedDishSlugs: [],
  createdAt: "2026-07-01T00:00:00.000Z",
};

interface Call { url: string }
function jsonFetch(calls: Call[], body: unknown, status = 200): typeof fetch {
  return (async (url: unknown) => {
    calls.push({ url: String(url) });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }) as unknown as typeof fetch;
}

test("getTeamProfiles: GETs /api/team-profiles and unwraps {profiles}", async () => {
  const calls: Call[] = [];
  const out = await getTeamProfiles(undefined, jsonFetch(calls, { profiles: [SAMPLE] }));
  assert.match(calls[0]!.url, /\/api\/team-profiles$/);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.slug, "anjali-nair");
});

test("getTeamProfiles: passes ?role=", async () => {
  const calls: Call[] = [];
  await getTeamProfiles("chef", jsonFetch(calls, { profiles: [] }));
  assert.match(calls[0]!.url, /\/api\/team-profiles\?role=chef$/);
});

test("getTeamProfile: unwraps {profile, ownedDishSlugs}", async () => {
  const calls: Call[] = [];
  const out = await getTeamProfile("anjali-nair", jsonFetch(calls, { profile: SAMPLE, ownedDishSlugs: ["dish-a"] }));
  assert.match(calls[0]!.url, /\/api\/team-profiles\/anjali-nair$/);
  assert.equal(out?.profile.name, "Anjali Nair");
  assert.deepEqual(out?.ownedDishSlugs, ["dish-a"]);
});

test("getTeamProfile: 404 resolves to null", async () => {
  const out = await getTeamProfile("nope", jsonFetch([], { error: "not found" }, 404));
  assert.equal(out, null);
});

test("resilience: a failed fetch is [] / null (page renders empty, not error)", async () => {
  const failing = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  assert.deepEqual(await getTeamProfiles(undefined, failing), []);
  assert.equal(await getTeamProfile("x", failing), null);
});
