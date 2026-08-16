/**
 * The one sentence that tells a customer a recurring charge now exists.
 *
 * It is returned from POST /payments/razorpay/verify only after a UPI Autopay
 * mandate has really been registered, and the storefront renders it verbatim on
 * the confirmation screen. It was a single literal beginning "Weekly payments…"
 * while mandates are registered for weekly AND fortnightly cadences — so every
 * fortnightly customer was told the wrong billing frequency at the exact moment
 * they were being told a mandate exists.
 *
 * Run: node --test --import tsx ./src/lib/autopayDisclaimer.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { autopayDisclaimerFor } from "./autopayDisclaimer";

test("each autopay cadence is described as itself", () => {
  assert.match(autopayDisclaimerFor("weekly"), /^Weekly payments use UPI Autopay\./);
  assert.match(autopayDisclaimerFor("fortnightly"), /^Fortnightly payments use UPI Autopay\./);
});

test("a fortnightly customer is never told 'weekly'", () => {
  assert.doesNotMatch(autopayDisclaimerFor("fortnightly"), /[Ww]eekly/);
});

test("an unmapped cadence is described generally, never specifically wrong", () => {
  // Today the cadence gate in POST /payments/razorpay/order lets only weekly
  // and fortnightly reach mandate registration. If a third is ever enabled,
  // saying nothing about the period beats saying "Weekly" about it — that
  // substitution is how the fortnightly case became wrong in the first place.
  for (const cadence of ["monthly", "quarterly", "daily", ""]) {
    const line = autopayDisclaimerFor(cadence);
    assert.doesNotMatch(line, /Weekly|Fortnightly/, `"${cadence}" must not borrow another cadence's word`);
    assert.match(line, /UPI Autopay/, `"${cadence}" must still name the mechanism`);
  }
});

test("every cadence keeps the pre-charge notification promise", () => {
  // The substantive half of the disclaimer, and the part a customer acts on.
  for (const cadence of ["weekly", "fortnightly", "monthly"]) {
    assert.match(autopayDisclaimerFor(cadence), /at least 24 hours before each charge/);
  }
});

test("the sentence is finished", () => {
  // The literal ended "...before each charge..." — a trailing ellipsis that
  // shipped to the customer verbatim and reads as truncated placeholder text.
  for (const cadence of ["weekly", "fortnightly", "monthly"]) {
    const line = autopayDisclaimerFor(cadence);
    assert.doesNotMatch(line, /\.\.\.$/, "a disclaimer must not trail off");
    assert.match(line, /\.$/);
  }
});
