import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Laws 2 and 9 — a payment failure returns to the same summary with a reason
 * the customer can act on, and it does so identically on BOTH money paths.
 *
 * The two checkouts had drifted. AlacarteCheckout routed failures through
 * humanizeOrderError; PlanCheckout rendered `e.message` raw. So the same
 * upstream failure produced real copy on a single order and the server's own
 * machine string — with no next action — on a plan or trial, which is both the
 * more expensive purchase and the one carrying a recurring mandate.
 *
 * Drift, not absence, is the failure mode here: the humanizer existed and one
 * caller simply did not use it. Nothing about that is visible to a type-checker
 * (`e.message` is a perfectly good string), and it only shows up when a payment
 * actually fails. So the parity itself is what gets pinned.
 *
 * Parsed rather than rendered, matching adminConsoles.test.ts and
 * opsAgentWiring.test.ts — these are client components behind "@/" aliases and
 * the storefront's node --test suite has no DOM.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECKOUT = path.join(HERE, "..", "components", "checkout");

function read(rel: string): string {
  return fs.readFileSync(path.join(CHECKOUT, rel), "utf8");
}

const PLAN = read("plan/PlanCheckout.tsx");
const ALACARTE = read("AlacarteCheckout.tsx");
// The third path: one runner shared by Premium, the pantry and paid consults,
// each of which used to run its own inline checkout. Its state machine is a
// `phase` union rather than the two booleans the meal legs carry, so the
// assertions below are on the same PROPERTIES, not the same identifiers.
const RUNNER = read("PurchaseRunner.tsx");

/** The catch block that handles a failed pay attempt. */
function payCatch(src: string): string {
  const start = src.indexOf("if (e instanceof RazorpayDismissed)");
  assert.notEqual(start, -1, "expected a RazorpayDismissed branch");
  return src.slice(start, start + 900);
}

test("both checkouts humanize a payment failure", () => {
  for (const [name, src] of [["PlanCheckout", PLAN], ["AlacarteCheckout", ALACARTE]] as const) {
    assert.match(
      payCatch(src),
      /setError\(humanizeOrderError\(e\)\)/,
      `${name} must route payment failures through humanizeOrderError`,
    );
  }
});

test("neither checkout renders a raw server message on failure", () => {
  for (const [name, src] of [["PlanCheckout", PLAN], ["AlacarteCheckout", ALACARTE]] as const) {
    assert.doesNotMatch(
      payCatch(src),
      /setError\((?:[^)]*\b)?e\.message/,
      `${name} must not surface e.message directly — that is the machine string`,
    );
  }
});

test("a dismissal says the customer was not charged, on both paths", () => {
  // The most common "failure" is someone closing the sheet. If that reads as
  // an error rather than "nothing happened, your card is untouched", it costs
  // a sale that was never actually lost.
  for (const [name, src] of [["PlanCheckout", PLAN], ["AlacarteCheckout", ALACARTE]] as const) {
    const block = payCatch(src);
    assert.match(block, /haven't been charged/, `${name} must say no charge occurred`);
    assert.match(block, /try again/i, `${name} must offer the way back`);
  }
});

test("failure clears the busy flags so the CTA is usable again", () => {
  // Law 9's other half: a reason with a dead button underneath is still a dead
  // end. Both paths must re-enable the retry affordance.
  for (const [name, src] of [["PlanCheckout", PLAN], ["AlacarteCheckout", ALACARTE]] as const) {
    const block = payCatch(src);
    assert.match(block, /setBusy\(false\)/, `${name} must clear busy`);
    assert.match(block, /setVerifying\(false\)/, `${name} must clear verifying`);
  }
});

test("a captured-but-unverified payment goes to the recovery panel, not the retry CTA", () => {
  // The one case where re-enabling the normal CTA would be dangerous: money is
  // already captured, so another press could create a second Razorpay order.
  // Both paths must divert to the idempotent verify-only panel instead.
  for (const [name, src] of [["PlanCheckout", PLAN], ["AlacarteCheckout", ALACARTE]] as const) {
    assert.match(
      src,
      /if \(paidFactsRef\.current\) \{[\s\S]{0,600}?setUnresolved\(true\)/,
      `${name} must divert a captured-but-unverified payment to the recovery panel`,
    );
  }
});

test("the summary is not unmounted while payment is in flight", () => {
  // Law 2: the sheet opens OVER our screen. `verifying` must be a presentation
  // flag on the still-rendered summary, never an early return that swaps it for
  // a bare processing page — that white frame is the void the law forbids.
  assert.match(
    PLAN,
    /data-screen-state=\{verifying \?/,
    "verifying must decorate the rendered summary, not replace it",
  );
  assert.doesNotMatch(
    PLAN,
    /if \(verifying\) \{\s*return/,
    "an early return on `verifying` would unmount the summary behind the sheet",
  );
  assert.doesNotMatch(
    ALACARTE,
    /if \(verifying\) \{\s*return/,
    "an early return on `verifying` would unmount the summary behind the sheet",
  );
});

// ── The third money path (components/checkout/PurchaseRunner.tsx) ────────────
//
// Same laws, checked against its own idiom. This is where the drift would
// reappear: three surfaces were folded into this runner precisely because each
// had invented its own answer to a failed payment, and two of them had no
// captured-but-unverified state at all.

test("the shared runner humanizes a payment failure too", () => {
  assert.match(
    RUNNER,
    /setError\(\s*e instanceof RazorpayDismissed[\s\S]{0,200}?humanizePurchaseError\(e\)/,
    "PurchaseRunner must route payment failures through the machine-string guard",
  );
  assert.doesNotMatch(
    RUNNER,
    /setError\((?:[^)]*\b)?e\.message/,
    "PurchaseRunner must not surface e.message directly",
  );
});

test("the shared runner says the customer was not charged on a dismissal", () => {
  assert.match(RUNNER, /haven't been charged/);
  assert.match(RUNNER, /try again/i);
});

test("the shared runner re-enables its CTA after a recoverable failure", () => {
  // Law 9's other half: `idle` is the phase where the pay CTA is live again.
  assert.match(
    RUNNER,
    /setPhase\("idle"\)/,
    "a failed attempt must return to the phase where the CTA is usable",
  );
});

test("a captured-but-unverified payment goes to the recovery panel on the runner too", () => {
  // The dangerous case: money is captured, so re-enabling the CTA could create
  // a second real charge. The flag must be checked BEFORE the auth and error
  // branches, or a 401 arriving after capture would route to the sign-in gate
  // and back to a live pay button.
  const guard = RUNNER.indexOf('if (capturedAtAllRef.current) {');
  const auth = RUNNER.indexOf('e instanceof ApiError && e.status === 401');
  assert.notEqual(guard, -1, "the runner must have a captured-payment guard");
  assert.notEqual(auth, -1, "the runner must have an auth branch");
  assert.ok(guard < auth, "the captured guard must precede every other failure branch");
  assert.match(
    RUNNER.slice(guard, guard + 400),
    /setPhase\("unresolved"\)/,
    "a captured-but-unverified payment must divert to the recovery panel",
  );
});

test("the runner never re-creates a purchase on a retry", () => {
  // Every one of the three paths this runner replaced could mint a second
  // order, stock decrement or charge on a retry. `create()` is reachable only
  // when no handle has been stored.
  assert.match(
    RUNNER,
    /handleRef\.current \?\? \(await steps\.create\(\)\)/,
    "create must run only when no handle from a prior attempt exists",
  );
});
