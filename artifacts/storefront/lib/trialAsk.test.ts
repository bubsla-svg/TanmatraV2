/**
 * The 3-Day Taste Test: show what arrives, ask only what the purchase can use
 * (Laws 1, 7, 8).
 *
 * /trial is the cheapest way into this product and, for most buyers, the first
 * money they part with. It showed three photos and three names — no numbers at
 * all, on a product whose entire claim is that the numbers are known — said
 * nothing about when the food turns up, and then, at checkout, asked for the
 * buyer's medical conditions.
 *
 * Run: node --test --import tsx ./lib/trialAsk.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { DISHES } from "@workspace/menu-catalog";
import { TRIAL_TRIO } from "./trial";
import { memberDietForTrack, PLAN_DELIVERY_WINDOW_LABEL } from "./planCheckout";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = path.join(HERE, "..", "components");
const read = (...p: string[]) => fs.readFileSync(path.join(COMPONENTS, ...p), "utf8");

test("every trio dish can actually show its numbers", () => {
  // If the trial ever points at a placeholder-macro dish, the preview will
  // correctly show nothing for it — and that silence would be easy to miss.
  // Fail here instead, while it is still a choice of dish.
  for (const [track, slugs] of Object.entries(TRIAL_TRIO)) {
    for (const slug of slugs) {
      const dish = DISHES.find((d) => d.slug === slug);
      assert.ok(dish, `${track} trio references ${slug}, which is not in the catalog`);
      assert.notEqual(
        dish.macrosProvisional,
        true,
        `${slug} has placeholder macros — pick a dish whose numbers we stand behind, or the trio shows none`,
      );
      assert.ok(Number.isFinite(dish.macros.calories) && Number.isFinite(dish.macros.protein));
    }
  }
});

test("the trio renders macros, not just a photo and a name", () => {
  const src = read("trial", "TrialStart.tsx");
  assert.match(src, /formatMacroLine\(dish\.macros, dish\.macrosEstimated\)/);
});

test("a placeholder-macro dish would be omitted, never rendered as a figure", () => {
  const src = fs.readFileSync(path.join(HERE, "..", "app", "(focus)", "trial", "page.tsx"), "utf8");
  assert.match(src, /macrosProvisional === true/, "the trio resolver must gate on provenance");
});

test("the trial says when the food arrives", () => {
  // Law 1. It stated a price and a promise and left the buyer to find out the
  // rest after paying.
  const src = read("trial", "TrialStart.tsx");
  assert.match(src, /PLAN_DELIVERY_DAYS_LABEL/);
  assert.match(src, /PLAN_DELIVERY_WINDOW_LABEL/);
  assert.match(PLAN_DELIVERY_WINDOW_LABEL, /\d/, "the label must carry a real time");
});

test("the trial checkout does not ask for medical conditions", () => {
  // Law 7. A trial is three FIXED dishes (TRIAL_TRIO), bought one-off, with no
  // day plan and no swaps — every consumer of medicalConditions is a screening
  // path a trial never takes. It was collected, encrypted as clinical data at
  // rest, and read by nothing.
  const intake = read("checkout", "plan", "MemberIntake.tsx");
  assert.match(
    intake,
    /\{!minimal && \(\s*<input aria-label="Medical conditions"/,
    "the conditions input must be behind the minimal gate",
  );
  const checkout = read("checkout", "plan", "PlanCheckout.tsx");
  assert.match(checkout, /minimalIntake=\{planId === "trial_3day"\}/);
});

test("allergens are asked for on every path, trial included", () => {
  // The plan item said to drop these too. That is the one bullet worth
  // refusing: they are safety information about food someone is about to eat,
  // and the cost of not having them lands on the customer.
  const intake = read("checkout", "plan", "MemberIntake.tsx");
  const allergenInput = /<input aria-label="Allergens"/;
  assert.match(intake, allergenInput);
  // Not wrapped in a minimal gate the way conditions and diet are.
  assert.doesNotMatch(
    intake,
    /\{!minimal && \([\s\S]{0,80}?<input aria-label="Allergens"/,
    "allergens must never be gated off",
  );
});

test("a hidden diet select never submits the wrong diet", () => {
  // The draft defaults to "veg". With the select gone, submitting that default
  // beside a nonveg track would be a worse bug than the question it removed.
  assert.equal(memberDietForTrack("veg"), "veg");
  assert.equal(memberDietForTrack("nonveg"), "nonveg");
  // Neither strictly vegetarian nor omnivore — say so rather than guess.
  assert.equal(memberDietForTrack("egg"), "any");

  const details = read("checkout", "plan", "PlanDetails.tsx");
  assert.match(details, /diet: memberDietForTrack\(track\)/);
  assert.match(details, /draftToMember\(submittedMember\)/, "submit must use the derived member");
  assert.match(details, /conditions: ""/, "a stale conditions draft must not reach the wire");
});
