import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCartTotals } from "./cartMath";

test("Cart Calculation - Standard subtotal, taxes and delivery fee computations", () => {
  const items = [
    { unitPrice: 10000, quantity: 2 }, // Rs. 100 * 2 = 20000 paise
    { unitPrice: 15000, quantity: 1 }, // Rs. 150 * 1 = 15000 paise
  ];
  // Subtotal = 35000 paise (Rs. 350)
  // Delivery Fee = 5000 paise (Rs. 50) because subtotal < 50000 paise
  // Taxes = Math.round(35000 * 0.18) = 6300 paise (Rs. 63)
  // Total = 35000 + 5000 + 6300 = 46300 paise (Rs. 463)
  const totals = calculateCartTotals(items);

  assert.equal(totals.subtotal, 35000);
  assert.equal(totals.deliveryFee, 5000);
  assert.equal(totals.tax, 6300);
  assert.equal(totals.total, 46300);
  assert.equal(totals.amountToFreeDelivery, 15000);
});

test("Cart Calculation - Boundary checks for free delivery threshold", () => {
  // Case A: Exactly Rs. 499.00 (49900 paise) -> Delivery fee should apply
  const underLimit = calculateCartTotals([{ unitPrice: 49900, quantity: 1 }]);
  assert.equal(underLimit.deliveryFee, 5000);
  assert.equal(underLimit.amountToFreeDelivery, 100);

  // Case B: Exactly Rs. 500.00 (50000 paise) -> Delivery fee should be free (0)
  const exactLimit = calculateCartTotals([{ unitPrice: 50000, quantity: 1 }]);
  assert.equal(exactLimit.deliveryFee, 0);
  assert.equal(exactLimit.amountToFreeDelivery, 0);

  // Case C: Exactly Rs. 501.00 (50100 paise) -> Delivery fee should be free (0)
  const overLimit = calculateCartTotals([{ unitPrice: 50100, quantity: 1 }]);
  assert.equal(overLimit.deliveryFee, 0);
  assert.equal(overLimit.amountToFreeDelivery, 0);
});

test("Cart Calculation - Reversal check for ghost values on empty cart", () => {
  // Empty cart -> Everything must return to exactly 0 (no ghost values left)
  const emptyTotals = calculateCartTotals([]);
  assert.equal(emptyTotals.subtotal, 0);
  assert.equal(emptyTotals.deliveryFee, 0);
  assert.equal(emptyTotals.tax, 0);
  assert.equal(emptyTotals.total, 0);
  assert.equal(emptyTotals.amountToFreeDelivery, 50000);
});

test("Cart Calculation - Rapid increment/decrement check", () => {
  // Simulate item added, quantity incremented to 5, decremented to 1, then removed (0)
  let items = [{ unitPrice: 10000, quantity: 1 }];
  let totals = calculateCartTotals(items);
  assert.equal(totals.subtotal, 10000);

  // Increment to 5
  items[0].quantity = 5;
  totals = calculateCartTotals(items);
  assert.equal(totals.subtotal, 50000);
  assert.equal(totals.deliveryFee, 0); // threshold reached

  // Decrement to 1
  items[0].quantity = 1;
  totals = calculateCartTotals(items);
  assert.equal(totals.subtotal, 10000);
  assert.equal(totals.deliveryFee, 5000); // delivery fee applies again

  // Remove completely
  items = [];
  totals = calculateCartTotals(items);
  assert.equal(totals.subtotal, 0);
  assert.equal(totals.tax, 0);
  assert.equal(totals.deliveryFee, 0);
  assert.equal(totals.total, 0);
});
