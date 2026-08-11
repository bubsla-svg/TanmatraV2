// Quick Setup wizard draft-persistence invariants.
// Run: node --test --import tsx ./lib/quickSetupDraft.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  stashQuickSetupDraft,
  readQuickSetupDraft,
  clearQuickSetupDraft,
  type StorageLike,
} from "./quickSetupDraft";

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const DRAFT = { step: 2 as const, goal: "gain_muscle", dietaryStyle: "omnivore", allergens: ["dairy"] };

test("stash → read round-trips the in-progress survey", () => {
  const storage = memoryStorage();
  stashQuickSetupDraft(DRAFT, storage);
  assert.deepEqual(readQuickSetupDraft(storage), DRAFT);
});

test("a later stash overwrites the earlier one — always the latest answers", () => {
  const storage = memoryStorage();
  stashQuickSetupDraft(DRAFT, storage);
  stashQuickSetupDraft({ ...DRAFT, step: 3, allergens: ["dairy", "gluten"] }, storage);
  assert.deepEqual(readQuickSetupDraft(storage), { ...DRAFT, step: 3, allergens: ["dairy", "gluten"] });
});

test("clear removes the draft — reload after finishing the survey starts clean", () => {
  const storage = memoryStorage();
  stashQuickSetupDraft(DRAFT, storage);
  clearQuickSetupDraft(storage);
  assert.equal(readQuickSetupDraft(storage), null);
});

test("no storage (SSR / privacy mode) degrades to null, never throws", () => {
  assert.doesNotThrow(() => stashQuickSetupDraft(DRAFT, null));
  assert.doesNotThrow(() => clearQuickSetupDraft(null));
  assert.equal(readQuickSetupDraft(null), null);
});

test("corrupt, non-object, or shape-invalid stash reads as null, never a crash", () => {
  const storage = memoryStorage();
  storage.data.set("tnm:quick-setup-draft", "{not json");
  assert.equal(readQuickSetupDraft(storage), null);
  storage.data.set("tnm:quick-setup-draft", '"a string"');
  assert.equal(readQuickSetupDraft(storage), null);
  // step outside 1-3 (e.g. a stale build's step 4) is rejected, not coerced.
  storage.data.set("tnm:quick-setup-draft", JSON.stringify({ ...DRAFT, step: 4 }));
  assert.equal(readQuickSetupDraft(storage), null);
  // allergens as a non-array is rejected.
  storage.data.set("tnm:quick-setup-draft", JSON.stringify({ ...DRAFT, allergens: "dairy" }));
  assert.equal(readQuickSetupDraft(storage), null);
});

test("a throwing storage is swallowed on every side", () => {
  const throwing: StorageLike = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {
      throw new Error("SecurityError");
    },
  };
  assert.doesNotThrow(() => stashQuickSetupDraft(DRAFT, throwing));
  assert.doesNotThrow(() => clearQuickSetupDraft(throwing));
  assert.equal(readQuickSetupDraft(throwing), null);
});
