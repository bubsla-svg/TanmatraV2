import assert from "node:assert/strict";
import { test } from "node:test";
import { computeGymMonthlyEarnings, GYM_COMMISSION_TIERS } from "./partnerCalculator";

test("computeGymMonthlyEarnings obeys calc = planPrice × {0.10, 0.05, 0.05} relationship invariant (L-5)", () => {
  const planPricePaise = 300000; // e.g. ₹3,000 in paise
  const members = 500;
  const adoptionRate = 0.20; // 100 subscribers
  const expectedSubscribers = Math.round(members * adoptionRate);

  const earningsGold = computeGymMonthlyEarnings({
    members,
    adoptionRate,
    planPricePaise,
    tierRate: GYM_COMMISSION_TIERS[0].rate,
  });
  assert.equal(earningsGold, Math.round(expectedSubscribers * planPricePaise * 0.10));

  const earningsSilver = computeGymMonthlyEarnings({
    members,
    adoptionRate,
    planPricePaise,
    tierRate: GYM_COMMISSION_TIERS[1].rate,
  });
  assert.equal(earningsSilver, Math.round(expectedSubscribers * planPricePaise * 0.05));

  const earningsBronze = computeGymMonthlyEarnings({
    members,
    adoptionRate,
    planPricePaise,
    tierRate: GYM_COMMISSION_TIERS[2].rate,
  });
  assert.equal(earningsBronze, Math.round(expectedSubscribers * planPricePaise * 0.05));
});
