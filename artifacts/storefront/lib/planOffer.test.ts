/**
 * Law 1 — show first, ask second — and Law 8 on what gets shown.
 *
 * The plan checkout's first ask is the PIN code (the gate that landed with the
 * serviceability fix). Above it stood the plan's name and nothing else, so the
 * journey's first question preceded every fact that makes answering worthwhile:
 * which dishes arrive, when they arrive, what it costs.
 *
 * These tests hold the line that the answer is READ rather than authored — the
 * dishes come from the plan's real rotation, the window from the constant the
 * create call books with — because a preview that drifts from what the system
 * does is worse than no preview at all on a page whose whole claim is precision.
 *
 * Run: node --test --import tsx ./lib/planOffer.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { DISHES } from "@workspace/menu-catalog";
import { poolForPlan } from "@workspace/subscription-rules";
import { planOfferDishes } from "./planOffer";
import {
  PLAN_DELIVERY_DAYS_LABEL,
  PLAN_DELIVERY_WINDOW,
  PLAN_DELIVERY_WINDOW_LABEL,
  nextWeekdayISO,
} from "./planCheckout";

const HERE = path.dirname(fileURLToPath(import.meta.url));

test("the sample comes out of the plan's real rotation", () => {
  const { dishes } = planOfferDishes("steady", ["veg"], DISHES, 4);
  assert.ok(dishes.length > 0, "the steady plan must have something to show");
  const rotation = new Set(poolForPlan("steady", "veg", DISHES).map((d) => d.slug));
  for (const d of dishes) {
    assert.ok(rotation.has(d.slug), `${d.slug} is not in what this plan actually rotates`);
  }
});

test("macros are the dishes' own, not restated", () => {
  const { dishes } = planOfferDishes("steady", ["veg"], DISHES, 4);
  for (const d of dishes) {
    const source = DISHES.find((x) => x.slug === d.slug);
    assert.ok(source);
    assert.equal(d.macros.calories, source.macros.calories);
    assert.equal(d.macros.protein, source.macros.protein);
  }
});

test("a dish sharing its macro tuple with another is never used as evidence", () => {
  // The half macrosProvisional cannot see. Two unrelated dishes cannot have
  // measured their way to a byte-identical quadruple; one is wrong and we
  // cannot tell which, so neither may be shown as fact on the screen that
  // exists to be checked.
  // Must be a dish the plan ACTUALLY rotates, or the assertion passes for the
  // wrong reason — the first draft duplicated DISHES[0], which steady does not
  // carry, so it held even with the old macrosProvisional-only filter.
  const inPool = poolForPlan("steady", "veg", DISHES)[0];
  assert.ok(inPool, "steady must rotate something for this rule to have a case");
  const before = planOfferDishes("steady", ["veg", "egg", "nonveg"], DISHES, 50);
  assert.ok(
    before.dishes.some((d) => d.slug === inPool.slug),
    "the chosen dish must be offered BEFORE a duplicate exists",
  );

  const dupe = { ...inPool, slug: `${inPool.slug}-dupe`, name: `${inPool.name} (dupe)` };
  const { dishes } = planOfferDishes("steady", ["veg", "egg", "nonveg"], [...DISHES, dupe], 50);
  assert.ok(
    !dishes.some((d) => d.slug === inPool.slug),
    "a dish whose macro tuple is now shared must stop being offered as evidence",
  );
});

test("a provisional dish is never used as evidence", () => {
  // The one screen whose purpose is to be checked cannot be built on a
  // placeholder bucket. Same rule planCardDish applies to the landing cards.
  const provisional = DISHES.filter((d) => d.macrosProvisional).map((d) => d.slug);
  assert.ok(provisional.length > 0, "no provisional dish in the catalog — this rule has no live case");
  for (const plan of ["steady", "desk_fuel", "protein_build"] as const) {
    const { dishes } = planOfferDishes(plan, ["veg", "egg", "nonveg"], DISHES, 20);
    for (const d of dishes) {
      assert.ok(!provisional.includes(d.slug), `${d.slug} has placeholder macros and must not be shown here`);
    }
  }
});

test("no dish appears twice across tracks", () => {
  const { dishes } = planOfferDishes("steady", ["veg", "egg", "nonveg"], DISHES, 20);
  const slugs = dishes.map((d) => d.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("the remainder is counted, not hidden", () => {
  const all = planOfferDishes("steady", ["veg", "egg", "nonveg"], DISHES, 100);
  const sampled = planOfferDishes("steady", ["veg", "egg", "nonveg"], DISHES, 2);
  assert.equal(sampled.dishes.length, Math.min(2, all.dishes.length));
  assert.equal(sampled.more, Math.max(0, all.dishes.length - 2));
});

test("an empty rotation yields an empty sample, not a substitute", () => {
  // The card renders nothing rather than borrowing another plan's dish — the
  // habit planCardDish was written to remove.
  const { dishes, more } = planOfferDishes("steady", ["veg"], [], 4);
  assert.deepEqual(dishes, []);
  assert.equal(more, 0);
});

test("the sample is deterministic", () => {
  const a = planOfferDishes("protein_build", ["veg"], DISHES, 3);
  const b = planOfferDishes("protein_build", ["veg"], DISHES, 3);
  assert.deepEqual(a, b);
});

test("the window shown is the window booked", () => {
  // Three surfaces had hand-typed "12:30–1:30" beside a constant reading
  // "12:30–13:30". They agreed by luck. The label is derived now, so the two
  // cannot part company.
  const [from, to] = PLAN_DELIVERY_WINDOW.split(/[–-]/);
  assert.ok(from && to);
  assert.match(PLAN_DELIVERY_WINDOW_LABEL, new RegExp(from.replace(":", ":")));
  const [toH = "0", toM = "00"] = to.split(":");
  const to12 = Number(toH) % 12 === 0 ? 12 : Number(toH) % 12;
  assert.match(
    PLAN_DELIVERY_WINDOW_LABEL,
    new RegExp(`${to12}:${toM}`),
    "the closing time must survive the 12-hour rendering",
  );
  assert.match(PLAN_DELIVERY_WINDOW_LABEL, /pm|am/, "a 12-hour time without a suffix is ambiguous");
});

test("no customer surface hand-types the delivery window", () => {
  // The three that did agreed with the booked constant by luck. This is the
  // guard that keeps them agreeing on purpose.
  const roots = [path.join(HERE, "..", "components"), path.join(HERE, "..", "app")];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "quarantine") continue;
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      const src = fs.readFileSync(full, "utf8");
      // Any clock range in the plan's delivery hours, however it is punctuated.
      if (/12:30\s*(&ndash;|–|-)\s*1?:?\d/.test(src)) offenders.push(path.relative(HERE, full));
    }
  };
  for (const r of roots) walk(r);
  assert.deepEqual(
    offenders,
    [],
    `import PLAN_DELIVERY_WINDOW_LABEL instead of typing the window: ${offenders.join(", ")}`,
  );
});

test("the days shown are the days delivered", () => {
  // Not an assertion of intent: nextWeekdayISO skips Saturday and Sunday when
  // it picks the start date, so weekday-only is what the code does.
  for (const iso of ["2026-08-14", "2026-08-15", "2026-08-16"]) {
    const day = new Date(`${nextWeekdayISO(new Date(`${iso}T12:00:00Z`))}T12:00:00Z`).getUTCDay();
    assert.ok(day >= 1 && day <= 5, `${iso} produced a weekend start date`);
  }
  assert.match(PLAN_DELIVERY_DAYS_LABEL, /weekday/i);
});

test("the preview renders above the first ask, not after it", () => {
  // The ordering IS the law. A preview below the PIN field would satisfy every
  // other test here and none of the requirement.
  const src = fs.readFileSync(
    path.join(HERE, "..", "components", "checkout", "plan", "PlanCheckout.tsx"),
    "utf8",
  );
  const preview = src.indexOf("<PlanOfferPreview");
  const gate = src.indexOf("<PlanServiceabilityGate");
  assert.ok(preview > 0, "the preview must be rendered");
  assert.ok(gate > 0);
  assert.ok(preview < gate, "the offer must render before the serviceability gate");
});

test("the preview shows no price it authored itself", () => {
  // Every amount on this screen is the spine's, passed in. A component that
  // could compute one would be a second pricing authority.
  const src = fs.readFileSync(
    path.join(HERE, "..", "components", "checkout", "plan", "PlanOfferPreview.tsx"),
    "utf8",
  );
  assert.doesNotMatch(src, /[*+\-/]\s*100\b/, "no paise arithmetic belongs in a display component");
  assert.match(src, /offer\.cycleTotalPaise/, "the total must come from the passed offer");
});
