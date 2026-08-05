import test from "node:test";
import assert from "node:assert/strict";

interface AddOnOption {
  id: string;
  label: string;
  pricePaise: number;
}

function getAvailableAddOnOptions(): AddOnOption[] {
  return [
    { id: "evening_add", label: "Evening Meal Companion Drop", pricePaise: 19900 },
    { id: "collagen_boost", label: "Daily Marine Collagen Tonic", pricePaise: 14900 },
    { id: "kombucha_pack", label: "Weekly Gut Microbiome Pack", pricePaise: 29900 },
  ];
}

test("getAvailableAddOnOptions returns defined post-checkout add-ons", () => {
  const options = getAvailableAddOnOptions();
  assert.equal(options.length, 3);
  assert.equal(options[0]?.id, "evening_add");
});
