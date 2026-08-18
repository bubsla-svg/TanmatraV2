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

// Was `assert.deepEqual(HERO_CAMPAIGNS, [])`, guarding rule 2 — no SAMPLE
// offer, because a demo is indistinguishable from a real one to the reader.
// A real campaign now ships (the pre-launch notice), so emptiness is the wrong
// assertion; it would only force the next author to delete the guard outright.
// What actually has to hold is rule 1: whatever ships must retire ITSELF. An
// offer that outlives its terms is a promise the counter gets asked to keep.
test("every shipped campaign is time-boxed and self-retiring", () => {
  for (const c of HERO_CAMPAIGNS) {
    assert.ok(c.endsAt, `${c.id}: a shipped campaign must set endsAt so it removes itself`);
    const end = Date.parse(c.endsAt!);
    assert.ok(!Number.isNaN(end), `${c.id}: endsAt must parse — an unparseable date fails closed`);
    assert.equal(activeCampaign(new Date(end), HERO_CAMPAIGNS)?.id, undefined,
      `${c.id}: must not render at its own endsAt`);
  }
});

test("the pre-launch notice runs now and stops when the kitchen opens", () => {
  const live = activeCampaign(AT("2026-08-18T00:00:00Z"), HERO_CAMPAIGNS);
  assert.equal(live?.id, "pre-launch-sep-2026", "should be live before launch");
  // 2026-09-01T00:00+05:30 is 2026-08-31T18:30Z — the notice must survive right
  // up to it and be gone on the other side.
  assert.ok(activeCampaign(AT("2026-08-31T18:29:59Z"), HERO_CAMPAIGNS), "still live a second before");
  assert.equal(activeCampaign(AT("2026-08-31T18:30:00Z"), HERO_CAMPAIGNS), null, "gone at launch");
  assert.equal(activeCampaign(AT("2026-09-02T00:00:00Z"), HERO_CAMPAIGNS), null, "gone after launch");
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
