/**
 * Price-band validation (TNM-ADM-01 ADM-28). Pure functions, no DB —
 * validatePricePaise has no import chain that touches @workspace/db.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/priceBands.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CATEGORY_PRICE_BANDS_PAISE,
  DEFAULT_BAND_PAISE,
  PriceValidationError,
  validatePricePaise,
} from "./priceBands";

test("accepts a price inside the category band", () => {
  const band = CATEGORY_PRICE_BANDS_PAISE["mains"]!;
  assert.doesNotThrow(() =>
    validatePricePaise("mains", Math.round((band.minPaise + band.maxPaise) / 2)),
  );
});

test("category matching is case-insensitive and trims whitespace", () => {
  const band = CATEGORY_PRICE_BANDS_PAISE["mains"]!;
  const midpoint = Math.round((band.minPaise + band.maxPaise) / 2);
  assert.doesNotThrow(() => validatePricePaise("  Mains  ", midpoint));
  assert.doesNotThrow(() => validatePricePaise("MAINS", midpoint));
});

test("rejects zero", () => {
  assert.throws(() => validatePricePaise("mains", 0), PriceValidationError);
});

test("rejects a negative price", () => {
  assert.throws(() => validatePricePaise("mains", -100), PriceValidationError);
});

test("rejects a non-integer price", () => {
  assert.throws(() => validatePricePaise("mains", 1999.5), PriceValidationError);
});

test("rejects a price below the category band", () => {
  const band = CATEGORY_PRICE_BANDS_PAISE["snacks"]!;
  assert.throws(
    () => validatePricePaise("snacks", band.minPaise - 1),
    PriceValidationError,
  );
});

test("rejects a price above the category band", () => {
  const band = CATEGORY_PRICE_BANDS_PAISE["snacks"]!;
  assert.throws(
    () => validatePricePaise("snacks", band.maxPaise + 1),
    PriceValidationError,
  );
});

test("accepts the exact band boundaries", () => {
  const band = CATEGORY_PRICE_BANDS_PAISE["beverages"]!;
  assert.doesNotThrow(() => validatePricePaise("beverages", band.minPaise));
  assert.doesNotThrow(() => validatePricePaise("beverages", band.maxPaise));
});

test("an unknown category falls back to the default band, not unrestricted", () => {
  assert.doesNotThrow(() =>
    validatePricePaise("some-legacy-category", DEFAULT_BAND_PAISE.minPaise),
  );
  assert.throws(
    () => validatePricePaise("some-legacy-category", DEFAULT_BAND_PAISE.maxPaise + 1),
    PriceValidationError,
  );
  assert.throws(() => validatePricePaise("some-legacy-category", 0), PriceValidationError);
});

test("every canonical DishCategory has an explicit band (no silent default fallback)", () => {
  // @workspace/menu-catalog's DishCategory enum — kept as a literal list here
  // rather than importing the package, so this test fails loudly if a new
  // category is added there without a corresponding band decision, instead
  // of silently absorbing it into DEFAULT_BAND_PAISE.
  const CANONICAL_CATEGORIES = [
    "beverages",
    "breakfast",
    "salads",
    "soups",
    "pasta",
    "wraps",
    "bowls",
    "snacks",
    "mains",
  ];
  for (const category of CANONICAL_CATEGORIES) {
    assert.ok(
      CATEGORY_PRICE_BANDS_PAISE[category],
      `no explicit price band for canonical category "${category}"`,
    );
  }
});
