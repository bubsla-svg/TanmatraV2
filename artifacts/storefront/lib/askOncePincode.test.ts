/**
 * Law 4 — "never ask twice", for the one answer the whole checkout is keyed on.
 *
 * The customer's first interaction with the product is the serviceability bar:
 * they type a PIN, we tell them whether we deliver there, and we persist the
 * answer (`tnm_serviceability_state`). Every address form downstream then
 * started from a blank PIN field and asked again.
 *
 * On the live à-la-carte path that was not merely a retype. The quote is keyed
 * on the PIN (`fetchQuote(items, pin)`), so until the customer re-answered, the
 * delivery-inclusive total and the ETA were both withheld — the "all-in price"
 * the contract wants shown before the ask was being held back pending a
 * question they had already answered.
 *
 * Run: node --test --import tsx ./lib/askOncePincode.test.ts
 */
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { carriedPincode, saveServiceabilityState } from "./serviceabilityApi";
import { readAddressDraft, seedAddressFields } from "./addressSeed";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = path.join(HERE, "..", "components");

const fakeStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => fakeStorage.get(key) ?? null,
  setItem: (key: string, val: string) => fakeStorage.set(key, val),
  removeItem: (key: string) => fakeStorage.delete(key),
};

const fakeSession = new Map<string, string>();
const mockSessionStorage = {
  getItem: (key: string) => fakeSession.get(key) ?? null,
  setItem: (key: string, val: string) => fakeSession.set(key, val),
  removeItem: (key: string) => fakeSession.delete(key),
};

const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;
const originalSessionStorage = globalThis.sessionStorage;

beforeEach(() => {
  fakeStorage.clear();
  fakeSession.clear();
  // @ts-expect-error test shim
  globalThis.window = {};
  // @ts-expect-error test shim
  globalThis.localStorage = mockLocalStorage;
  // @ts-expect-error test shim
  globalThis.sessionStorage = mockSessionStorage;
});

afterEach(() => {
  if (originalWindow !== undefined) globalThis.window = originalWindow;
  else delete (globalThis as unknown as { window?: unknown }).window;
  if (originalLocalStorage !== undefined) globalThis.localStorage = originalLocalStorage;
  else delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  if (originalSessionStorage !== undefined) globalThis.sessionStorage = originalSessionStorage;
  else delete (globalThis as unknown as { sessionStorage?: unknown }).sessionStorage;
});

test("a checked PIN is carried forward", () => {
  saveServiceabilityState({ verdict: "serviceable", pincode: "201301" });
  assert.equal(carriedPincode(), "201301");
});

test("an unserviceable PIN is carried forward too", () => {
  // It is still the customer's own answer to "where do you live". Carrying it
  // makes the quote say "we don't deliver there yet" on arrival instead of
  // after a retype — a stated refusal with a next step beats a blank field.
  saveServiceabilityState({ verdict: "unserviceable", pincode: "560001" });
  assert.equal(carriedPincode(), "560001");
});

test("nothing is carried when no check has run", () => {
  assert.equal(carriedPincode(), "", "an unchecked visitor must see today's blank field");
});

test("a malformed stored PIN is not carried", () => {
  // loadServiceabilityState only type-checks the blob. Without the digit check
  // a truncated PIN would reach the field and quote for nowhere.
  for (const bad of ["2013", "20130a", "", "2013011"]) {
    fakeStorage.set("tnm_serviceability_state", JSON.stringify({ verdict: "serviceable", pincode: bad }));
    assert.equal(carriedPincode(), "", `"${bad}" must not be carried into a PIN field`);
  }
});

test("corrupted storage degrades to asking, not to crashing", () => {
  fakeStorage.set("tnm_serviceability_state", "{not json");
  assert.equal(carriedPincode(), "");
});

test("carriedPincode is server-safe", () => {
  // Every consumer reads it from an effect for exactly this reason, but the
  // helper must not throw if one ever does not.
  delete (globalThis as unknown as { window?: unknown }).window;
  assert.equal(carriedPincode(), "");
});

test("both checkout address forms read the carried PIN", () => {
  // The defect was a form seeding its PIN with "" and never consulting the
  // stored answer — invisible to the type-checker, since "" is a valid seed.
  const forms = [
    path.join("checkout", "AlacarteDetails.tsx"),
    path.join("checkout", "CheckoutAddress.tsx"),
  ];
  for (const rel of forms) {
    const src = fs.readFileSync(path.join(COMPONENTS, rel), "utf8");
    assert.match(src, /carriedPincode\(\)/, `${rel} must consult the carried PIN`);
  }
});

const EMPTY = { line1: "", city: "", pincode: "" };

test("the carried PIN fills a blank form", () => {
  assert.deepEqual(seedAddressFields(EMPTY, {}, "201301"), { line1: "", city: "", pincode: "201301" });
});

test("nothing already in a field is ever overwritten", () => {
  const typed = { line1: "Flat 3B", city: "Noida", pincode: "110001" };
  assert.deepEqual(
    seedAddressFields(typed, { line1: "old", city: "old", pincode: "560001" }, "201301"),
    typed,
    "a draft and a carried PIN must both lose to what is on screen",
  );
});

test("a session draft outranks the carried PIN", () => {
  // The draft is what they typed on THIS form; the carried PIN is an answer
  // from another screen. Specific beats general.
  assert.equal(seedAddressFields(EMPTY, { pincode: "560001" }, "201301").pincode, "560001");
});

test("the carried PIN fills in where the draft is silent", () => {
  // A draft written mid-typing carries a street but no PIN yet. Restoring the
  // street must not cost the PIN we already had.
  const next = seedAddressFields(EMPTY, { line1: "Flat 3B" }, "201301");
  assert.deepEqual(next, { line1: "Flat 3B", city: "", pincode: "201301" });
});

test("a draft that cannot be read still lets the carried PIN through", () => {
  // The original code returned early when sessionStorage threw or held no
  // draft — which, once a second source existed, would have skipped it too.
  assert.deepEqual(readAddressDraft("nope"), {});
  assert.equal(seedAddressFields(EMPTY, readAddressDraft("nope"), "201301").pincode, "201301");
});

test("a malformed draft contributes nothing rather than garbage", () => {
  for (const raw of ["{not json", '"a string"', "null", '{"line1":42}']) {
    fakeSession.set("k", raw);
    assert.deepEqual(readAddressDraft("k"), {}, `${raw} must not reach a field`);
  }
});

test("a saved address still outranks the carried PIN", () => {
  // The prefill gate used to read `pincode === ""`, which the carry-forward
  // would have falsified on every render — silently cancelling the saved-address
  // prefill for every signed-in customer. It must compare against the carried
  // value, so "the customer entered nothing of their own" stays the real test.
  const src = fs.readFileSync(path.join(COMPONENTS, "checkout", "AlacarteDetails.tsx"), "utf8");
  assert.match(
    src,
    /pincode === "" \|\| pincode === carriedPinRef\.current/,
    "the saved-address prefill gate must treat a carried PIN as untouched",
  );
});
