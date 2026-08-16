/**
 * Law 4 for the one answer that changes what food a person is shown.
 *
 * The quick-setup wizard asks "what's your kitchen dietary style?" and saves it
 * through `savePreferences` — best-effort, swallowing the 401 a signed-out
 * visitor gets. `/menu` then resolves its Veg/Non-veg chip through
 * `resolveInitialDietChip`, which gates on `getAuthUser`, finds nobody, and
 * returns "all".
 *
 * So a signed-out visitor could answer "Strictly Vegetarian" and be shown
 * chicken on the next screen. That is past asking twice: it is asking, being
 * told, and then acting against the answer — and on this product the answer can
 * be a religious or clinical one rather than a preference.
 *
 * Run: node --test --import tsx ./lib/dietMemory.test.ts
 */
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chipForStyle,
  forgetDiet,
  recallDiet,
  recalledDietaryStyle,
  rememberDiet,
} from "./dietMemory";
import { resolveInitialDietChip } from "./dietFilter";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const fakeStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => fakeStorage.get(key) ?? null,
  setItem: (key: string, val: string) => fakeStorage.set(key, val),
  removeItem: (key: string) => fakeStorage.delete(key),
};

const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;

beforeEach(() => {
  fakeStorage.clear();
  // @ts-expect-error test shim
  globalThis.window = {};
  // @ts-expect-error test shim
  globalThis.localStorage = mockLocalStorage;
});

afterEach(() => {
  if (originalWindow !== undefined) globalThis.window = originalWindow;
  else delete (globalThis as unknown as { window?: unknown }).window;
  if (originalLocalStorage !== undefined) globalThis.localStorage = originalLocalStorage;
  else delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});

/** A fetch that answers the two calls resolveInitialDietChip makes. */
function fetchStub(auth: unknown, preferences: unknown) {
  return async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const body = url.includes("/preferences") ? { preferences } : auth;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

const ANON = { user: null };
const SIGNED_IN = { user: { id: 1, phoneE164: "+919000000000" } };

test("a declared style survives to the menu chip", () => {
  rememberDiet({ chip: "veg", source: "declared", style: "vegetarian" });
  assert.equal(recallDiet()?.chip, "veg");
  assert.equal(recalledDietaryStyle(), "vegetarian");
});

test("an anonymous visitor's declaration reaches resolveInitialDietChip", async () => {
  rememberDiet({ chip: "veg", source: "declared", style: "vegetarian" });
  assert.equal(
    await resolveInitialDietChip(fetchStub(ANON, null)),
    "veg",
    "the menu must not show chicken to someone who just declared vegetarian",
  );
});

test("with nothing told to us, nothing changes", async () => {
  assert.equal(await resolveInitialDietChip(fetchStub(ANON, null)), "all");
});

test("a signed-in profile outranks local memory", async () => {
  // The profile is a real thing they can see and edit. A stale chip tap must
  // not quietly override it.
  rememberDiet({ chip: "veg", source: "filtered" });
  assert.equal(
    await resolveInitialDietChip(fetchStub(SIGNED_IN, { dietaryStyle: "omnivore" })),
    "all",
  );
});

test("a signed-in profile decides 'veg' too", async () => {
  assert.equal(
    await resolveInitialDietChip(fetchStub(SIGNED_IN, { dietaryStyle: "vegan" })),
    "veg",
  );
});

test("a signed-in account with no profile row still gets its local answer", async () => {
  // GET /preferences returns 200 { preferences: null } here, which is not an
  // answer — falling through is the whole point of the null case.
  rememberDiet({ chip: "veg", source: "declared", style: "vegetarian" });
  assert.equal(await resolveInitialDietChip(fetchStub(SIGNED_IN, null)), "veg");
});

test("a filter tap never overwrites a declaration", () => {
  // Browsing non-veg dishes after answering the wizard is not a retraction,
  // and the wizard's question is the one that was actually about them.
  rememberDiet({ chip: "veg", source: "declared", style: "vegetarian" });
  rememberDiet({ chip: "non_veg", source: "filtered" });
  assert.equal(recallDiet()?.chip, "veg");
  assert.equal(recallDiet()?.source, "declared");
});

test("a declaration replaces an earlier declaration", () => {
  rememberDiet({ chip: "veg", source: "declared", style: "vegetarian" });
  rememberDiet({ chip: "non_veg", source: "declared", style: "omnivore" });
  assert.equal(recalledDietaryStyle(), "omnivore");
});

test("a filter tap is never read back as a declared style", () => {
  // Pre-selecting "Strictly Vegetarian" in the wizard because someone tapped a
  // Veg chip would answer the question for them — and the wizard saves its
  // answer to their real preferences, so the over-claim would outlive the visit.
  rememberDiet({ chip: "veg", source: "filtered" });
  assert.equal(recallDiet()?.chip, "veg", "it still narrows the menu");
  assert.equal(recalledDietaryStyle(), null, "but it does not answer the wizard");
});

test("clearing the chip forgets the memory", () => {
  rememberDiet({ chip: "veg", source: "filtered" });
  forgetDiet();
  assert.equal(recallDiet(), null);
});

test("only unambiguous styles map to a chip", () => {
  assert.equal(chipForStyle("vegetarian"), "veg");
  assert.equal(chipForStyle("vegan"), "veg");
  assert.equal(chipForStyle("omnivore"), "non_veg");
  // Neither chip is true of these, so no memory beats a wrong one.
  assert.equal(chipForStyle("pescatarian"), null);
  assert.equal(chipForStyle("keto"), null);
});

test("a corrupted or unknown stored value is discarded, not coerced", () => {
  for (const raw of ['{"chip":"maybe","source":"declared"}', '{"chip":"veg"}', "{not json", "null", '"veg"']) {
    fakeStorage.set("tnm_diet_memory", raw);
    assert.equal(recallDiet(), null, `${raw} must not decide what dishes someone sees`);
  }
});

test("storage being unavailable degrades to asking, not to crashing", () => {
  delete (globalThis as unknown as { window?: unknown }).window;
  assert.doesNotThrow(() => rememberDiet({ chip: "veg", source: "declared", style: "vegetarian" }));
  assert.doesNotThrow(() => forgetDiet());
  assert.equal(recallDiet(), null);
});

test("the wizard records the answer before the request that can lose it", () => {
  // Ordering is the fix. `savePreferences` swallows a signed-out 401, so a
  // record written only on its success would never be written at all.
  const src = fs.readFileSync(
    path.join(HERE, "..", "components", "wizard", "QuickSetupWizard.tsx"),
    "utf8",
  );
  const remember = src.indexOf("rememberDiet(");
  const save = src.indexOf("savePreferences(");
  assert.ok(remember > 0, "the wizard must record its dietary-style answer locally");
  assert.ok(save > 0);
  assert.ok(remember < save, "record the answer before attempting the save that can drop it");
});

test("the menu records a chip tap rather than only reflecting it", () => {
  const src = fs.readFileSync(
    path.join(HERE, "..", "components", "menu", "PersonalizedMenu.tsx"),
    "utf8",
  );
  assert.doesNotMatch(
    src,
    /onChipChange=\{setChip\}/,
    "a bare setState drops the answer the moment the component unmounts",
  );
  assert.match(src, /rememberDiet\(\{ chip: next, source: "filtered" \}\)/);
  assert.match(src, /forgetDiet\(\)/, "clearing to All must clear the memory too");
});

test("a failing auth check falls back to local memory rather than 'all'", async () => {
  // Offline or a session timeout must not silently un-answer the question.
  rememberDiet({ chip: "veg", source: "declared", style: "vegetarian" });
  const boom = async () => {
    throw new Error("network down");
  };
  assert.equal(await resolveInitialDietChip(boom), "veg");
});
