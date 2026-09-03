import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_FILTERS } from "./menuFilters";
import { menuUrlStateToSearch, mergeMenuUrlState, parseMenuUrlState } from "./menuUrlState";

test("numeric bounds round-trip through the URL", () => {
  const search = menuUrlStateToSearch({
    chip: "all",
    filters: { ...EMPTY_FILTERS, proteinMin: 30, kcalMax: 500 },
  });
  assert.equal(search, "pmin=30&kmax=500");
  const parsed = parseMenuUrlState(new URLSearchParams(search));
  assert.equal(parsed.filters.proteinMin, 30);
  assert.equal(parsed.filters.kcalMax, 500);
});

test("a tampered bound is dropped, not trusted", () => {
  const parsed = parseMenuUrlState(new URLSearchParams("pmin=abc&kmax=99999"));
  assert.equal(parsed.filters.proteinMin, null);
  assert.equal(parsed.filters.kcalMax, null);
});

test("clearing a bound evicts its param on merge", () => {
  const merged = mergeMenuUrlState(new URLSearchParams("pmin=30&dish=bowl"), {
    chip: "all",
    filters: EMPTY_FILTERS,
  });
  assert.equal(merged, "dish=bowl");
});
