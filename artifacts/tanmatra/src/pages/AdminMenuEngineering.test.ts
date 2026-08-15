import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * decide() (the Approve/Dismiss handlers for pricing suggestions) used a
 * hardcoded relative path
 * (`/api/menu-engineering/pricing-suggestions/${id}/${action}`) instead of
 * API_BASE, unlike every other fetch in this file. In production API_BASE
 * points at the wellness-foods Cloud Run origin; a relative path instead
 * hits the tanmatra SPA's own origin, which has no /api routes — Approve and
 * Dismiss were dead buttons despite the backend write path
 * (approvePricingSuggestion, which updates menu_items.price_paise) working
 * correctly. Parsed rather than imported/rendered, matching the pattern in
 * AdminCatalog.test.ts.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AdminMenuEngineering.tsx"), "utf8");

test("decide() goes through API_BASE, not a hardcoded relative path", () => {
  const fnStart = SRC.indexOf("async function decide(");
  assert.notEqual(fnStart, -1);
  const fnBody = SRC.slice(fnStart, SRC.indexOf("\n  }", fnStart));
  assert.doesNotMatch(fnBody, /fetch\(\s*\n?\s*`\/api\//);
  assert.match(
    fnBody,
    /fetch\(\s*\n?\s*`\$\{API_BASE\}\/menu-engineering\/pricing-suggestions/,
  );
});

test("no fetch on this page doubles the /api segment already in API_BASE", () => {
  assert.doesNotMatch(SRC, /\$\{API_BASE\}\/api\//);
});

/**
 * decide()'s confirmation toast built the past tense by string concat
 * (`${action}d.`), which reads correctly for "approve" -> "approved" but
 * produces "Suggestion dismissd." for "dismiss" — found by actually
 * clicking Dismiss in a live browser. Cosmetic only (no functional
 * impact), but a wrong word in a confirmation toast is exactly the kind
 * of "does this look intentional" detail live verification exists to
 * catch that a source-only read of the diff can miss.
 */
test("decide()'s toast spells 'dismissed' correctly (not string-concat 'dismissd')", () => {
  const fnStart = SRC.indexOf("async function decide(");
  assert.notEqual(fnStart, -1);
  const fnBody = SRC.slice(fnStart, SRC.indexOf("\n  }", fnStart));
  assert.doesNotMatch(fnBody, /dismissd/);
  assert.match(fnBody, /dismissed/);
  assert.match(fnBody, /approved/);
});
