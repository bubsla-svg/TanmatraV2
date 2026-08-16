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

test("chip + filters combine into one query string and back", () => {
  const s = state({
    chip: "non_veg",
    filters: filters({ macro: ["protein_30_plus"] }),
  });
  const search = menuUrlStateToSearch(s);
  assert.deepEqual(parseMenuUrlState(new URLSearchParams(search)), s);
});

test("the retired search param is never written", () => {
  // `q` backed the inline search box, removed 2026-08-16. Nothing reads it
  // any more, so nothing may emit it either — a param the page ignores is a
  // lie in the address bar and a share link that silently means less than it
  // looks like it means.
  const search = menuUrlStateToSearch(state({ chip: "veg", filters: filters({ goal: ["fat_loss"] }) }));
  assert.equal(new URLSearchParams(search).get("q"), null);
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
  const merged = mergeMenuUrlState(current, state({ chip: "veg" }));
  const params = new URLSearchParams(merged);
  assert.equal(params.get("dish"), "quinoa-khichdi");
  assert.equal(params.get("diet"), "veg");
});

test("merge evicts a legacy q= param from a bookmarked or shared URL", () => {
  // `q` is still MANAGED after the search box was removed, precisely so an
  // old link stops advertising a search the page no longer performs.
  const current = new URLSearchParams("q=bowl&dish=quinoa-khichdi");
  const merged = mergeMenuUrlState(current, state({}));
  const params = new URLSearchParams(merged);
  assert.equal(params.get("q"), null);
  assert.equal(params.get("dish"), "quinoa-khichdi");
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
