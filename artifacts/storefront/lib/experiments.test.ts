import { test } from "node:test";
import assert from "node:assert/strict";
import { assignVariant, experimentProps, hash32, magicCheckoutVariant, tabUnit } from "./experiments";

test("assignment is sticky for a unit and differs across experiments", () => {
  const a = assignVariant("magic_checkout", "sess-1");
  assert.equal(assignVariant("magic_checkout", "sess-1"), a);
  const units = Array.from({ length: 2000 }, (_, i) => `u${i}`);
  const treat = units.filter((u) => assignVariant("magic_checkout", u) === "treatment").length;
  assert.ok(treat > 850 && treat < 1150, `roughly half in treatment, got ${treat}/2000`);
  const other = units.filter((u) => assignVariant("other_exp", u) === assignVariant("magic_checkout", u)).length;
  assert.ok(other > 850 && other < 1150, "two experiments do not share a bucketing pattern");
  assert.equal(hash32("a"), hash32("a"));
  assert.notEqual(hash32("a"), hash32("b"));
});

test("treatmentShare narrows the pilot", () => {
  const units = Array.from({ length: 2000 }, (_, i) => `u${i}`);
  const treat = units.filter((u) => assignVariant("x", u, 0.1) === "treatment").length;
  assert.ok(treat > 150 && treat < 250, `about 10%, got ${treat}`);
  assert.equal(units.every((u) => assignVariant("x", u, 0) === "control"), true);
});

function memStorage(): Pick<Storage, "getItem" | "setItem"> & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

test("the per-tab unit is minted once and reused", () => {
  const s = memStorage();
  let mints = 0;
  const mint = () => `t${++mints}`;
  assert.equal(tabUnit(s, mint), "t1");
  assert.equal(tabUnit(s, mint), "t1");
  assert.equal(mints, 1);
  assert.equal(tabUnit(null, mint), null);
  const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => {} };
  assert.equal(tabUnit(throwing, mint), null);
});

test("magicCheckoutVariant: off → null; session id preferred; tab unit fallback; nothing → null", () => {
  assert.equal(magicCheckoutVariant({ enabled: false, sessionId: "s", storage: memStorage() }), null);
  const bySession = magicCheckoutVariant({ enabled: true, sessionId: "s-1", storage: null });
  assert.equal(bySession, assignVariant("magic_checkout", "s-1"));
  const s = memStorage();
  const byTab = magicCheckoutVariant({ enabled: true, sessionId: null, storage: s, mint: () => "tab-1" });
  assert.equal(byTab, assignVariant("magic_checkout", "tab-1"));
  assert.equal(magicCheckoutVariant({ enabled: true, sessionId: null, storage: null }), null);
});

test("experimentProps carries the arm only when assigned", () => {
  assert.deepEqual(experimentProps(null), {});
  assert.deepEqual(experimentProps("treatment"), { magic_checkout: "treatment" });
});
