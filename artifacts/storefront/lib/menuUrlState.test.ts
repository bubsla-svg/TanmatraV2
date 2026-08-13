import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FILTERS, type MenuFilterState } from "./menuFilters";
import { menuUrlStateToSearch, mergeMenuUrlState, parseMenuUrlState, type MenuUrlState } from "./menuUrlState";

const filters = (over: Partial<MenuFilterState>): MenuFilterState => ({
  ...EMPTY_FILTERS,
  ...over,
});
const state = (over: Partial<MenuUrlState>): MenuUrlState => ({
  chip: "all",
  filters: EMPTY_FILTERS,
  query: "",
  ...over,
});

test("all-default state serializes to an empty query string", () => {
  assert.equal(menuUrlStateToSearch(state({})), "");
});

test("an empty query string parses back to all-default state", () => {
  assert.deepEqual(parseMenuUrlState(new URLSearchParams("")), state({}));
});

test("round-trips a diet chip", () => {
  const s = state({ chip: "veg" });
  const search = menuUrlStateToSearch(s);
  assert.equal(search, "diet=veg");
  assert.deepEqual(parseMenuUrlState(new URLSearchParams(search)), s);
});

test("round-trips every filter group together", () => {
  const s = state({
    filters: filters({
      goal: ["fat_loss", "high_protein"],
      dietary: ["vegetarian"],
      allergen: ["peanut_free", "gluten_free"],
      macro: ["under_400_kcal"],
    }),
  });
  const search = menuUrlStateToSearch(s);
  assert.deepEqual(parseMenuUrlState(new URLSearchParams(search)), s);
});

test("round-trips a search query, trimmed", () => {
  const search = menuUrlStateToSearch(state({ query: "  bowl  " }));
  assert.equal(search, "q=bowl");
  assert.deepEqual(parseMenuUrlState(new URLSearchParams(search)).query, "bowl");
});

test("a query that is only whitespace serializes as absent, not q=", () => {
  assert.equal(menuUrlStateToSearch(state({ query: "   " })), "");
});

test("chip + filters + query combine into one query string and back", () => {
  const s = state({
    chip: "non_veg",
    filters: filters({ macro: ["protein_30_plus"] }),
    query: "chicken",
  });
  const search = menuUrlStateToSearch(s);
  assert.deepEqual(parseMenuUrlState(new URLSearchParams(search)), s);
});

test("an unknown or tampered diet value falls back to all, not thrown", () => {
  assert.equal(parseMenuUrlState(new URLSearchParams("diet=carnivore")).chip, "all");
});

test("unknown filter values in a group are dropped, valid ones kept", () => {
  const parsed = parseMenuUrlState(new URLSearchParams("goal=fat_loss,not_a_real_goal"));
  assert.deepEqual(parsed.filters.goal, ["fat_loss"]);
});

test("a duplicated value in one group param is not double-counted", () => {
  const parsed = parseMenuUrlState(new URLSearchParams("allergen=peanut_free,peanut_free"));
  assert.deepEqual(parsed.filters.allergen, ["peanut_free"]);
});

test("merge preserves a param this module does not own", () => {
  // The dish-drawer's own ?dish=slug — a same-route navigation built with
  // its own hardcoded query string, unaware this module manages anything.
  const current = new URLSearchParams("dish=quinoa-khichdi");
  const merged = mergeMenuUrlState(current, state({ chip: "veg", query: "bowl" }));
  const params = new URLSearchParams(merged);
  assert.equal(params.get("dish"), "quinoa-khichdi");
  assert.equal(params.get("diet"), "veg");
  assert.equal(params.get("q"), "bowl");
});

test("merge clears a stale managed value that the new state no longer has", () => {
  // The URL says goal=fat_loss from an earlier round; the caller has since
  // cleared it. A merge must not let it survive just because it wasn't
  // mentioned this time — that would resurrect a filter the user turned off.
  const current = new URLSearchParams("goal=fat_loss&dish=quinoa-khichdi");
  const merged = mergeMenuUrlState(current, state({}));
  const params = new URLSearchParams(merged);
  assert.equal(params.get("goal"), null);
  assert.equal(params.get("dish"), "quinoa-khichdi");
});

test("merge onto an unrelated-only URL adds nothing when state is all-default", () => {
  const current = new URLSearchParams("dish=quinoa-khichdi");
  const merged = mergeMenuUrlState(current, state({}));
  assert.equal(merged, "dish=quinoa-khichdi");
});
