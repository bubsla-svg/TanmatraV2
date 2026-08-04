import test from 'node:test';
import assert from 'node:assert/strict';
import { GstTaxCalculator, TaxCalculationRequestPaise } from './GstTaxCalculator';

test('GstTaxCalculator computes food and delivery GST in exact integer paise', () => {
  const req: TaxCalculationRequestPaise = {
    foodTaxablePaise: 10000,    // ₹100.00
    deliveryTaxablePaise: 5000,  // ₹50.00
    promoDiscountPaise: 2000,   // ₹20.00 discount
    walletAppliedPaise: 3000    // ₹30.00 wallet
  };

  const res = GstTaxCalculator.calculateCheckoutTax(req);

  assert.equal(res.foodTaxableBasePaise, 10000);
  assert.equal(res.netFoodTaxablePaise, 8000);
  assert.equal(res.cgstFoodPaise, 250);       // ₹2.50
  assert.equal(res.sgstFoodPaise, 250);       // ₹2.50
  assert.equal(res.cgstDeliveryPaise, 450);   // ₹4.50 (9% of 5000)
  assert.equal(res.sgstDeliveryPaise, 450);   // ₹4.50 (9% of 5000)
  assert.equal(res.grossTotalPaise, 14400);   // 8000 + 250 + 250 + 5000 + 450 + 450 = 14400 (₹144.00)
  assert.equal(res.actualWalletDebitedPaise, 3000);
  assert.equal(res.netPayableGatewayPaise, 11400); // ₹114.00
});

test('GstTaxCalculator prevents wallet over-application beyond gross total', () => {
  const req: TaxCalculationRequestPaise = {
    foodTaxablePaise: 5000,    // ₹50.00
    deliveryTaxablePaise: 0,
    promoDiscountPaise: 0,
    walletAppliedPaise: 10000  // ₹100.00 wallet
  };

  const res = GstTaxCalculator.calculateCheckoutTax(req);

  assert.equal(res.grossTotalPaise, 5250); // 5000 + 2.5% CGST (125) + 2.5% SGST (125) = 5250
  assert.equal(res.actualWalletDebitedPaise, 5250);
  assert.equal(res.netPayableGatewayPaise, 0);
});
