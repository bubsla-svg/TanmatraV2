import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The Menu Catalog "Add/Edit Menu Item" dialog had two independent bugs:
 *
 * 1. Every fetch in this page omitted `credentials: "include"`. In
 *    production this page's API calls go cross-origin (API_BASE points at
 *    the raw wellness-foods Cloud Run URL, not tanmatra.food itself), so the
 *    signed admin session cookie was never sent. An operator signed in
 *    through the normal /admin/login flow — the only flow that exists —
 *    could not load the item list, create a dish, or edit one; every
 *    sibling admin console (AdminOpsAgent, AdminCmsAgent, ...) already gets
 *    this right. Parsed rather than imported/rendered: this page has hooks,
 *    fetch, and window/localStorage calls with no RTL harness in this repo
 *    (node:test has no DOM), matching the parse-don't-import pattern
 *    established by adminConsoles.test.ts and opsAgentWiring.test.ts.
 *
 * 2. The form only captured name/price/category/kitchen/GI/allergen-state,
 *    so a created dish could never carry the fields the storefront dish
 *    page actually renders (description, tags, ingredients, ...) even
 *    though the API already accepted and returned them.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AdminCatalog.tsx"), "utf8");

test("every menu/items fetch sends credentials so the admin session cookie is included", () => {
  const fetchCallCount = (SRC.match(/fetch\(`\$\{API_BASE\}\/api\/menu\/items/g) ?? [])
    .length;
  assert.equal(fetchCallCount, 4, "expected load/unpause/create/edit fetch calls");

  // Scan each fetch call's own option block (up to the next top-level
  // fetch(...) or end of file) rather than the whole file, so this can't
  // pass by finding one correct call while the others regressed.
  const starts = [...SRC.matchAll(/fetch\(`\$\{API_BASE\}\/api\/menu\/items[^`]*`,\s*\{/g)].map(
    (m) => m.index,
  );
  assert.equal(starts.length, 4);
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : SRC.length;
    const block = SRC.slice(start, end);
    assert.match(
      block,
      /credentials:\s*"include"/,
      `menu/items fetch call #${i + 1} must send credentials: "include"`,
    );
  }
});

test("the load-items effect does not gate on a manually-entered admin token", () => {
  // Regression for the specific shape of the bug: `if (!adminToken) return;`
  // guarding loadItems() meant the catalog never loaded for anyone using
  // the standard cookie login, since nothing in this page ever populates
  // the legacy x-admin-token localStorage key.
  const effectStart = SRC.indexOf("useEffect(() => {");
  const effectBody = SRC.slice(effectStart, SRC.indexOf("}, [adminToken, q]);"));
  assert.doesNotMatch(effectBody, /if \(!adminToken\) return/);
  assert.match(effectBody, /loadItems\(\);/);
});

test("create and edit payloads carry the dish-detail fields the storefront renders", () => {
  const saveStart = SRC.indexOf("async function saveItem()");
  assert.notEqual(saveStart, -1);
  const saveBody = SRC.slice(saveStart);

  const postStart = saveBody.indexOf('method: "POST"');
  const patchStart = saveBody.indexOf('method: "PATCH"');
  assert.ok(postStart !== -1 && patchStart !== -1 && postStart < patchStart);

  const postBody = saveBody.slice(postStart, patchStart);
  const patchBody = saveBody.slice(patchStart);

  // POST /menu/items' createSchema accepts these; the PATCH-only fields
  // (ingredients, prepTime, sugarPerServing) are intentionally absent here.
  for (const field of ["description", "tags"]) {
    assert.match(postBody, new RegExp(`${field}:`), `POST body must include ${field}`);
  }
  // PATCH /menu/items/:slug's patchSchema accepts all of these.
  for (const field of ["description", "tags", "ingredients", "prepTime", "sugarPerServing"]) {
    assert.match(patchBody, new RegExp(`${field}:`), `PATCH body must include ${field}`);
  }
});

test("MenuItem carries the fields the storefront dish page renders", () => {
  const interfaceStart = SRC.indexOf("interface MenuItem {");
  const interfaceBody = SRC.slice(interfaceStart, SRC.indexOf("\n}", interfaceStart));
  for (const field of ["description", "tags", "ingredients", "prepTime", "sugarPerServing"]) {
    assert.match(interfaceBody, new RegExp(`\\b${field}\\b`));
  }
});
