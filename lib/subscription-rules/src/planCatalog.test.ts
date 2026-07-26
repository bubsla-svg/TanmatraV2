// Run: node --test --import tsx ./src/planCatalog.test.ts   (from lib/subscription-rules)
import { test } from "node:test";
import assert from "node:assert/strict";
import { DISHES } from "@workspace/menu-catalog";
import {
  PLAN_CATALOG,
  PLAN_PRICE_TABLE,
  ADD_ONS,
  attachableAddOns,
  resolveAddOns,
  TRIAL_TRIOS,
  TRIAL_CREDIT_PAISE,
  WEEKLY_PRICE_PAISE,
  MONTHLY_PRICE_PAISE,
  applyTrialCreditPaise,
  trialCreditExpiry,
  trialCreditGrant,
  poolForPlan,
  trackLaunchState,
  computePlanQuote,
  planIsSelfServiceLaunchable,
  planServesTrack,
  ROUTER_ANSWER_TO_PLAN,
  isServable,
} from "./planCatalog.js";

// ── §2 config values ─────────────────────────────────────────────────────────
test("plan prices match 02e §2 (paise)", () => {
  assert.equal(PLAN_CATALOG.desk_fuel.pricePerMealPaise, 19900);
  assert.equal(PLAN_CATALOG.steady.pricePerMealPaise, 22900);
  assert.equal(PLAN_CATALOG.protein_build.pricePerMealPaise, 24900);
  assert.equal(PLAN_CATALOG.teams.pricePerMealPaise, 18900);
  assert.equal(PLAN_CATALOG.glp1_companion.flatPricePaise, 599900);
  assert.equal(PLAN_CATALOG.trial_3day.flatPricePaise, 39900);
});

test("diet tracks are honestly narrowed (02e §2) — never widened for symmetry", () => {
  assert.deepEqual(PLAN_CATALOG.steady.dietTracks, ["nonveg"]);
  assert.deepEqual(PLAN_CATALOG.glp1_companion.dietTracks, ["egg", "nonveg"]);
  assert.deepEqual(PLAN_CATALOG.desk_fuel.dietTracks, ["veg", "egg", "nonveg"]);
});

test("RD sign-off + blocked status flags match 02e §2", () => {
  assert.equal(PLAN_CATALOG.steady.requiresRdSignoff, true);
  assert.equal(PLAN_CATALOG.glp1_companion.requiresRdSignoff, true);
  assert.equal(PLAN_CATALOG.desk_fuel.requiresRdSignoff, false);
  assert.equal(PLAN_CATALOG.steady.status, "blocked_pending_skus");
  assert.equal(PLAN_CATALOG.glp1_companion.status, "blocked_pending_skus");
  assert.equal(PLAN_CATALOG.desk_fuel.status, "live");
  assert.equal(PLAN_CATALOG.teams.status, "sales_led");
});

// ── §4 add-ons ───────────────────────────────────────────────────────────────
test("add-on prices match 02e §4", () => {
  assert.equal(ADD_ONS.rd_bump.pricePaise, 49900);
  assert.equal(ADD_ONS.rd_bump.cadence, "monthly");
  assert.equal(ADD_ONS.rd_bump.attachPoint, "plan_review");
  assert.equal(ADD_ONS.evening_add.pricePaise, 59900);
  assert.equal(ADD_ONS.evening_add.cadence, "weekly");
  assert.equal(ADD_ONS.evening_add.attachPoint, "post_purchase");
});

test("resolveAddOns validates against the plan allow-list (02e §2)", () => {
  // desk_fuel allows both
  const ok = resolveAddOns("desk_fuel", ["rd_bump", "evening_add"]);
  assert.deepEqual(ok.rejected, []);
  assert.deepEqual(
    ok.items.map((i) => i.id),
    ["rd_bump", "evening_add"],
  );
  assert.equal(ok.items[0].pricePaise, 49900);
  // protein_build allows evening_add only → rd_bump is rejected
  const pb = resolveAddOns("protein_build", ["rd_bump", "evening_add"]);
  assert.deepEqual(pb.rejected, ["rd_bump"]);
  assert.deepEqual(
    pb.items.map((i) => i.id),
    ["evening_add"],
  );
  // teams allows none
  assert.deepEqual(resolveAddOns("teams", ["rd_bump"]).rejected, ["rd_bump"]);
});

test("resolveAddOns dedupes and preserves request order", () => {
  const r = resolveAddOns("desk_fuel", ["rd_bump", "rd_bump", "evening_add"]);
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items.map((i) => i.id), ["rd_bump", "evening_add"]);
});

test("attachableAddOns reflects each plan's allow-list", () => {
  assert.deepEqual(attachableAddOns("glp1_companion"), ["rd_bump"]);
  assert.deepEqual(attachableAddOns("teams"), []);
});

// ── §6 trial credit math (implement exactly) ─────────────────────────────────
test("trial credit math is exact (02e §6): weekly→80000, monthly→397900", () => {
  assert.equal(TRIAL_CREDIT_PAISE, 39900);
  assert.equal(applyTrialCreditPaise(WEEKLY_PRICE_PAISE), 80000); // 119900 - 39900
  assert.equal(applyTrialCreditPaise(MONTHLY_PRICE_PAISE), 397900); // 437800 - 39900
  assert.equal(WEEKLY_PRICE_PAISE - TRIAL_CREDIT_PAISE, 80000); // trial+weekly = ₹1,199
});

test("trial credit never bills negative when credit exceeds plan", () => {
  assert.equal(applyTrialCreditPaise(20000), 0);
});

test("trial credit expiry is 7 days after trial end; grant is a ₹399 lot", () => {
  const end = new Date("2026-08-01T00:00:00.000Z");
  assert.equal(trialCreditExpiry(end).toISOString(), "2026-08-08T00:00:00.000Z");
  const grant = trialCreditGrant(end);
  assert.equal(grant.deltaPaise, TRIAL_CREDIT_PAISE);
  assert.equal(grant.reason, "trial_creditback");
  assert.equal(grant.expiresAt.toISOString(), "2026-08-08T00:00:00.000Z");
});

// ── S4 plan quote (server-authoritative, GST-inclusive) ──────────────────────
test("computePlanQuote — per-meal plan: cycle total = price × meals, GST split", () => {
  const q = computePlanQuote("desk_fuel");
  assert.equal(q.cycleTotalPaise, 437800); // 19900 × 22 = ₹4,378
  assert.equal(q.pricePerMealPaise, 19900);
  assert.equal(q.mealsPerCycle, 22);
  // GST split (5% inclusive): preTax = round(437800/1.05), gst = remainder
  assert.equal(q.preTaxPaise, 416952);
  assert.equal(q.gstPaise, 437800 - 416952);
  assert.equal(q.preTaxPaise + q.gstPaise, q.cycleTotalPaise); // no double-count
});

test("computePlanQuote — flat plans use flatPricePaise", () => {
  assert.equal(computePlanQuote("glp1_companion").cycleTotalPaise, 599900);
  assert.equal(computePlanQuote("trial_3day").cycleTotalPaise, 39900);
  assert.equal(computePlanQuote("protein_build").cycleTotalPaise, 24900 * 22);
});

test("self-service launch gate: only `live` plans are bookable", () => {
  assert.equal(planIsSelfServiceLaunchable("desk_fuel"), true);
  assert.equal(planIsSelfServiceLaunchable("protein_build"), true);
  assert.equal(planIsSelfServiceLaunchable("trial_3day"), true);
  assert.equal(planIsSelfServiceLaunchable("steady"), false); // blocked_pending_skus
  assert.equal(planIsSelfServiceLaunchable("glp1_companion"), false);
  assert.equal(planIsSelfServiceLaunchable("teams"), false); // sales_led
});

test("planServesTrack never widens a plan's tracks", () => {
  assert.equal(planServesTrack("steady", "veg"), false);
  assert.equal(planServesTrack("steady", "nonveg"), true);
  assert.equal(planServesTrack("glp1_companion", "veg"), false);
  assert.equal(planServesTrack("desk_fuel", "egg"), true);
});

// ── §2 router map (02d §2) ───────────────────────────────────────────────────
test("router exposes exactly the 4 router-reachable plans", () => {
  const ids = ROUTER_ANSWER_TO_PLAN.map((r) => r.planId).sort();
  assert.deepEqual(ids, ["desk_fuel", "glp1_companion", "protein_build", "steady"]);
  // teams (null) and trial_3day (secondary CTA) are not router-reachable
  assert.ok(!ids.includes("teams" as never));
  assert.ok(!ids.includes("trial_3day" as never));
});

// ── §3.5 fixed trial trios exist and are servable ────────────────────────────
test("both trial trios are complete and servable in the live catalog", () => {
  for (const track of ["veg", "nonveg"] as const) {
    const state = trackLaunchState("trial_3day", track, DISHES);
    assert.equal(state.canLaunch, true, `${track} trio should launch`);
    assert.equal(state.poolSize, TRIAL_TRIOS[track].length);
  }
});

// ── §3/§7 pool queries against the REAL catalog (verified-findings guards) ────
test("desk_fuel pools are fillable for veg and nonveg", () => {
  assert.ok(poolForPlan("desk_fuel", "veg", DISHES).length > 0);
  assert.ok(poolForPlan("desk_fuel", "nonveg", DISHES).length > 0);
});

test("GLP-1 veg pool is EMPTY from the current catalog (data gap H2) — track not offered", () => {
  // The lean-high-protein query (protein≥25 ∧ kcal≤450) yields zero veg dishes
  // today; this is exactly why 02e narrows glp1 dietTracks to egg+nonveg.
  assert.equal(poolForPlan("glp1_companion", "veg", DISHES).length, 0);
  assert.ok(!PLAN_CATALOG.glp1_companion.dietTracks.includes("veg"));
  const veg = trackLaunchState("glp1_companion", "veg", DISHES);
  assert.equal(veg.canLaunch, false);
});

test("steady veg track is not served even though some low-GI veg dishes exist", () => {
  // Honest narrowing: config, not data availability, gates the veg track off.
  const veg = trackLaunchState("steady", "veg", DISHES);
  assert.equal(veg.canLaunch, false);
  assert.ok(veg.reasons.some((r) => r.includes("not served")));
});

test("protein_build nonveg pool is protein-ranked and includes the hero SKU", () => {
  const pool = poolForPlan("protein_build", "nonveg", DISHES);
  assert.ok(pool.length > 0);
  // ranked descending by protein
  for (let i = 1; i < pool.length; i++) {
    assert.ok(pool[i - 1].macros.protein >= pool[i].macros.protein);
  }
  assert.ok(
    pool.some((d) => d.slug === "roast-chicken-russian"),
    "hero SKU Roast Chicken Russian (P36) should be in the pool",
  );
});

test("isServable treats absent rdReviewState as reviewed and honours availability", () => {
  const sample = DISHES.find((d) => d.slug === "roast-chicken-russian")!;
  assert.equal(isServable(sample), true);
  assert.equal(isServable({ ...sample, isAvailable: false }), false);
  assert.equal(isServable({ ...sample, rdReviewState: "blocked" }), false);
  assert.equal(isServable({ ...sample, rdReviewState: "pending_review" }), false);
});

// ── §2 Variant pricing deltas (02e Table II.1) ────────────────────────────────
test("PLAN_PRICE_TABLE and computePlanQuote exactly match Table II.1 variant totals", () => {
  // desk_fuel variants
  const dfVeg = computePlanQuote("desk_fuel", "veg");
  assert.equal(dfVeg.pricePerMealPaise, 19900);
  assert.equal(dfVeg.cycleTotalPaise, 437800);

  const dfEgg = computePlanQuote("desk_fuel", "egg");
  assert.equal(dfEgg.pricePerMealPaise, 20900);
  assert.equal(dfEgg.cycleTotalPaise, 459800);

  const dfNonveg = computePlanQuote("desk_fuel", "nonveg");
  assert.equal(dfNonveg.pricePerMealPaise, 21900);
  assert.equal(dfNonveg.cycleTotalPaise, 481800);

  // protein_build variants
  const pbVeg = computePlanQuote("protein_build", "veg");
  assert.equal(pbVeg.pricePerMealPaise, 24900);
  assert.equal(pbVeg.cycleTotalPaise, 547800);

  const pbEgg = computePlanQuote("protein_build", "egg");
  assert.equal(pbEgg.pricePerMealPaise, 25900);
  assert.equal(pbEgg.cycleTotalPaise, 569800);

  const pbNonveg = computePlanQuote("protein_build", "nonveg");
  assert.equal(pbNonveg.pricePerMealPaise, 27900);
  assert.equal(pbNonveg.cycleTotalPaise, 613800);

  // steady (single variant nonveg)
  const stNonveg = computePlanQuote("steady", "nonveg");
  assert.equal(stNonveg.pricePerMealPaise, 22900);
  assert.equal(stNonveg.cycleTotalPaise, 503800);
});

test("variant delta invariants: egg is veg + ₹10; non-veg is +₹20 (Desk Fuel) or +₹30 (Protein Build)", () => {
  const df = PLAN_PRICE_TABLE.desk_fuel;
  assert.equal(df.egg.perMealPaise, df.veg.perMealPaise! + 1000, "desk_fuel egg delta must be +₹10/meal");
  assert.equal(df.nonveg.perMealPaise, df.veg.perMealPaise! + 2000, "desk_fuel nonveg delta must be +₹20/meal");

  const pb = PLAN_PRICE_TABLE.protein_build;
  assert.equal(pb.egg.perMealPaise, pb.veg.perMealPaise! + 1000, "protein_build egg delta must be +₹10/meal");
  assert.equal(pb.nonveg.perMealPaise, pb.veg.perMealPaise! + 3000, "protein_build nonveg delta must be +₹30/meal");
});

test("GST identity gst = total − round(total/1.05) holds for all plan and variant quotes", () => {
  const testCases: Array<[string, string]> = [
    ["desk_fuel", "veg"],
    ["desk_fuel", "egg"],
    ["desk_fuel", "nonveg"],
    ["protein_build", "veg"],
    ["protein_build", "egg"],
    ["protein_build", "nonveg"],
    ["steady", "nonveg"],
    ["glp1_companion", "nonveg"],
    ["teams", "veg"],
    ["trial_3day", "veg"],
  ];

  for (const [planId, track] of testCases) {
    const q = computePlanQuote(planId as any, track as any);
    const expectedPreTax = Math.round(q.cycleTotalPaise / 1.05);
    const expectedGst = q.cycleTotalPaise - expectedPreTax;
    assert.equal(q.preTaxPaise, expectedPreTax, `preTax mismatch for ${planId} (${track})`);
    assert.equal(q.gstPaise, expectedGst, `gst mismatch for ${planId} (${track})`);
  }
});

