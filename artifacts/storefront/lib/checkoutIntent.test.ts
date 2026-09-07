import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutHref,
  clampIntentQty,
  MAX_INTENT_QTY,
  parseCheckoutIntent,
  type CheckoutIntent,
} from "./checkoutIntent";
import { MAX_QTY_PER_LINE } from "./cartStore";

// The contract this file locks down: every money path in the storefront is
// nameable as an intent, every intent round-trips through a /checkout URL, and
// a query string that names no completable purchase resolves to null (the
// caller's cue to fall back to the à-la-carte leg) rather than to a guess.

const ROUND_TRIP: CheckoutIntent[] = [
  { mode: "alacarte" },
  { mode: "premium" },
  { mode: "marketplace", itemSlug: "cold-pressed-sesame-oil", qty: 3 },
  { mode: "consult", appointmentId: 42 },
  { mode: "plan", planId: "trial_3day" },
  { mode: "plan", planId: "core_veg", track: "veg", cycle: "weekly", bump: true },
];

function paramsOf(href: string) {
  const q = new URL(href, "https://tanmatra.food").searchParams;
  return Object.fromEntries(q.entries());
}

test("every money path round-trips through a /checkout URL", () => {
  for (const intent of ROUND_TRIP) {
    const href = checkoutHref(intent);
    assert.ok(href.startsWith("/checkout?"), `${intent.mode} must land on /checkout`);
    assert.deepEqual(parseCheckoutIntent(paramsOf(href)), intent);
  }
});

test("the plan link shape already in the wild keeps working", () => {
  // QR codes, the plan builder's push and customers' bookmarks all use ?plan=
  // with no ?mode= at all. Parsing must not require one.
  assert.deepEqual(parseCheckoutIntent({ plan: "trial_3day", track: "veg" }), {
    mode: "plan",
    planId: "trial_3day",
    track: "veg",
  });
});

test("?plan= wins over a stray ?mode=, so a plan link never buys a cart", () => {
  const intent = parseCheckoutIntent({ plan: "core_veg", mode: "alacarte" });
  assert.deepEqual(intent, { mode: "plan", planId: "core_veg" });
});

test("an unrecognised cycle falls back rather than being passed through to billing", () => {
  const intent = parseCheckoutIntent({ plan: "core_veg", cycle: "fortnightly" });
  assert.deepEqual(intent, { mode: "plan", planId: "core_veg" });
});

test("a query string naming no completable purchase resolves to null", () => {
  assert.equal(parseCheckoutIntent({}), null);
  assert.equal(parseCheckoutIntent({ mode: "bananas" }), null);
  assert.equal(parseCheckoutIntent({ mode: "marketplace" }), null); // no item
  assert.equal(parseCheckoutIntent({ mode: "marketplace", item: "  " }), null);
  assert.equal(parseCheckoutIntent({ mode: "consult" }), null); // no appointment
  assert.equal(parseCheckoutIntent({ mode: "consult", appointment: "0" }), null);
  assert.equal(parseCheckoutIntent({ mode: "consult", appointment: "-3" }), null);
  assert.equal(parseCheckoutIntent({ mode: "consult", appointment: "1.5" }), null);
  assert.equal(parseCheckoutIntent({ mode: "consult", appointment: "abc" }), null);
});

test("a marketplace qty is clamped to a real line quantity, never 0 or unbounded", () => {
  assert.equal(clampIntentQty(undefined), 1);
  assert.equal(clampIntentQty("0"), 1);
  assert.equal(clampIntentQty("-4"), 1);
  assert.equal(clampIntentQty("2.9"), 2);
  assert.equal(clampIntentQty("1000"), MAX_INTENT_QTY);
  assert.equal(clampIntentQty("NaN"), 1);
  assert.equal(clampIntentQty(Number.POSITIVE_INFINITY), 1);
  const parsed = parseCheckoutIntent({ mode: "marketplace", item: "ghee", qty: "99" });
  assert.deepEqual(parsed, { mode: "marketplace", itemSlug: "ghee", qty: MAX_INTENT_QTY });
});

test("the intent ceiling is the cart's own line ceiling", () => {
  // The two are declared apart (this module must stay free of the cart store's
  // window access) — so they are pinned together here instead.
  assert.equal(MAX_INTENT_QTY, MAX_QTY_PER_LINE);
});

test("a marketplace href always states its qty, so a re-opened link buys the same amount", () => {
  assert.match(checkoutHref({ mode: "marketplace", itemSlug: "ghee", qty: 1 }), /qty=1/);
});

test("an item slug is URL-encoded, not concatenated raw", () => {
  const href = checkoutHref({ mode: "marketplace", itemSlug: "a&b=c", qty: 1 });
  assert.ok(!href.includes("a&b=c"));
  assert.deepEqual(parseCheckoutIntent(paramsOf(href)), {
    mode: "marketplace",
    itemSlug: "a&b=c",
    qty: 1,
  });
});
