/**
 * Cross-surface PRICING INVARIANTS for the storefront (WEB-APP-ENHANCEMENT-PLAN
 * Tier 3 item 22). A proactive structural guard, not a fix for a known bug.
 *
 * `docs/illogical-instances-register.md` §A/§D documents the failure mode this
 * prevents: several competing price constructs alive at once, each component
 * internally honest, nothing asserting they agree. A per-surface audit is blind
 * to that; only a test spanning surfaces sees it. §D.4 prescribes exactly this
 * test ("card price == wizard price, one trial value everywhere, no
 * legacy-constant reads"). Chain under test:
 *   PLAN_PRICE_TABLE → computePlanQuote()      [spine — what the server bills]
 *     → planQuoteView() / getPlanBuilderData() [what a card / builder shows]
 *       → checkoutTotalWithAddOns()            [what /checkout composes]
 *         → formatPaise()                      [what the customer reads]
 *
 * Assertions are TABLE-DRIVEN over the whole catalogue, so a plan added
 * tomorrow is covered without touching this file — spot-checking two plans is
 * what let §A happen.
 * DEBT REGISTER: four invariants do not hold today. They are PINNED below
 * rather than softened, on the discipline of `scripts/test-reach-baseline.txt`
 * — the register only SHRINKS. Fixing a registered defect makes its entry
 * stale, and a stale entry fails the last test here, so the register cannot
 * outlive the debt. Each entry names the file and the number.
 * Run: node --test --import tsx ./lib/pricingInvariants.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAN_CATALOG, PLAN_PRICE_TABLE, ADD_ONS, TEAMS_SEAT_TIERS, BUILDER_DEFAULTS,
  TRIAL_CREDIT_PAISE, WEEKLY_PRICE_PAISE, MONTHLY_PRICE_PAISE, MAX_CADENCE_DISCOUNT_PCT,
  cadenceDiscountPct, computePlanQuote, planServesTrack,
  type PlanId, type DietTrack, type PlanQuote, type SubscriptionCadence,
} from "@workspace/subscription-rules";
// Relative imports only: lint:filecap bans "@/" inside lib/ because the bare
// node test runner cannot resolve it.
import { planQuoteView, getPlanBuilderData, planDisplay, DIET_TRACKS } from "./plans";
import { checkoutTotalWithAddOns, addOnView, planAllowsAddOn } from "./addons";
import { TRIAL_PRICE_PAISE, TRIAL_CREDITBACK_PAISE, TRIAL_COPY, planTotalAfterCredit } from "./trial";
import { formatPaise } from "./format";

const PLAN_IDS = Object.keys(PLAN_CATALOG) as PlanId[];
const ADD_ON_IDS = Object.keys(ADD_ONS) as (keyof typeof ADD_ONS)[];
const CADENCES: SubscriptionCadence[] = ["weekly", "fortnightly", "monthly", "quarterly"];
interface PriceRow {
  perMealPaise: number | null; weeklyTotalPaise: number | null; monthlyTotalPaise: number | null;
  quarterlyTotalPaise: number | null; flatPricePaise: number | null;
}
const PRICE_TABLE = PLAN_PRICE_TABLE as unknown as Record<string, Record<string, PriceRow>>;

// ── Debt register (only shrinks — see header) ────────────────────────────────
const DEBT: Record<string, string> = {
  "weekly-cycle-meal-basis":
    "computePlanQuote() derives a weekly cycle as round(mealsPerCycle/4) = 6 meals for a 22-weekday " +
    "month, but the ₹1,199/₹1,499 weekly tier is priced as 5 weekday lunches: per-meal x meals does " +
    "not reconcile, and 6 lunches do not fit a 5-weekday week (planCheckout.nextWeekdayISO).",
  "Section03B2BEnterprise.tsx ₹180":
    'components/landing/Section03B2BEnterprise.tsx renders "₹180 / meal" as an applied subsidy. No ' +
    "spine amount formats to ₹180 — the Teams ladder is ₹189/₹199/₹209 and the same site advertises " +
    '"from ₹189/meal". §A5: one product, several numbers.',
  'content/copy/plans.ts "Save 25%"':
    'plansCopy.cycles.prepaidQuarterly claims "Save 25%". MAX_CADENCE_DISCOUNT_PCT is 20 and the ' +
    "corpus quarterly tier is ~9% on the current weekly basis (~24% on a 5-meal one). §A7/E6 " +
    "overstatement, latent only because plansCopy is imported by nothing.",
  "SubsidyCalculator.tsx PER_MEAL_PAISE":
    "components/landing/SubsidyCalculator.tsx prices teams under 10 seats off the LEGACY ₹750/meal " +
    "list rate and 10+ seats off computeCorporateTeamsQuote (₹189-209): a 3.77x cliff at the 10-seat " +
    "boundary for one unchanged product. The slider starts at 5, so the branch is reachable.",
};
const debtSeen = new Set<string>();
function pinned(key: string): void {
  assert.ok(key in DEBT, `unregistered pin "${key}" — register it with a reason, or fix it`);
  debtSeen.add(key);
}

// ── Source scanning. Paths resolve from import.meta.url, never cwd: CI runs
// these from artifacts/api-server, `pnpm test` runs them from here. ──────────
const STOREFRONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "build"]);
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) out.push(...walk(path.join(dir, e.name)));
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}
/** Every non-test source file on the price-bearing surfaces, as [relPath, src]. */
function sources(): Array<[string, string]> {
  return ["app", "components", "content", "lib"]
    .flatMap((r) => walk(path.join(STOREFRONT, r)))
    .map((f) => [path.relative(STOREFRONT, f).split(path.sep).join("/"), fs.readFileSync(f, "utf8")]);
}
/** Comments are prose, and often quote a retired number on purpose. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
/** Every quote the storefront can put in front of a customer for `id`. */
function quotesFor(id: PlanId): PlanQuote[] {
  return [computePlanQuote(id), ...getPlanBuilderData(id).servedTracks.flatMap((t) => t.quotes)];
}
// 1 ── §D.4's headline invariant. Display adapters must DERIVE from the spine,
// never re-derive alongside it — that is how §A5 put four prices on one plan.
// Also: a "from" price must be the cheapest thing actually buyable.
test("every plan: card price == checkout base == computePlanQuote(), and is the cheapest served track", () => {
  assert.ok(PLAN_IDS.length > 0);
  for (const id of PLAN_IDS) {
    const cfg = PLAN_CATALOG[id];
    const view = planQuoteView(id);
    const spine = computePlanQuote(id);
    const checkout = checkoutTotalWithAddOns(id, []);
    assert.equal(view.cycleTotalPaise, spine.cycleTotalPaise, `${id}: card total != spine`);
    assert.equal(checkout.basePaise, spine.cycleTotalPaise, `${id}: checkout base != spine`);
    assert.equal(checkout.totalPaise, view.cycleTotalPaise, `${id}: checkout total != card`);
    assert.equal(view.mealsPerCycle, cfg.mealsPerCycle, `${id}: card meal count != catalogue`);
    assert.equal(view.perMealPaise, cfg.pricePerMealPaise, `${id}: card per-meal != catalogue`);
    // A priced plan must have display copy, or a surface renders a nameless
    // price (or crashes) the day it is added. Tracks are never widened either.
    assert.ok(planDisplay(id)?.name, `${id}: catalogued plan has no display copy`);
    assert.ok(view.servedTracks.length > 0, `${id}: no served track`);
    assert.deepEqual(view.servedTracks, cfg.dietTracks, `${id}: served tracks widened`);
    assert.deepEqual(DIET_TRACKS.filter((t) => planServesTrack(id, t)), view.servedTracks, `${id}: track disagreement`);
    const totals = view.servedTracks.map((t: DietTrack) => computePlanQuote(id, t).cycleTotalPaise);
    assert.equal(view.cycleTotalPaise, Math.min(...totals), `${id}: headline price is not the cheapest served track`);
  }
});

// 2 ── Per-meal x meals reconciles with the cycle total wherever both exist.
// A silent mismatch here is §A4's ₹260/meal ghost under a new name.
test("per-meal x meals-per-cycle reconciles with the cycle total", () => {
  for (const id of PLAN_IDS) {
    for (const [key, row] of Object.entries(PRICE_TABLE[id] ?? {})) {
      if (row.perMealPaise == null || row.monthlyTotalPaise == null) continue;
      assert.equal(row.perMealPaise * PLAN_CATALOG[id].mealsPerCycle, row.monthlyTotalPaise, `PLAN_PRICE_TABLE.${id}.${key}: per-meal x meals != monthly total`);
    }
    for (const q of quotesFor(id)) {
      if (q.pricePerMealPaise == null) continue; // flat-priced: nothing to reconcile
      const label = `${id}/${q.cycle}`;
      if (q.cycle === "weekly") { pinned("weekly-cycle-meal-basis"); continue; }
      if (q.cycle === PLAN_CATALOG[id].cycle) {
        assert.equal(q.pricePerMealPaise * q.mealsPerCycle, q.cycleTotalPaise, `${label}: authored per-meal does not multiply out`);
      } else {
        // Longer cycles carry a flat total and DERIVE the per-meal for display: it
        // must be that exact derivation, and multiplying it back may differ only by
        // the rounding residue — never by a re-priced amount.
        assert.equal(q.pricePerMealPaise, Math.round(q.cycleTotalPaise / q.mealsPerCycle), `${label}: per-meal not derived from the total`);
        assert.ok(Math.abs(q.pricePerMealPaise * q.mealsPerCycle - q.cycleTotalPaise) <= q.mealsPerCycle / 2, `${label}: rounding drift`);
      }
    }
  }
});

// 3 ── Paise are integers and the displayed rupee figure IS the charged one.
test("no rounding path can disagree with the spine — integers in, integers out", () => {
  const chargeable: number[] = [TRIAL_PRICE_PAISE, TRIAL_CREDIT_PAISE, WEEKLY_PRICE_PAISE, MONTHLY_PRICE_PAISE,
    BUILDER_DEFAULTS.weeklyEntryFloorPaise, BUILDER_DEFAULTS.weeklyEntryCeilPaise, ...ADD_ON_IDS.map((a) => ADD_ONS[a].pricePaise)];
  for (const id of PLAN_IDS) {
    for (const q of quotesFor(id)) {
      chargeable.push(q.cycleTotalPaise);
      // GST is inclusive and exact: two independent integer paths must agree,
      // and the parts must sum back to the whole (never a second 5% on top).
      assert.equal(q.preTaxPaise, Math.round(q.cycleTotalPaise / 1.05), `${id}/${q.cycle}: preTax`);
      assert.equal(q.preTaxPaise, Math.round((q.cycleTotalPaise * 100) / 105), `${id}/${q.cycle}: float drift in the GST split`);
      assert.equal(q.preTaxPaise + q.gstPaise, q.cycleTotalPaise, `${id}/${q.cycle}: GST does not sum back`);
      assert.ok(Number.isSafeInteger(q.gstPaise) && q.mealsPerCycle > 0, `${id}/${q.cycle}: bad gst/meal count`);
    }
  }
  for (const paise of chargeable) {
    assert.ok(Number.isSafeInteger(paise) && paise > 0, `${paise} is not a positive integer paise amount`);
    // Whole rupees, so formatPaise() is lossless: what the customer reads is
    // exactly what is charged, with no silent sub-rupee remainder.
    assert.equal(paise % 100, 0, `${paise}: not a whole number of rupees`);
    assert.equal(Number(formatPaise(paise).replace(/[₹,]/g, "")) * 100, paise, `formatPaise(${paise}) does not round-trip`);
  }
});

// 4 ── Add-ons are attached, never re-priced, and GST is not re-applied.
test("checkout composition: base + allow-listed plan-review add-ons, nothing else", () => {
  for (const id of PLAN_IDS) {
    const t = checkoutTotalWithAddOns(id, [...ADD_ON_IDS]);
    const expected = ADD_ON_IDS.filter((a) => planAllowsAddOn(id, a) && ADD_ONS[a].attachPoint === "plan_review");
    assert.deepEqual(t.items.map((i) => i.id), expected, `${id}: billed add-ons != allow-list ∩ plan_review`);
    for (const it of t.items) assert.equal(addOnView(it.id).pricePaise, ADD_ONS[it.id].pricePaise, `${id}/${it.id}: adapter re-prices`);
    assert.equal(t.addOnPaise, expected.reduce((s, a) => s + ADD_ONS[a].pricePaise, 0), `${id}: add-on subtotal`);
    // Exact sum — a re-applied 5% here is how a cart starts disagreeing with the
    // receipt (AGENT_WORKING_AGREEMENT §2). Post-purchase add-ons attach AFTER
    // the money event and never belong in a checkout total.
    assert.equal(t.totalPaise, t.basePaise + t.addOnPaise, `${id}: total is not base + add-ons`);
    assert.ok(!t.items.some((i) => ADD_ONS[i.id].attachPoint === "post_purchase"), `${id}: post-purchase add-on billed at checkout`);
  }
});

// 5 ── Exactly ONE trial price exists. Register §A3 found three.
test("the 3-Day Taste Test has exactly one price, everywhere it appears", () => {
  const trial = PLAN_CATALOG.trial_3day;
  const values = new Set<number>([
    TRIAL_PRICE_PAISE, TRIAL_CREDITBACK_PAISE, TRIAL_CREDIT_PAISE, trial.flatPricePaise ?? -1,
    PRICE_TABLE.trial_3day!.one_off!.flatPricePaise ?? -1, PRICE_TABLE.trial_3day!.one_off!.weeklyTotalPaise ?? -1,
    planQuoteView("trial_3day").cycleTotalPaise,
    checkoutTotalWithAddOns("trial_3day", [...ADD_ON_IDS]).totalPaise,
    ...trial.dietTracks.map((t) => computePlanQuote("trial_3day", t).cycleTotalPaise),
    ...getPlanBuilderData("trial_3day").servedTracks.flatMap((t) => t.quotes.map((q) => q.cycleTotalPaise)),
  ]);
  assert.deepEqual([...values], [TRIAL_PRICE_PAISE], `trial priced ${values.size} ways: ${[...values].join(", ")}`);
  // "All of it comes back" holds only while the credit cannot zero a real plan.
  assert.equal(TRIAL_CREDITBACK_PAISE, TRIAL_PRICE_PAISE);
  const cheapest = Math.min(...PLAN_IDS.filter((id) => id !== "trial_3day").flatMap((id) => quotesFor(id).map((q) => q.cycleTotalPaise)));
  assert.ok(TRIAL_CREDIT_PAISE < cheapest, `the credit (${TRIAL_CREDIT_PAISE}) is not smaller than the cheapest plan cycle (${cheapest})`);
  assert.ok(planTotalAfterCredit(cheapest) > 0, "the trial credit can zero out a real plan");
});

// 6 ── Trial copy states the trial price, not a remembered one.
test("every rupee figure in the trial copy is the trial price", () => {
  const expected = formatPaise(TRIAL_PRICE_PAISE);
  const found = Object.values(TRIAL_COPY).flatMap((l) => [...l.matchAll(/₹\s?[\d][\d,]*/g)].map((m) => m[0]));
  assert.ok(found.length > 0, "trial copy states no price — the regex or the copy moved");
  for (const lit of found) assert.equal(lit, expected, `trial copy says ${lit}, the trial costs ${expected}`);
});

// 7 ── The legacy cadence spine may not leak back onto plan surfaces.
// @workspace/subscription-rules still exports the pre-corpus cadence model
// (₹750/meal list, cadence discounts, computeTrialPricePaise → ₹1,499 for the
// same 3 meals the corpus prices at ₹399) — a different price BASIS. Mixing the
// two on one surface IS §A4/§A5.
test("no plan/trial/checkout surface imports the legacy cadence price constructs", () => {
  const LEGACY = ["PER_MEAL_PAISE", "CADENCE_DISCOUNT", "cadenceDiscountPct", "MAX_CADENCE_DISCOUNT_PCT", "TRIAL_DISCOUNT",
    "TRIAL_3DAY_SUBTOTAL_PAISE", "TRIAL_DAYS", "TRIAL_MEALS_PER_DAY", "TRIAL_MEALS", "computeDeliveryPricePaise", "computeTrialPricePaise"];
  // The server's change-plan route prices v1 subscriptions with this exact
  // function (api-server subscriptions.ts), so the preview mirrors the charge.
  const ALLOWED: Record<string, string> = { "components/account/ChangePlanPanel.tsx": "computeDeliveryPricePaise" };
  let imports = 0;
  for (const [rel, src] of sources()) {
    const bindings = [...src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']@workspace\/subscription-rules["']/g)]
      .flatMap((m) => m[1]!.split(",").map((b) => b.replace(/\btype\b/, "").trim()))
      .filter(Boolean);
    imports += bindings.length;
    for (const name of bindings.filter((b) => LEGACY.includes(b))) {
      if (ALLOWED[rel] === name) continue;
      if (rel === "components/landing/SubsidyCalculator.tsx" && name === "PER_MEAL_PAISE") { pinned("SubsidyCalculator.tsx PER_MEAL_PAISE"); continue; }
      assert.fail(`${rel} imports the legacy cadence construct "${name}" — price it from the plan spine`);
    }
  }
  assert.ok(imports > 20, `parsed only ${imports} spine imports — the scanner is broken, not the tree`);
});

// 8 ── Every rupee literal on a price surface is one the spine can produce.
test("no storefront surface states a rupee amount the spine cannot produce", () => {
  const vocabulary = new Set<string>();
  const add = (p: number | null | undefined): void => { if (typeof p === "number" && p > 0) vocabulary.add(formatPaise(p)); };
  for (const id of PLAN_IDS) {
    for (const q of quotesFor(id)) { add(q.cycleTotalPaise); add(q.pricePerMealPaise); }
    for (const row of Object.values(PRICE_TABLE[id] ?? {})) Object.values(row).forEach(add);
  }
  ADD_ON_IDS.forEach((a) => add(ADD_ONS[a].pricePaise));
  TEAMS_SEAT_TIERS.forEach((t) => Object.values(t.pricesPaise).forEach(add));
  [TRIAL_PRICE_PAISE, TRIAL_CREDIT_PAISE, WEEKLY_PRICE_PAISE, MONTHLY_PRICE_PAISE, BUILDER_DEFAULTS.weeklyEntryFloorPaise, BUILDER_DEFAULTS.weeklyEntryCeilPaise].forEach(add);
  // Not a price: the value-density denominator in "g protein per ₹100".
  const NON_PRICE = new Set(["₹100"]);
  let scanned = 0;
  for (const [rel, raw] of sources()) {
    for (const m of stripComments(raw).matchAll(/₹\s?[\d][\d,]*/g)) {
      const lit = m[0].replace(/\s/g, "");
      scanned++;
      if (vocabulary.has(lit) || NON_PRICE.has(lit)) continue;
      if (rel === "components/landing/Section03B2BEnterprise.tsx" && lit === "₹180") { pinned("Section03B2BEnterprise.tsx ₹180"); continue; }
      assert.fail(`${rel} hardcodes ${lit}, which no spine amount produces — derive it (formatPaise) instead`);
    }
  }
  assert.ok(scanned > 5, `found ${scanned} rupee literals — the scanner is broken, not the tree`);
});

// 9 ── A discount claim may not exceed what the billing math grants (§A7/E6).
test("subscription discount copy matches the subscription-rules constants", () => {
  const granted = new Set(CADENCES.map(cadenceDiscountPct));
  const CLAIM = /\b(?:save|saves|saving|savings|saved|discount|discounts|discounted|discounting|off)\b\D{0,24}?(\d{1,3})\s?%/gi;
  let claims = 0;
  for (const [rel, raw] of sources()) {
    // Scoped to copy that speaks for a subscription price: the copy deck, and
    // anything that reads the spine. A wholesale-margin line elsewhere is not a
    // cadence discount and is not this invariant's business.
    if (!rel.startsWith("content/copy/") && !raw.includes("@workspace/subscription-rules")) continue;
    for (const m of raw.matchAll(CLAIM)) {
      const pct = Number(m[1]);
      claims++;
      if (rel === "content/copy/plans.ts" && pct === 25) { pinned('content/copy/plans.ts "Save 25%"'); continue; }
      assert.ok(pct <= MAX_CADENCE_DISCOUNT_PCT, `${rel} claims ${pct}% — the billing math grants at most ${MAX_CADENCE_DISCOUNT_PCT}%`);
      assert.ok(granted.has(pct), `${rel} claims ${pct}%, which is no cadence's rate (${[...granted].join("/")}%)`);
    }
  }
  assert.ok(claims > 0, "found no discount claims at all — the scanner is broken, not the tree");
});
// 10 ── The register only shrinks.
test("debt register has no stale entries — a fixed defect must be de-registered", () => {
  assert.deepEqual([...debtSeen].sort(), Object.keys(DEBT).sort(), "a registered defect no longer reproduces (or never ran): remove its DEBT entry");
});
