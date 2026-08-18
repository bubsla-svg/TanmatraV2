/**
 * Gives lib/api-spec/openapi.yaml teeth.
 *
 * THIS REPO HAS TWO OPENAPI SPECS, and they are disjoint:
 *
 *   lib/api-spec/openapi.yaml     40 paths. Feeds Orval, which generates
 *                                 lib/api-client-react. Measured 2026-08-18:
 *                                 the server imports exactly one generated
 *                                 schema (HealthCheckResponse) and NO generated
 *                                 React Query hook is imported anywhere, so
 *                                 editing this file propagates to almost
 *                                 nothing. Until now nothing checked it either.
 *
 *   OPENAPI_SPEC_V1               39 paths, in routes/openApiContract.ts.
 *   (openApiContract.ts)          Served live at GET /v1/openapi.json and
 *                                 enforced against real routers by
 *                                 validateRouterContract in
 *                                 openApiContract.test.ts.
 *
 * Their overlap is ZERO paths. Neither references the other. That is the actual
 * contract risk: an engineer edits one believing it is "the" contract while the
 * other governs, and nothing objects.
 *
 * This file does not merge them — which spec survives is a product decision,
 * not a mechanical one. It closes the cheap half of the hole:
 *
 *   1. Every path openapi.yaml declares must actually be registered by the
 *      server. All 40 are today; this pins that, so renaming or deleting a
 *      route now fails here instead of leaving the yaml quietly describing an
 *      endpoint that no longer exists.
 *   2. Where the two specs ever describe the same path, they must not
 *      contradict each other. They are disjoint today; this catches the merge
 *      starting by accident rather than by decision.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/openApiSpecFile.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Route modules reach @workspace/db, whose module body throws when
// DATABASE_URL is absent. Set before the dynamic imports below; static
// `import` is hoisted and would run first. Nothing here issues a query — the
// routers are only inspected, never called.
process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const { default: apiRouter } = await import("./index");
const { OPENAPI_SPEC_V1 } = await import("./openApiContract");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = path.resolve(HERE, "../../../../lib/api-spec/openapi.yaml");

/** Express `:param` → OpenAPI `{param}`. */
function toOpenApiPath(p: string): string {
  return p.replace(/:([A-Za-z0-9_]+)/g, "{$1}").replace(/\/+/g, "/");
}

/** Every path registered on the mounted /api router tree. */
function registeredPaths(r: unknown, prefix = ""): string[] {
  const out: string[] = [];
  const stack = (r as { stack?: unknown[] })?.stack ?? [];
  for (const layer of stack as any[]) {
    if (layer.route?.path) {
      const raw = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const one of raw) out.push(toOpenApiPath(`${prefix}${one}`));
    } else if (layer.handle?.stack) {
      out.push(...registeredPaths(layer.handle, prefix));
    }
  }
  return out;
}

/**
 * Top-level keys of the yaml's `paths:` block.
 *
 * Deliberately a line scan rather than a YAML dependency: the block is
 * machine-generated in shape (two-space indent, one path per line, no anchors
 * or flow mappings), and this file exists to remove an unchecked dependency,
 * not to add one. If that shape ever changes, the count assertion below fails
 * loudly rather than silently matching nothing.
 */
function declaredPaths(yamlText: string): string[] {
  const out: string[] = [];
  let inPaths = false;
  for (const line of yamlText.split("\n")) {
    if (/^paths:\s*$/.test(line)) { inPaths = true; continue; }
    if (!inPaths) continue;
    if (line.trim() !== "" && !/^\s/.test(line)) break; // next top-level key
    const m = line.match(/^ {2}(\/\S*):\s*$/);
    if (m) out.push(m[1]!);
  }
  return out;
}

const specText = fs.readFileSync(SPEC_PATH, "utf8");
const declared = declaredPaths(specText);
const registered = new Set(registeredPaths(apiRouter));

test("the yaml's paths: block is still parseable by the scan above", () => {
  // Guards the regex, not the API: a silently-empty match would make every
  // other case in this file vacuously pass.
  assert.ok(
    declared.length >= 30,
    `expected the spec to declare a substantial path list, parsed ${declared.length}`,
  );
  assert.ok(registered.size >= 300, `expected the router tree to be walkable, found ${registered.size}`);
});

test("every path declared in openapi.yaml is actually registered by the server", () => {
  const orphans = declared.filter((p) => !registered.has(p));
  assert.deepEqual(
    orphans,
    [],
    `openapi.yaml declares ${orphans.length} path(s) the server does not register. ` +
      `Either the route was renamed/deleted and the spec was not updated, or the spec ` +
      `describes an endpoint that never shipped:\n  ${orphans.join("\n  ")}`,
  );
});

test("the two specs do not contradict each other where they overlap", () => {
  const live = new Set(Object.keys(OPENAPI_SPEC_V1.paths));
  const overlap = declared.filter((p) => live.has(p));

  // Zero today. This is not asserting they must STAY disjoint — merging them
  // is a legitimate outcome. It asserts that if a path lands in both, the two
  // descriptions agree on which methods it supports, so the merge cannot begin
  // by silently disagreeing.
  for (const p of overlap) {
    const fromLive = Object.keys(
      (OPENAPI_SPEC_V1.paths as Record<string, Record<string, unknown>>)[p] ?? {},
    ).filter((k) => ["get", "post", "put", "patch", "delete"].includes(k)).sort();

    const block = specText.split(new RegExp(`^ {2}${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*$`, "m"))[1] ?? "";
    const untilNextPath = block.split(/\n {2}\//)[0] ?? "";
    const fromYaml = Array.from(untilNextPath.matchAll(/^ {4}(get|post|put|patch|delete):/gm))
      .map((m) => m[1]!)
      .sort();

    assert.deepEqual(
      fromYaml,
      fromLive,
      `"${p}" is described by BOTH openapi.yaml and OPENAPI_SPEC_V1, and they ` +
        `disagree on its methods (yaml: ${fromYaml.join(",") || "none"}; ` +
        `live: ${fromLive.join(",") || "none"}). Reconcile them, or keep the path in one spec.`,
    );
  }
});
