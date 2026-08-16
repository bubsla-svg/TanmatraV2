/**
 * The help page that answers "does this keep charging me?" (plan item 2.1).
 *
 * The trap this guards is specific. Every bookable plan DEFAULTS to a
 * non-renewing cycle — desk_fuel and protein_build quote monthly, the trial is
 * one-off — so the obvious implementation, reporting renewal per plan, prints
 * "does not renew" against all of them. It is also wrong for every customer who
 * picked weekly in the builder, because weekly registers a real UPI Autopay
 * mandate. Those are exactly the customers who get charged again.
 *
 * Run: node --test --import tsx ./lib/howItWorks.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { planIsSelfServiceLaunchable, computePlanQuote, PLAN_CATALOG, type PlanId } from "@workspace/subscription-rules";
import { bookablePlans, renewalIsMixed, SKIP_SWAP_SENTENCE } from "./howItWorks";
import { BUILDER_CYCLES } from "./checkoutCycle";
import { COMPANY_LINKS } from "./nav";
import { registersAutopayMandate, SKIP_SWAP_CUTOFF_HOURS } from "./planDecisionFacts";

const PLANS = bookablePlans();

test("only bookable plans are explained", () => {
  // A blocked or sales-led plan routes to a waitlist. Explaining "how it works"
  // for one would describe a purchase nobody can make.
  assert.ok(PLANS.length > 0);
  for (const p of PLANS) assert.ok(planIsSelfServiceLaunchable(p.planId));
  const blocked = (Object.keys(PLAN_CATALOG) as PlanId[]).filter((id) => !planIsSelfServiceLaunchable(id));
  assert.ok(blocked.length > 0, "no blocked plan left to exclude — revisit this rule");
  for (const id of blocked) assert.ok(!PLANS.some((p) => p.planId === id));
});

test("renewal is reported per cycle, and weekly is reported as renewing", () => {
  // The whole point. A per-plan verdict would be "does not renew" everywhere.
  const multi = PLANS.filter((p) => p.cycles.length > 1);
  assert.ok(multi.length > 0, "at least one plan must offer a cycle choice");
  for (const p of multi) {
    const weekly = p.cycles.find((c) => c.cycle === "weekly");
    assert.ok(weekly, `${p.planId} offers the builder's cycles, so weekly must be among them`);
    assert.equal(weekly.renews, true, "weekly registers a mandate — it must be reported as renewing");
    for (const c of p.cycles) assert.equal(c.renews, registersAutopayMandate(c.cycle as never));
  }
});

test("every plan still defaults to a NON-renewing cycle", () => {
  // If this ever flips, the page's "quoted monthly unless you pick otherwise"
  // line becomes wrong and someone should be told by a failure, not by a
  // customer.
  for (const p of PLANS) {
    assert.equal(
      registersAutopayMandate(p.defaultCycle as never),
      false,
      `${p.planId} now defaults to a renewing cycle — the page copy needs revisiting`,
    );
  }
});

test("a one-off plan is not offered a cycle choice it does not have", () => {
  const oneOff = PLANS.filter((p) => p.defaultCycle === "one_off");
  assert.ok(oneOff.length > 0, "the trial must still be one-off");
  for (const p of oneOff) {
    assert.deepEqual(p.cycles.map((c) => c.cycle), ["one_off"]);
    assert.equal(p.cycles[0]!.renews, false);
  }
});

test("choosable cycles are the ones the builder can actually send", () => {
  // Listing a cycle the builder cannot emit would describe a price the customer
  // has no way to select.
  for (const p of PLANS) {
    if (p.defaultCycle === "one_off") continue;
    assert.deepEqual(p.cycles.map((c) => c.cycle), [...BUILDER_CYCLES]);
  }
});

test("the split is computed, not assumed", () => {
  assert.equal(renewalIsMixed(PLANS), true);
  // All-prepaid and all-renewing both collapse to "not mixed", so the page can
  // drop the explanatory paragraph rather than describe a branch that is gone.
  assert.equal(renewalIsMixed([{ ...PLANS[0]!, cycles: [{ cycle: "monthly", renews: false }] }]), false);
  assert.equal(renewalIsMixed([{ ...PLANS[0]!, cycles: [{ cycle: "weekly", renews: true }] }]), false);
});

test("the page's facts are the checkout's facts", () => {
  // Same function as the fine print beneath the pay button, so the help page
  // cannot drift from the screen it explains.
  for (const p of PLANS) {
    assert.ok(p.facts.length > 0);
    assert.ok(p.facts.some((f) => new RegExp(`${SKIP_SWAP_CUTOFF_HOURS}\\s*h`).test(f)));
  }
});

test("the cutoff sentence is derived, not typed", () => {
  assert.match(SKIP_SWAP_SENTENCE, new RegExp(`${SKIP_SWAP_CUTOFF_HOURS} hours`));
  assert.match(SKIP_SWAP_SENTENCE, /comes back as credit/);
});

test("the page is reachable without already being in a checkout", () => {
  // Plan item 2.1 says "linked from header and drawer". A help page that
  // answers "does this keep charging me?" and can only be found from inside a
  // purchase flow answers it for the wrong people, at the wrong time.
  assert.ok(
    COMPANY_LINKS.some((l) => l.href === "/how-it-works"),
    "/how-it-works must appear in a nav group, not only be routable",
  );
});

test("the route the nav points at actually exists", () => {
  // A link to a 404 is worse than no link.
  const page = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..", "app", "(global)", "how-it-works", "page.tsx",
  );
  assert.ok(fs.existsSync(page), "the nav link must resolve to a real route file");
});

test("the default cycle matches what the spine actually quotes", () => {
  for (const p of PLANS) assert.equal(p.defaultCycle, computePlanQuote(p.planId).cycle);
});
