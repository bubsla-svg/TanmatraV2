import test from "node:test";
import assert from "node:assert/strict";
import { filterUpsellCandidates, UPSELL_CANDIDATES } from "./CartUpsellRail";

test("filterUpsellCandidates excludes items already in cart", () => {
  const cartLines = [
    { dishId: 901, kind: "marketplace" as const, slug: "marine-collagen-shot", name: "Marine Collagen Shot", pricePaise: 14900, qty: 1 }
  ];

  const candidates = filterUpsellCandidates(cartLines);
  assert.equal(candidates.some((c) => c.dishId === 901), false);
  assert.equal(candidates.length, UPSELL_CANDIDATES.length - 1);
});

test("filterUpsellCandidates returns max 3 items when cart is empty", () => {
  const candidates = filterUpsellCandidates([]);
  assert.equal(candidates.length, 3);
});
