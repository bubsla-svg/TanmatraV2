// Acquisition-context handoff invariants (D-04B / TNM-CRO-01).
// Run: node --test --import tsx ./lib/acquisitionContext.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { createAcquisitionContext, readAcquisitionContext, type StorageLike } from "./acquisitionContext";

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

test("create → read round-trips the context by its returned id", () => {
  const storage = memoryStorage();
  const id = createAcquisitionContext(
    { intendedGoal: "lose_weight", recommendedPlanId: "steady", returnRoute: "/quick-setup" },
    storage,
  );
  const ctx = readAcquisitionContext(id, storage);
  assert.ok(ctx);
  assert.equal(ctx?.sourceType, "organic");
  assert.equal(ctx?.intendedGoal, "lose_weight");
  assert.equal(ctx?.recommendedPlanId, "steady");
  assert.equal(ctx?.returnRoute, "/quick-setup");
  assert.equal(ctx?.verificationStatus, "not-required");
  assert.deepEqual(ctx?.eligibleBenefitIds, []);
});

test("two contexts get distinct ids and don't collide in storage", () => {
  const storage = memoryStorage();
  const id1 = createAcquisitionContext({ returnRoute: "/quick-setup" }, storage);
  const id2 = createAcquisitionContext({ returnRoute: "/quick-setup" }, storage);
  assert.notEqual(id1, id2);
  assert.equal(storage.data.size, 2);
});

test("no storage (SSR / privacy mode) still returns an id, and read degrades to null", () => {
  let id = "";
  assert.doesNotThrow(() => {
    id = createAcquisitionContext({ returnRoute: "/trial" }, null);
  });
  assert.ok(id.length > 0);
  assert.equal(readAcquisitionContext(id, null), null);
});

test("an unknown id reads as null, never a crash", () => {
  const storage = memoryStorage();
  assert.equal(readAcquisitionContext("nonexistent", storage), null);
});

test("corrupt or shape-invalid stored context reads as null", () => {
  const storage = memoryStorage();
  storage.data.set("tnm:acquisition-context:bad1", "{not json");
  assert.equal(readAcquisitionContext("bad1", storage), null);
  storage.data.set("tnm:acquisition-context:bad2", JSON.stringify({ sourceType: "not-a-real-source" }));
  assert.equal(readAcquisitionContext("bad2", storage), null);
  storage.data.set(
    "tnm:acquisition-context:bad3",
    JSON.stringify({ sourceType: "organic", verificationStatus: "not-required", eligibleBenefitIds: "nope", returnRoute: "/x" }),
  );
  assert.equal(readAcquisitionContext("bad3", storage), null);
});

test("a throwing storage is swallowed on both sides", () => {
  const throwing: StorageLike = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  let id = "";
  assert.doesNotThrow(() => {
    id = createAcquisitionContext({ returnRoute: "/trial" }, throwing);
  });
  assert.ok(id.length > 0);
  assert.doesNotThrow(() => readAcquisitionContext(id, throwing));
  assert.equal(readAcquisitionContext(id, throwing), null);
});
