import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Laws 1 and 7 — serviceability before salesmanship, asked as an ordering
 * invariant rather than a behaviour.
 *
 * The defect this guards was pure sequence. The plan/trial checkout asked, in
 * order: phone + OTP (PlanIdentityGate), then allergies and medical conditions
 * (MemberIntake, inside PlanDetails), and only then the PIN code. Someone just
 * outside the served sectors surrendered a phone number, their allergies and
 * their medical conditions before learning we cannot deliver to them — the
 * quote's `unserviceable_pincode` landing after the OTP round trip.
 *
 * Nothing about that is visible to a type-checker, and both orderings render
 * perfectly. What makes it wrong is which question comes first, so that is what
 * is pinned here: every early return that collects personal data must sit BELOW
 * the serviceability gate's early return. Reorder them and this fails.
 *
 * Parsed rather than rendered: the storefront's node --test suite runs
 * lib/**\/*.test.ts with no DOM, and these components are client components
 * behind "@/" aliases. adminConsoles.test.ts and opsAgentWiring.test.ts
 * establish the parse-don't-render precedent for exactly this kind of drift.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECKOUT_DIR = path.join(HERE, "..", "components", "checkout", "plan");
const PLAN_CHECKOUT = fs.readFileSync(path.join(CHECKOUT_DIR, "PlanCheckout.tsx"), "utf8");
const GATE = fs.readFileSync(path.join(CHECKOUT_DIR, "PlanServiceabilityGate.tsx"), "utf8");

/** Index of the early return that renders `component`, or -1. */
function returnIndexOf(component: string): number {
  return PLAN_CHECKOUT.indexOf(`<${component}`);
}

test("the serviceability gate renders before the identity gate", () => {
  const service = returnIndexOf("PlanServiceabilityGate");
  const identity = returnIndexOf("PlanIdentityGate");
  assert.notEqual(service, -1, "PlanServiceabilityGate must be rendered by PlanCheckout");
  assert.notEqual(identity, -1);
  assert.ok(
    service < identity,
    "PlanIdentityGate asks for a phone number — it must not render before the PIN is confirmed",
  );
});

test("the serviceability gate renders before the details step", () => {
  // PlanDetails hosts MemberIntake (allergies, medical conditions). Those are
  // the most sensitive fields in the funnel and the least recoverable if the
  // answer turns out to be "we don't deliver there".
  const service = returnIndexOf("PlanServiceabilityGate");
  const details = returnIndexOf("PlanDetails");
  assert.notEqual(details, -1);
  assert.ok(service < details, "PlanDetails collects allergens/conditions — it must come after the PIN");
});

test("the gate blocks on an unresolved verdict rather than falling through", () => {
  // A gate that renders but does not short-circuit is decoration. The null
  // check must guard an early return, so nothing below it can render first.
  assert.match(
    PLAN_CHECKOUT,
    /if \(servicePincode === null\) \{[\s\S]{0,400}?<PlanServiceabilityGate/,
    "the serviceability branch must be an early return keyed on an unresolved PIN",
  );
});

test("a confirmed PIN seeds the address step instead of being asked again", () => {
  // Law 4: the customer answered this question to get through the gate.
  assert.match(PLAN_CHECKOUT, /initialAddress=\{savedAddress \?\? \{[^}]*servicePincode/);
});

test("an unserviceable verdict ends in notify-me, not a dead end", () => {
  // Laws 9 and 10: the one state where we say no is the state most likely to
  // become a blank wall.
  assert.match(GATE, /unserviceable/);
  assert.match(GATE, /NotifyMeForm/);
});

test("the gate does not mount a second ServiceabilityBar", () => {
  // ServiceabilityBar documents "EXACTLY ONE INSTANCE MAY BE MOUNTED PER PAGE"
  // — its verdict is per-instance state seeded once at mount, so a second copy
  // silently disagrees with the header's. Sharing serviceabilityApi gives the
  // same answer without the second bar, and is what makes Law 4 hold across
  // surfaces.
  assert.doesNotMatch(GATE, /<ServiceabilityBar/);
  assert.match(GATE, /from "@\/lib\/serviceabilityApi"/);
});

test("a verdict already given upstream is not asked for again", () => {
  // Someone who answered in the header bar must pass straight through.
  assert.match(GATE, /loadServiceabilityState\(\)/);
  assert.match(GATE, /verdict === "serviceable"[\s\S]{0,120}onServiceable/);
});
