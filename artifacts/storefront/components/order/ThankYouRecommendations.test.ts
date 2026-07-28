import test from "node:test";
import assert from "node:assert/strict";

interface RecommendationCard {
  title: string;
  badge: string;
  href: string;
}

function getRecommendationCards(): RecommendationCard[] {
  return [
    { title: "Consult a Dietitian", badge: "Free 15-min Session", href: "/rd" },
    { title: "Join 14-Day Challenge", badge: "Community Cohort", href: "/challenges" },
    { title: "Upgrade to Premium", badge: "Priority Kitchen Queue", href: "/premium" },
  ];
}

test("getRecommendationCards returns all 3 conversion pillars", () => {
  const cards = getRecommendationCards();
  assert.equal(cards.length, 3);
  assert.equal(cards[0]?.href, "/rd");
  assert.equal(cards[1]?.href, "/challenges");
  assert.equal(cards[2]?.href, "/premium");
});
