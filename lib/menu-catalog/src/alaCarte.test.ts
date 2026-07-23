import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DISHES,
  AL_A_CARTE_HERO_SLUGS,
  STATIC_ALA_CARTE_HERO_SLUGS,
  LIVE_ALA_CARTE_HERO_SLUGS,
  isAlaCarteEnabled,
} from "./index";

// À la carte is the curated hero subset — widened to ≥50 offerings (menu goes
// à-la-carte-only), split into two validated tiers: STATIC heroes resolve
// against this package's DISHES snapshot; LIVE heroes exist only in the
// DB-merged catalog (deployed-menu verification covers them, so a slug here
// must NOT shadow a static dish — that would belong in the static tier).

test("every static-tier hero slug resolves to a real catalog dish", () => {
  const bySlug = new Set(DISHES.map((d) => d.slug));
  for (const slug of STATIC_ALA_CARTE_HERO_SLUGS) {
    assert.ok(bySlug.has(slug), `static hero "${slug}" is not a catalog dish`);
  }
});

test("live-tier heroes are DB-only — none shadows a static catalog dish", () => {
  const bySlug = new Set(DISHES.map((d) => d.slug));
  for (const slug of LIVE_ALA_CARTE_HERO_SLUGS) {
    assert.ok(
      !bySlug.has(slug),
      `live hero "${slug}" is in the static catalog — move it to the static tier`,
    );
  }
});

test("the combined set meets the ≥50-offering commitment with no tier overlap", () => {
  assert.ok(
    AL_A_CARTE_HERO_SLUGS.size >= 50,
    `à la carte must offer at least 50 dishes (got ${AL_A_CARTE_HERO_SLUGS.size})`,
  );
  assert.equal(
    AL_A_CARTE_HERO_SLUGS.size,
    STATIC_ALA_CARTE_HERO_SLUGS.length + LIVE_ALA_CARTE_HERO_SLUGS.length,
    "tiers must not overlap or repeat slugs",
  );
});

test("isAlaCarteEnabled is true only for heroes", () => {
  const hero = DISHES.find((d) => AL_A_CARTE_HERO_SLUGS.has(d.slug));
  const nonHero = DISHES.find((d) => !AL_A_CARTE_HERO_SLUGS.has(d.slug));
  assert.ok(hero && nonHero, "catalog must contain both hero and non-hero dishes");
  assert.equal(isAlaCarteEnabled(hero!), true);
  assert.equal(isAlaCarteEnabled(nonHero!), false);
});
