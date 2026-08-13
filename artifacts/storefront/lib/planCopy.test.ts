// One name per plan, everywhere. Guards the fracture described in planCopy.ts.
//   cd artifacts/api-server && node --test --import tsx ../storefront/lib/planCopy.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { PLAN_CATALOG, type PlanId } from "@workspace/subscription-rules";
import { PLAN_DISPLAY, planDisplay } from "./planCopy";
import { PROTOCOL_CONFIG } from "../content/landing/protocol";

test("every plan in the spine has display copy, and no copy is orphaned", () => {
  const spineIds = Object.keys(PLAN_CATALOG).sort();
  const copyIds = Object.keys(PLAN_DISPLAY).sort();
  assert.deepEqual(copyIds, spineIds, "display copy and the plan spine must not drift");
  for (const id of spineIds as PlanId[]) {
    const d = planDisplay(id);
    assert.ok(d.name.trim(), `${id} needs a name`);
    assert.ok(d.promise.trim(), `${id} needs a promise`);
    assert.ok(d.subtitle.trim(), `${id} needs a subtitle`);
  }
});

test("plan names are unique — two plans sharing a name is the fracture in miniature", () => {
  const names = Object.values(PLAN_DISPLAY).map((d) => d.name);
  assert.equal(new Set(names).size, names.length);
});

test("every protocol lander points at a plan that exists", () => {
  for (const [key, cfg] of Object.entries(PROTOCOL_CONFIG)) {
    assert.ok(
      cfg.planId in PLAN_DISPLAY,
      `protocol "${key}" points at unknown plan "${cfg.planId}"`,
    );
  }
});

/**
 * The four names the fracture introduced. None is a plan, a protocol, or a
 * route — they were invented on the landing page, in the assessment result and
 * in a homepage rail, so a buyer picking one by name landed on a page titled
 * something else. If one reappears in a rendered surface, the funnel has
 * re-split and this fails.
 *
 * Scoped to the surfaces that SELL plans. It deliberately does not scan
 * lib/mealBundles.ts or lib/stitchRoutes.ts, where "5-Day Metabolic Reset" is
 * a meal bundle — a different product that may legitimately carry that name.
 */
const RETIRED_PLAN_NAMES = [
  "Weight-Loss Jumpstart",
  "PCOS Hormone Balance",
  "Lean Muscle Builder",
  "Metabolic Reset Protocol",
];

const SELLING_SURFACES = ["components/landing", "app/(global)/page.tsx"];

function filesUnder(rel: string): string[] {
  const abs = path.resolve(import.meta.dirname, "..", rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [abs];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? filesUnder(path.join(rel, e.name))
        : /\.tsx?$/.test(e.name) && !e.name.includes(".test.")
          ? [path.join(abs, e.name)]
          : [],
    );
}

test("no retired plan name is rendered by a plan-selling surface", () => {
  const offenders: string[] = [];
  for (const surface of SELLING_SURFACES) {
    for (const file of filesUnder(surface)) {
      const src = fs.readFileSync(file, "utf8");
      // Strip comments: these files explain the retired names on purpose.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const name of RETIRED_PLAN_NAMES) {
        if (code.includes(name)) offenders.push(`${path.basename(file)} → "${name}"`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `retired plan name(s) back in a selling surface — render planDisplay(id).name instead:\n  ${offenders.join("\n  ")}`,
  );
});
