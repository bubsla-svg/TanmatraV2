/**
 * The sitemap's dish section may advertise ONLY dishes the live API returned.
 *
 * Asserted against the SOURCE, not by importing the route. app/sitemap.ts is a
 * Next metadata route and imports through the "@/" alias; CI runs this suite as
 * `working-directory: artifacts/api-server` + `node --test --import tsx
 * "../storefront/lib/**\/*.test.ts"` (verify.yml, deploy.yml), where that alias
 * does not resolve — an import here would pass locally and die in CI with
 * ERR_MODULE_NOT_FOUND, the exact failure lint-filecap's ALIAS_NOTE describes.
 * fetchMenu()'s `source` discriminator itself is covered behaviourally in
 * catalog.test.ts.
 *
 * Known limit, accepted: this pins the guard's TEXT, so a semantically
 * equivalent rewrite (`if (source !== "fallback")`, an early return) would fail
 * it even though the behaviour is right. That is the cost of the repo's
 * source-assertion pattern, and it is why the assertions target code and never
 * the comment prose.
 *
 * Run: node --test --import tsx ./lib/sitemapDishSource.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITEMAP = fs.readFileSync(path.join(HERE, "..", "app", "sitemap.ts"), "utf8");

test("the dish section reads fetchMenu()'s source, not only its dishes", () => {
  assert.match(SITEMAP, /const \{ dishes, source \} = await fetchMenu\(\)/);
});

test("dish URLs are emitted only when the catalog came from the live API", () => {
  // The route is prerendered at `next build`, where API_BASE_URL is unset (a
  // Cloud Run runtime var, no Docker ARG), so fetchMenu() always returns the
  // 116-dish static fallback there. 32 of those slugs are not on the live menu
  // and answer HTTP 200 + `<title>Not Found</title>` + noindex — soft-404s
  // baked into a published sitemap. Empty is the honest failure.
  const guard = SITEMAP.indexOf('if (source === "api")');
  assert.notEqual(guard, -1, 'the dish block must gate on source === "api"');
  const mapping = SITEMAP.indexOf("/dish/${d.slug}");
  assert.ok(mapping > guard, "the /dish/ mapping must sit inside that guard");
});

test("only the menu has a non-empty cold-API fallback — every other collection returns []", () => {
  // The guard is needed for dishes alone because fetchMenu() substitutes the
  // static catalog. If one of these clients ever grows a fallback of its own,
  // its sitemap block inherits this defect and needs the same treatment.
  // getLegalDocuments is the sanctioned exception: its fallback is the bundled
  // content/legal registry that /legal/[slug] serves too, so those URLs resolve
  // whatever the API is doing.
  for (const client of ["recipesApi.ts", "challengesApi.ts", "teamApi.ts", "rdApi.ts"]) {
    const src = fs.readFileSync(path.join(HERE, client), "utf8");
    assert.match(src, /\} catch \{\s*return \[\];\s*\}/, `${client} must degrade to an empty list`);
  }
});
