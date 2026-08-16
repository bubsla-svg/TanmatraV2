import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { SKIP_SWAP_CUTOFF_MS, PLAN_CATALOG, type PlanId } from "@workspace/subscription-rules";
import { planDecisionFacts, registersAutopayMandate, SKIP_SWAP_CUTOFF_HOURS } from "./planDecisionFacts";

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

test("an autopay cadence states what arrives, the cutoff, and that it renews", () => {
  const lines = planDecisionFacts("desk_fuel", "weekly");
  assert.equal(lines.length, 3);
  assert.match(lines.join(" "), /per week/);
  assert.match(lines.join(" "), new RegExp(`${SKIP_SWAP_CUTOFF_HOURS}\\s*h`));
  assert.match(lines.join(" "), /Renews every week/);
  assert.match(lines.join(" "), /no lock-in/);
});

test("a prepaid cadence is never described as renewing", () => {
  // The first draft said "Renews every month until you cancel" for every
  // non-one-off cadence. The server attaches Razorpay's `token` block — the
  // thing that makes a payment a mandate registration — only for weekly and
  // fortnightly, so a monthly plan registers no mandate and the charge sweep
  // has nothing to bill. The promise could not be kept.
  //
  // And monthly is the DEFAULT cadence, so this was the common case. Its
  // ending is worse than a one-off mislabelled as renewing: the customer
  // believes food keeps arriving, and it stops on a date nobody named.
  for (const cadence of ["monthly", "quarterly"] as const) {
    const all = planDecisionFacts("desk_fuel", cadence).join(" ");
    assert.doesNotMatch(all, /Renews every/, `${cadence} registers no mandate and must not claim renewal`);
    assert.match(all, /[Nn]othing renews automatically/);
    assert.match(all, /no recurring charge is set up/);
  }
});

test("the renewal claim tracks the cadences that actually register a mandate", () => {
  // Guards the mapping itself against drift from api-server's own condition
  // (routes/payments.ts: cadence === "weekly" || cadence === "fortnightly",
  // and not a live trial).
  assert.equal(registersAutopayMandate("weekly"), true);
  assert.equal(registersAutopayMandate("fortnightly"), true);
  assert.equal(registersAutopayMandate("monthly"), false);
  assert.equal(registersAutopayMandate("quarterly"), false);
  assert.equal(registersAutopayMandate("one_off"), false);
});

test("only an autopay cadence mentions UPI Autopay", () => {
  // The disclaimer describes a mandate. Naming the mechanism where none is
  // registered would be precise and wrong — the worst combination.
  assert.match(planDecisionFacts("desk_fuel", "weekly").join(" "), /UPI Autopay/);
  assert.doesNotMatch(planDecisionFacts("desk_fuel", "monthly").join(" "), /UPI Autopay/);
  assert.doesNotMatch(planDecisionFacts("trial_3day", undefined).join(" "), /UPI Autopay/);
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
    if (registersAutopayMandate(cycle)) {
      assert.match(lines, /Renews every/, `${id} registers a mandate and must say so`);
    } else {
      assert.doesNotMatch(lines, /Renews every/, `${id} registers no mandate and must not claim renewal`);
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
