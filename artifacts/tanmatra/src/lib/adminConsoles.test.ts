import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADMIN_CONSOLES,
  ALL_ADMIN_CONSOLES,
  consoleForPath,
} from "./adminConsoles.js";

/**
 * Route ↔ catalogue parity.
 *
 * The catalogue is the ONLY way an operator discovers a console — there is no
 * sitemap and no search over these pages. So a route that exists but is listed
 * nowhere is, in practice, a page that does not exist: /admin/kds (the kitchen
 * display) and /admin/supplier (crate traceability) were both routed, both
 * rendered, and both absent from the index, reachable only by typing the URL.
 * That is the drift this asserts away, in both directions.
 *
 * routes.ts is parsed rather than duplicated here on purpose. A hand-copied
 * list of routes would be a third place to drift, and it would go stale
 * silently — the same failure mode being fixed.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_FILE = path.resolve(HERE, "..", "routes.ts");

/**
 * Paths that are routed but deliberately NOT catalogue entries, each with the
 * reason. Anything else routed must be listed, or this file fails.
 */
const NOT_A_CONSOLE = new Map<string, string>([
  ["/admin", "the console index itself"],
  ["/admin/sales-console/:slug", "detail view of the listed sales console"],
  ["/admin/login", "auth surface, reached when signed out"],
  ["/login", "legacy alias of /admin/login"],
]);

function routedPaths(): string[] {
  const source = fs.readFileSync(ROUTES_FILE, "utf8");
  const found = new Set<string>();
  // route("admin/ops", "pages/AdminOpsDashboard.tsx", …)
  for (const m of source.matchAll(/\broute\(\s*"([^"]+)"/g)) {
    const raw = m[1];
    if (!raw || raw === "*") continue;
    found.add(raw.startsWith("/") ? raw : `/${raw}`);
  }
  return [...found];
}

test("every routed console appears in the catalogue", () => {
  const listed = new Set(ALL_ADMIN_CONSOLES.map((c) => c.path));
  const missing = routedPaths().filter(
    (p) => !listed.has(p) && !NOT_A_CONSOLE.has(p),
  );
  assert.deepEqual(
    missing,
    [],
    `routed but unreachable from the console index: ${missing.join(", ")}. ` +
      "Add it to ADMIN_CONSOLES, or to NOT_A_CONSOLE with a reason.",
  );
});

test("every catalogue entry points at a real route", () => {
  const routed = new Set(routedPaths());
  const dangling = ALL_ADMIN_CONSOLES.map((c) => c.path).filter(
    (p) => !routed.has(p),
  );
  assert.deepEqual(
    dangling,
    [],
    `catalogue links with no route (they would 404): ${dangling.join(", ")}`,
  );
});

test("the two consoles that were unreachable are listed", () => {
  // Named explicitly so a future edit that drops them fails with the reason
  // rather than just shrinking a set.
  const listed = new Set(ALL_ADMIN_CONSOLES.map((c) => c.path));
  assert.ok(listed.has("/admin/kds"), "/admin/kds must stay linked");
  assert.ok(listed.has("/admin/supplier"), "/admin/supplier must stay linked");
});

test("catalogue paths are unique", () => {
  const paths = ALL_ADMIN_CONSOLES.map((c) => c.path);
  assert.equal(
    new Set(paths).size,
    paths.length,
    "a duplicated path would render two nav pills that both look active",
  );
});

test("every entry carries a nav label short enough for the rail", () => {
  for (const item of ALL_ADMIN_CONSOLES) {
    assert.ok(item.navLabel.length > 0, `${item.path} has no navLabel`);
    // The rail is a single non-wrapping row; long labels push the tail of it
    // off-screen on the ops tablet the KDS runs on.
    assert.ok(
      item.navLabel.length <= 12,
      `${item.path} navLabel "${item.navLabel}" is too long for the nav rail`,
    );
  }
});

test("consoleForPath resolves a detail route to its parent console", () => {
  // /admin/sales-console/:slug has no catalogue entry of its own; the shell
  // must still name the section rather than going blank on a drilldown.
  assert.equal(
    consoleForPath("/admin/sales-console/acme-foods")?.path,
    "/admin/sales-console",
  );
  assert.equal(consoleForPath("/admin/ops")?.path, "/admin/ops");
  assert.equal(consoleForPath("/admin/ops/")?.path, "/admin/ops");
});

test("consoleForPath returns null where no console owns the path", () => {
  assert.equal(consoleForPath("/admin"), null);
  assert.equal(consoleForPath("/admin/login"), null);
  assert.equal(consoleForPath("/"), null);
});

test("consoleForPath does not match on a shared prefix", () => {
  // "/admin/ops" is a prefix of "/admin/ops-agent" as a STRING. Matching on
  // bare startsWith would have made the Ops Agent page report itself as the
  // Ops Dashboard in the shell's breadcrumb and highlighted the wrong pill.
  assert.equal(consoleForPath("/admin/ops-agent")?.path, "/admin/ops-agent");
});

test("groups are non-empty and titled", () => {
  assert.ok(ADMIN_CONSOLES.length > 0);
  for (const group of ADMIN_CONSOLES) {
    assert.ok(group.section.length > 0, "a group with no heading");
    assert.ok(group.items.length > 0, `${group.section} has no consoles`);
  }
});
