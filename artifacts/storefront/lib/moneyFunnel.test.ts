/**
 * The bottom of the funnel, which did not exist.
 *
 * The `cuj_*` vocabulary measured browsing and choosing. The purchase half was
 * measured by exactly one event — `cuj_paid` in CheckoutFlow's `pay()` — placed
 * AFTER that function's `if (LIVE_CHECKOUT_ENABLED) … return`. It can therefore
 * only fire when live checkout is switched OFF, and `app/(focus)/checkout` does
 * not even render CheckoutFlow when the flag is on. In production the
 * storefront's only conversion event was unreachable, and the two components
 * that actually take money emitted nothing at all.
 *
 * You cannot find where a funnel leaks if it has no bottom.
 *
 * Run: node --test --import tsx ./lib/moneyFunnel.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { funnelErrorCode } from "./funnel";
import { ApiError } from "./apiClient";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = path.join(HERE, "..", "components");
const read = (...p: string[]) => fs.readFileSync(path.join(COMPONENTS, ...p), "utf8");

const LIVE_PATHS: [label: string, file: string[]][] = [
  ["à-la-carte", ["checkout", "AlacarteCheckout.tsx"]],
  ["plan", ["checkout", "plan", "PlanCheckout.tsx"]],
];

test("both live money paths report a completed purchase", () => {
  for (const [label, file] of LIVE_PATHS) {
    assert.match(read(...file), /emitFunnel\("checkout_complete"/, `${label} must report completion`);
  }
});

test("both live money paths report an opened payment", () => {
  for (const [label, file] of LIVE_PATHS) {
    assert.match(read(...file), /emitFunnel\("payment_opened"/, `${label} must report the attempt`);
  }
});

test("both live money paths report a failure", () => {
  // Without this the funnel shows attempts and successes and calls the
  // difference "drop-off", hiding a broken payment rail inside it.
  for (const [label, file] of LIVE_PATHS) {
    assert.match(read(...file), /emitFunnel\("payment_failed"/, `${label} must report failures`);
  }
});

test("both live money paths report entering checkout", () => {
  for (const [label, file] of LIVE_PATHS) {
    assert.match(read(...file), /emitFunnel\("begin_checkout"/, `${label} needs a denominator`);
  }
});

test("a dismissal is not counted as a payment failure", () => {
  // Someone closing the modal is changing their mind. Folding that into the
  // failure count reads as a broken gateway and would send someone hunting a
  // bug that is not there.
  for (const [, file] of LIVE_PATHS) {
    assert.match(read(...file), /RazorpayDismissed \? "dismissed"/);
  }
});

test("only the plan path claims a subscription was created", () => {
  // An à-la-carte order completes a checkout and starts no subscription;
  // counting "plans started" off checkout_complete would include every dish
  // order ever placed.
  assert.match(read("checkout", "plan", "PlanCheckout.tsx"), /emitFunnel\("subscription_created"/);
  assert.doesNotMatch(read("checkout", "AlacarteCheckout.tsx"), /subscription_created/);
});

test("every reported amount is the server's, never a client sum", () => {
  // The money rule: this codebase never authors an amount. An analytics total
  // computed from the cart would drift from the receipt and be believed.
  const alacarte = read("checkout", "AlacarteCheckout.tsx");
  assert.match(alacarte, /total_paise: quote\.payableNowPaise/);
  assert.doesNotMatch(alacarte, /total_paise: subtotalPaise/);
  const plan = read("checkout", "plan", "PlanCheckout.tsx");
  assert.match(plan, /total_paise: quote\.payableTotalPaise/);
});

test("amounts are named in the unit this product actually bills in", () => {
  // The canonical event list says `total_cents`. This is an INR product that
  // counts paise everywhere; "cents" would name a unit that does not exist
  // here, and is only discovered after someone divides by 100.
  for (const [, file] of LIVE_PATHS) {
    assert.doesNotMatch(read(...file), /total_cents/);
  }
});

test("a failure code groups by cause, not by copy", () => {
  // The humanized sentence is written to be read and expected to change;
  // grouping on it would split one cause across every rewording.
  assert.equal(funnelErrorCode(new ApiError(409, "slot_taken", "That slot just went.")), "slot_taken");
  assert.equal(funnelErrorCode(new Error("boom")), "unknown");
  assert.equal(funnelErrorCode(null), "unknown");
  assert.equal(funnelErrorCode(undefined), "unknown");
  assert.equal(funnelErrorCode({ code: "" }), "unknown", "an empty code is not a cause");
  assert.equal(funnelErrorCode({ code: 42 }), "unknown", "a non-string code is not a cause");
});

test("the unreachable conversion event is still only in the flag-dark path", () => {
  // Left in place deliberately — it is correct where it sits, and removing it
  // would change the preview build's behaviour for no gain. This test records
  // that it is NOT the production conversion event, so nobody restores a
  // scoreboard onto it.
  const flow = read("checkout", "CheckoutFlow.tsx");
  const guard = flow.indexOf("if (LIVE_CHECKOUT_ENABLED)");
  const paid = flow.indexOf('emitFunnel("cuj_paid"');
  assert.ok(guard > 0 && paid > 0);
  assert.ok(paid > guard, "cuj_paid still sits after the live-flag early return");
});
