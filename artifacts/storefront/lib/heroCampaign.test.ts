// Hero announcement / offer slot. An offer that outlives its terms is a promise
// the counter gets asked to keep, so the window logic is the whole test.
//   cd artifacts/api-server && node --test --import tsx ../storefront/lib/heroCampaign.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { activeCampaign, HERO_CAMPAIGNS, type HeroCampaign } from "./heroCampaign";

const AT = (iso: string) => new Date(iso);

const OFFER: HeroCampaign = {
  id: "diwali",
  message: "Free delivery this week.",
  cta: { label: "See plans", href: "/plans" },
  startsAt: "2026-11-06T00:00:00Z",
  endsAt: "2026-11-13T00:00:00Z",
};

test("ships with no campaign — a sample offer is indistinguishable from a real one", () => {
  assert.deepEqual(HERO_CAMPAIGNS, []);
  assert.equal(activeCampaign(AT("2026-08-13T00:00:00Z")), null);
});

test("runs inside its window and stops the moment it ends", () => {
  assert.equal(activeCampaign(AT("2026-11-05T23:59:59Z"), [OFFER]), null, "before the start");
  assert.equal(activeCampaign(AT("2026-11-06T00:00:00Z"), [OFFER])?.id, "diwali", "at the start");
  assert.equal(activeCampaign(AT("2026-11-10T12:00:00Z"), [OFFER])?.id, "diwali", "mid-window");
  assert.equal(activeCampaign(AT("2026-11-13T00:00:00Z"), [OFFER]), null, "endsAt is exclusive");
  assert.equal(activeCampaign(AT("2027-01-01T00:00:00Z"), [OFFER]), null, "long after");
});

test("an open-ended notice runs until it is removed", () => {
  const notice: HeroCampaign = { id: "hours", message: "Closed Sunday." };
  assert.equal(activeCampaign(AT("2030-01-01T00:00:00Z"), [notice])?.id, "hours");
});

test("a malformed date fails the campaign CLOSED, never broadcast forever", () => {
  const typo: HeroCampaign = { id: "typo", message: "Oops", startsAt: "6th November" };
  assert.equal(activeCampaign(AT("2026-11-10T00:00:00Z"), [typo]), null);

  const badEnd: HeroCampaign = { id: "bad-end", message: "Oops", endsAt: "next Tuesday" };
  assert.equal(activeCampaign(AT("2026-11-10T00:00:00Z"), [badEnd]), null);
});

test("overlapping campaigns resolve by list order, deterministically", () => {
  const a: HeroCampaign = { id: "a", message: "A" };
  const b: HeroCampaign = { id: "b", message: "B" };
  assert.equal(activeCampaign(AT("2026-11-10T00:00:00Z"), [a, b])?.id, "a");
  assert.equal(activeCampaign(AT("2026-11-10T00:00:00Z"), [b, a])?.id, "b");
});

test("an expired campaign never blocks a live one behind it", () => {
  const expired: HeroCampaign = { id: "old", message: "Old", endsAt: "2026-01-01T00:00:00Z" };
  const live: HeroCampaign = { id: "new", message: "New" };
  assert.equal(activeCampaign(AT("2026-11-10T00:00:00Z"), [expired, live])?.id, "new");
});
