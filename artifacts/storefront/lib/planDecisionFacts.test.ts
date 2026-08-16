import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { SKIP_SWAP_CUTOFF_MS, PLAN_CATALOG, type PlanId } from "@workspace/subscription-rules";
import { planDecisionFacts, SKIP_SWAP_CUTOFF_HOURS } from "./planDecisionFacts";

/**
 * Laws 5 and 6 at the decision moment.
 *
 * app/(focus)/checkout/page.tsx passed `finePrint={undefined}` for plans while
 * the trial got two disclosure lines. So the cheaper, non-recurring purchase
 * stated its terms and the one that registers a recurring UPI Autopay mandate
 * stated none: a total, "Billed each cycle", and nothing about what arrives,
 * whether a delivery can be skipped, or that it renews.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

test("the cutoff is derived from the shared constant, not written down", () => {
  // The whole reason SKIP_SWAP_CUTOFF_MS is shared is that the server enforces
  // with it. A hand-typed "24 h" in copy is how a promise drifts from a rule.
  assert.equal(SKIP_SWAP_CUTOFF_HOURS, SKIP_SWAP_CUTOFF_MS / 3_600_000);
  const src = fs.readFileSync(path.join(HERE, "planDecisionFacts.ts"), "utf8");
  assert.match(src, /SKIP_SWAP_CUTOFF_MS/);
  assert.doesNotMatch(src, /\b24\s*h\b/, "the cutoff must not be restated as a literal");
});

test("a recurring plan states what arrives, the cutoff, and that it renews", () => {
  const lines = planDecisionFacts("desk_fuel", "monthly");
  assert.equal(lines.length, 3);
  assert.match(lines.join(" "), /per month/);
  assert.match(lines.join(" "), new RegExp(`${SKIP_SWAP_CUTOFF_HOURS}\\s*h`));
  assert.match(lines.join(" "), /Renews every month/);
  assert.match(lines.join(" "), /no lock-in/);
});

test("a one-off plan is never described as renewing", () => {
  // trial_3day is one_off. Captioning it "renews every month" at the pay
  // button is the Law 5 violation this module exists to prevent.
  const lines = planDecisionFacts("trial_3day", undefined);
  const all = lines.join(" ");
  assert.doesNotMatch(all, /Renews every/);
  assert.match(all, /does not renew/);
});

test("an absent cadence falls back to the plan's own cycle, not to monthly", () => {
  // checkout/page.tsx passes asBuilderCycle(cycle), which is undefined when the
  // customer arrived without ?cycle= — and in that case the SERVER quotes the
  // plan's own cycle. Defaulting to monthly here would caption a purchase as
  // something it is not, the mistake that file's own comment warns about.
  for (const id of Object.keys(PLAN_CATALOG) as PlanId[]) {
    const cycle = PLAN_CATALOG[id].cycle;
    const lines = planDecisionFacts(id, undefined).join(" ");
    if (cycle === "one_off") {
      assert.doesNotMatch(lines, /Renews every/, `${id} is one_off and must not claim renewal`);
    } else {
      assert.match(lines, /Renews every/, `${id} renews and must say so`);
    }
  }
});

test("no line restates the price", () => {
  // The server owns the amount and PlanDetails already renders the quote.
  // A second source for the one number that must have exactly one is how
  // display and charge drift apart.
  for (const id of Object.keys(PLAN_CATALOG) as PlanId[]) {
    for (const line of planDecisionFacts(id, "monthly")) {
      assert.doesNotMatch(line, /₹|\bpaise\b/, `${id}: fine print must not carry an amount`);
    }
  }
});

test("every catalog plan produces usable copy", () => {
  for (const id of Object.keys(PLAN_CATALOG) as PlanId[]) {
    const lines = planDecisionFacts(id, "monthly");
    assert.ok(lines.length > 0, `${id} produced no fine print`);
    for (const l of lines) {
      assert.ok(l.trim().length > 0 && l.trim().endsWith("."), `${id}: "${l}" is not a sentence`);
      assert.doesNotMatch(l, /undefined|NaN|\[object/, `${id}: "${l}" leaked a placeholder`);
    }
  }
});

test("checkout wires plans to this, not to undefined", () => {
  const page = fs.readFileSync(
    path.join(HERE, "..", "app", "(focus)", "checkout", "page.tsx"),
    "utf8",
  );
  assert.match(page, /finePrint=\{[\s\S]{0,200}planDecisionFacts\(/);
  assert.doesNotMatch(
    page,
    /finePrint=\{isTrial \? \[[^\]]*\] : undefined\}/,
    "plans must not fall back to no disclosure",
  );
});
