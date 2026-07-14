import assert from "node:assert/strict";
import { test } from "node:test";
import { DISHES, AL_A_CARTE_HERO_SLUGS, isAlaCarteEnabled } from "./index";

// Phase B1 — à la carte is the curated hero subset, not the full catalog.

test("every à la carte hero slug resolves to a real catalog dish", () => {
  const bySlug = new Set(DISHES.map((d) => d.slug));
  for (const slug of AL_A_CARTE_HERO_SLUGS) {
    assert.ok(bySlug.has(slug), `hero slug "${slug}" is not a catalog dish`);
  }
});

test("the à la carte set is a strict subset of the catalog (the 26 matched heroes)", () => {
  assert.equal(AL_A_CARTE_HERO_SLUGS.size, 26);
  assert.ok(
    AL_A_CARTE_HERO_SLUGS.size < DISHES.length,
    "à la carte must never be the whole menu",
  );
});

test("isAlaCarteEnabled is true only for heroes", () => {
  const hero = DISHES.find((d) => AL_A_CARTE_HERO_SLUGS.has(d.slug));
  const nonHero = DISHES.find((d) => !AL_A_CARTE_HERO_SLUGS.has(d.slug));
  assert.ok(hero && nonHero);
  assert.equal(isAlaCarteEnabled(hero!), true);
  assert.equal(isAlaCarteEnabled(nonHero!), false);
});
