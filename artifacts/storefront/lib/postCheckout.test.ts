// Post-checkout perks handoff invariants. Run with the api-server tsx loader:
//   cd artifacts/api-server && node --test --import tsx ../storefront/lib/postCheckout.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  stashCheckoutPerks,
  readCheckoutPerks,
  type StorageLike,
} from "./postCheckout";

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

test("stash → read round-trips the server's verbatim disclaimer, keyed by order", () => {
  const storage = memoryStorage();
  stashCheckoutPerks("sub-42", { autopayDisclaimer: "Weekly payments use UPI Autopay." }, storage);
  assert.deepEqual(readCheckoutPerks("sub-42", storage), {
    autopayDisclaimer: "Weekly payments use UPI Autopay.",
  });
  // A different order id sees nothing — no perk bleed between orders.
  assert.equal(readCheckoutPerks("sub-43", storage), null);
});

test("creditAppliedPaise round-trips alongside the other perks", () => {
  const storage = memoryStorage();
  stashCheckoutPerks("sub-77", { creditAppliedPaise: 39900, planId: "desk_fuel" }, storage);
  assert.deepEqual(readCheckoutPerks("sub-77", storage), {
    creditAppliedPaise: 39900,
    planId: "desk_fuel",
  });
});

test("read is non-destructive — an in-tab refresh still shows the disclaimer", () => {
  const storage = memoryStorage();
  stashCheckoutPerks("sub-7", { autopayDisclaimer: "d" }, storage);
  readCheckoutPerks("sub-7", storage);
  assert.notEqual(readCheckoutPerks("sub-7", storage), null);
});

test("no storage (SSR / privacy mode) degrades to null, never throws", () => {
  assert.doesNotThrow(() => stashCheckoutPerks("sub-1", { autopayDisclaimer: "d" }, null));
  assert.equal(readCheckoutPerks("sub-1", null), null);
});

test("corrupt or non-object stash reads as null, never a crash", () => {
  const storage = memoryStorage();
  storage.data.set("tnm:perks:sub-9", "{not json");
  assert.equal(readCheckoutPerks("sub-9", storage), null);
  storage.data.set("tnm:perks:sub-9", '"a string"');
  assert.equal(readCheckoutPerks("sub-9", storage), null);
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
  assert.doesNotThrow(() => stashCheckoutPerks("sub-2", { autopayDisclaimer: "d" }, throwing));
  assert.equal(readCheckoutPerks("sub-2", throwing), null);
});
