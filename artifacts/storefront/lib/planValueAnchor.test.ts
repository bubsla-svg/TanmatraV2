import assert from "node:assert/strict";
import { test } from "node:test";
import { planValueAnchor } from "./planValueAnchor";

test("an equal or trivially lower per-meal price shows no saving", () => {
  assert.deepEqual(planValueAnchor({ perMealPaise: 19900, alacarteMedianPaise: 19900 }), { kind: "benefits" });
  assert.deepEqual(planValueAnchor({ perMealPaise: 19500, alacarteMedianPaise: 19900 }), { kind: "benefits" });
  assert.deepEqual(planValueAnchor({ perMealPaise: 21900, alacarteMedianPaise: 19900 }), { kind: "benefits" });
});

test("a real saving is stated with its size", () => {
  assert.deepEqual(planValueAnchor({ perMealPaise: 19900, alacarteMedianPaise: 24900 }), {
    kind: "saving",
    perMealPaise: 19900,
    savingPaise: 5000,
    savingPct: 20,
  });
});

test("missing inputs never invent a comparison", () => {
  assert.deepEqual(planValueAnchor({ perMealPaise: null, alacarteMedianPaise: 24900 }), { kind: "benefits" });
  assert.deepEqual(planValueAnchor({ perMealPaise: 19900, alacarteMedianPaise: 0 }), { kind: "benefits" });
});
