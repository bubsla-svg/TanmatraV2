import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DISHES,
  AL_A_CARTE_HERO_SLUGS,
  STATIC_ALA_CARTE_HERO_SLUGS,
  LIVE_ALA_CARTE_HERO_SLUGS,
  isAlaCarteEnabled,
} from "./index";

// À la carte covers the ENTIRE catalog (owner decision 2026-08-09) — the
// curated-hero model is superseded, and isAlaCarteEnabled is now
// unconditionally true. The hero sets survive as the historical curation
// record, so their tier-hygiene tests still run: a rotted slug in either
// tier would mean the record no longer describes real dishes, which is
// exactly the kind of silent drift these exist to catch. STATIC heroes
// resolve against this package's DISHES snapshot; LIVE heroes exist only in
// the DB-merged catalog (a slug there must NOT shadow a static dish — that
// would belong in the static tier).

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

test("the historical hero tiers do not overlap or repeat slugs", () => {
  assert.equal(
    AL_A_CARTE_HERO_SLUGS.size,
    STATIC_ALA_CARTE_HERO_SLUGS.length + LIVE_ALA_CARTE_HERO_SLUGS.length,
    "tiers must not overlap or repeat slugs",
  );
});

test("every catalog dish is à-la-carte purchasable (owner decision 2026-08-09)", () => {
  // The ≥50-offering commitment is now trivially exceeded: the whole catalog
  // qualifies. Assert per-dish rather than on set size so a regression back
  // to slug-set gating names the exact dish it re-excluded.
  assert.ok(DISHES.length >= 50, `catalog shrank below the offering floor (${DISHES.length})`);
  for (const dish of DISHES) {
    assert.equal(
      isAlaCarteEnabled(dish),
      true,
      `"${dish.slug}" is not à-la-carte purchasable — the full-catalog decision regressed`,
    );
  }
  // DB-only dishes (the old LIVE tier and anything ops adds later) must ride
  // the same rule — the predicate may not quietly regrow a slug allowlist.
  assert.equal(isAlaCarteEnabled({ slug: "db-only-dish-not-in-static-catalog" }), true);
});
