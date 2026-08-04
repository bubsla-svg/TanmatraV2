import {
  FinancialPaymentsLedgerService,
  PaymentIntentRequest,
} from './FinancialPaymentsLedgerService';
import { PetpoojaService, PetpoojaApiGateway } from './PetpoojaService';

// Cumulative test failures tracker
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    failures.push(message);
    console.error(`❌ ASSERTION FAILED: ${message}`);
  }
}

async function runMoneyPathStressTests() {
  console.log('====================================================================');
  console.log('💥 TANMATRA TRANSACTION FUNNEL & PAYMENT INTEGRITY STRESS-TESTS');
  console.log('====================================================================\n');

  // Set up mock Petpooja integration
  const mockGateway = {
    saveSales: async (req: any) => {
      return { code: '200', success: '1', message: 'Mock Success' };
    },
    saveSalesReturn: async (req: any) => {
      return { code: '200', success: '1', message: 'Mock Success' };
    }
  } as unknown as PetpoojaApiGateway;

  const petpoojaService = new PetpoojaService({
    appKey: 'stress_app_key',
    appSecret: 'stress_app_secret',
    accessToken: 'stress_access_token',
    menuSharingCode: 'stress_menu_sharing_code'
  }, mockGateway);

  const finService = new FinancialPaymentsLedgerService(petpoojaService);

  // -------------------------------------------------------------------------
  // Stress Test 1: Wallet Over-Application & Negative Net Payable
  // -------------------------------------------------------------------------
  console.log('--- [Stress Test 1: Wallet Over-Application & Negative Net Payable] ---');
  const walletReq: PaymentIntentRequest = {
    order_id: 'ORD_STRESS_001',
    idempotency_key: 'idemp_stress_001',
    food_taxable_amount: 100.0,
    delivery_taxable_amount: 50.0,
    promo_discount_amount: 20.0,
    wallet_applied_amount: 200.0, // Exceeds total order cost of ₹143
  };

  const walletRes = await finService.processIdempotentCheckout(walletReq);
  console.log(`   Order Value: Food ₹100 (after discount ₹80), Delivery ₹50`);
  console.log(`   Applied Wallet Amount: ₹200`);
  console.log(`   Calculated Net Payable to Gateway: ₹${walletRes.netPayable}`);

  // Rigorous Assertions
  assert(walletRes.netPayable >= 0, `Net Payable to gateway is negative: ₹${walletRes.netPayable}`);
  console.log();

  // -------------------------------------------------------------------------
  // Stress Test 2: Price/Payload Alteration & Parameter Tampering
  // -------------------------------------------------------------------------
  console.log('--- [Stress Test 2: Price/Payload Alteration & Parameter Tampering] ---');
  const premiumDishCatalogPrice = 333.00;
  
  const tamperedReq: PaymentIntentRequest = {
    order_id: 'ORD_STRESS_002',
    idempotency_key: 'idemp_stress_002',
    food_taxable_amount: 1.0, // Tampered price from ₹333
    delivery_taxable_amount: 50.0,
    promo_discount_amount: 0.0,
    wallet_applied_amount: 0.0,
    petpooja_items: [
      {
        materialCode: 'KIWI_001',
        materialName: 'Premium Meal (Grilled Chicken)',
        quantity: 1,
        unitPrice: 1.0, // Tampered item price
        unitOfMeasure: 'PCS'
      }
    ]
  };

  const tamperedRes = await finService.processIdempotentCheckout(tamperedReq);
  console.log(`   Premium Item Catalog Price: ₹${premiumDishCatalogPrice}`);
  console.log(`   Tampered Checkout Request Price: ₹${tamperedReq.food_taxable_amount}`);
  console.log(`   Calculated Net Payable: ₹${tamperedRes.netPayable}`);

  // Rigorous Assertions: Should fail because expected gross total is ₹408.65
  // (333 * 1.05 + 50 * 1.18 = 349.65 + 59 = 408.65)
  const expectedCorrectNetPayable = 408.65;
  assert(
    Math.abs(tamperedRes.netPayable - expectedCorrectNetPayable) < 0.05,
    `System accepted tampered price! Charged: ₹${tamperedRes.netPayable}, expected: ₹${expectedCorrectNetPayable}`
  );
  console.log();

  // -------------------------------------------------------------------------
  // Stress Test 3: Idempotency Key Bypass & Date.now() Collision Vulnerability
  // -------------------------------------------------------------------------
  console.log('--- [Stress Test 3: Double-Click & Idempotency Key Bypass] ---');
  const orderId = 'ORD_STRESS_003';
  const click1: PaymentIntentRequest = {
    order_id: orderId,
    idempotency_key: 'idemp_uuid_first_click',
    food_taxable_amount: 200.0,
    delivery_taxable_amount: 50.0,
    promo_discount_amount: 0.0,
    wallet_applied_amount: 0.0,
  };
  const click2: PaymentIntentRequest = {
    order_id: orderId,
    idempotency_key: 'idemp_uuid_second_click', // Bypasses map key lock!
    food_taxable_amount: 200.0,
    delivery_taxable_amount: 50.0,
    promo_discount_amount: 0.0,
    wallet_applied_amount: 0.0,
  };

  const intent1 = await finService.processIdempotentCheckout(click1);
  const intent2 = await finService.processIdempotentCheckout(click2);

  console.log(`   First Click Intent: ${intent1.intentId}`);
  console.log(`   Second Click Intent: ${intent2.intentId}`);

  // Warn if intent IDs collide (due to Date.now() millisecond collision)
  if (intent1.intentId === intent2.intentId) {
    console.warn(`   ⚠️ WARNING: Date.now() collision detected in intentId generation: ${intent1.intentId}`);
  }

  // Rigorous Assertions: Second intent should NOT be created for the same Order ID
  assert(
    intent1.isDuplicate || intent2.isDuplicate || intent1.intentId === intent2.intentId,
    `Idempotency bypass! Processed two distinct checkout intents for the same Order ID (${orderId})`
  );
  console.log();

  // -------------------------------------------------------------------------
  // Stress Test 4: Multi-Vendor Cart Aggregation & Split Audit
  // -------------------------------------------------------------------------
  console.log('--- [Stress Test 4: Multi-Vendor Cart Aggregation & Split Audit] ---');
  // Order with items from Tanmatra (₹200) + Vendor A (₹100) + Vendor B (₹50)
  const multiVendorReq: PaymentIntentRequest = {
    order_id: 'ORD_STRESS_004',
    idempotency_key: 'idemp_stress_004',
    food_taxable_amount: 350.0,
    delivery_taxable_amount: 90.0,
    promo_discount_amount: 50.0,
    wallet_applied_amount: 0.0,
    petpooja_items: [
      {
        materialCode: 'TAN_DIS_01',
        materialName: 'Tanmatra Main Dish',
        quantity: 1,
        unitPrice: 200,
        unitOfMeasure: 'PCS',
        // In a real system, these would have supplier/vendor identifiers
      },
      {
        materialCode: 'VEND_A_01',
        materialName: 'Marketplace Condiment (Vendor A)',
        quantity: 1,
        unitPrice: 100,
        unitOfMeasure: 'PCS'
      },
      {
        materialCode: 'VEND_B_01',
        materialName: 'Marketplace Beverage (Vendor B)',
        quantity: 1,
        unitPrice: 50,
        unitOfMeasure: 'PCS'
      }
    ]
  };

  const multiVendorRes = await finService.processIdempotentCheckout(multiVendorReq);
  await finService.handleGatewayWebhook({
    orderId: 'ORD_STRESS_004',
    intentId: multiVendorRes.intentId,
    event: 'payment.captured',
    signature: 'valid_signature'
  });

  const ledger = finService.getLedgerJournal().filter(rec => rec.order_id === 'ORD_STRESS_004');
  console.log(`   Ledger journal entries generated for multi-vendor checkout:`);
  let hasSplitAccounts = false;
  ledger.forEach(rec => {
    console.log(`      - DR: ${rec.debit_account} | CR: ${rec.credit_account} | Amount: ₹${rec.amount}`);
    if (rec.credit_account.includes('REVENUE_VENDOR_') || rec.credit_account.includes('REVENUE_MARKETPLACE_')) {
      hasSplitAccounts = true;
    }
  });

  // Rigorous Assertions: Verify that revenue is split correctly instead of aggregated in a single account
  assert(
    hasSplitAccounts,
    `Multi-vendor checkout failed to split revenue into distinct vendor accounts in ledger`
  );
  console.log();

  // -------------------------------------------------------------------------
  // Stress Test 5: Coupon Over-Stacking & Zero-GST Tax Leakage
  // -------------------------------------------------------------------------
  console.log('--- [Stress Test 5: Coupon Over-Stacking & Zero-GST Evaluation] ---');
  const discountReq: PaymentIntentRequest = {
    order_id: 'ORD_STRESS_005',
    idempotency_key: 'idemp_stress_005',
    food_taxable_amount: 100.0,
    delivery_taxable_amount: 50.0,
    promo_discount_amount: 150.0, // Exceeds food cost of ₹100
    wallet_applied_amount: 0.0,
  };

  const discountRes = await finService.processIdempotentCheckout(discountReq);
  console.log(`   Food Taxable: ₹100 | Promo Discount: ₹150`);
  console.log(`   Calculated Net Payable: ₹${discountRes.netPayable} (GST: CGST+SGST = ₹${discountRes.cgstTotal + discountRes.sgstTotal})`);

  // Rigorous Assertions: Food GST should still be paid on pre-discount value if subsidized by platform
  const expectedMinFoodGst = 5.00; // 5% of ₹100
  const actualFoodGst = discountRes.cgstTotal + discountRes.sgstTotal - 9.00; // Total GST minus delivery GST (50 * 18% = 9)
  assert(
    actualFoodGst >= expectedMinFoodGst,
    `Tax Leakage: Coupon code reduced food GST to zero (actual: ₹${actualFoodGst}, expected min: ₹${expectedMinFoodGst})`
  );
  console.log();

  // -------------------------------------------------------------------------
  // Stress Test 6: Refund GST Slab Reversal Invariant Check
  // -------------------------------------------------------------------------
  console.log('--- [Stress Test 6: Refund GST Slab Reversal Audit] ---');
  // Order paid: Food ₹200 (taxed at 5%) + Delivery ₹50 (taxed at 18%)
  // We execute a post-payment refund for the delivery fee (₹50)
  const orderId6 = 'ORD_STRESS_006';
  const req6: PaymentIntentRequest = {
    order_id: orderId6,
    idempotency_key: 'idemp_stress_006',
    food_taxable_amount: 200.0,
    delivery_taxable_amount: 50.0,
    promo_discount_amount: 0.0,
    wallet_applied_amount: 0.0,
  };

  const res6 = await finService.processIdempotentCheckout(req6);
  await finService.handleGatewayWebhook({
    orderId: orderId6,
    intentId: res6.intentId,
    event: 'payment.captured',
    signature: 'valid_signature'
  });

  // Refund the delivery fee (taxed at 18% GST = ₹9)
  const refund6 = await finService.executePostPaymentSubstitutionOrRefund(
    orderId6,
    50.0, // Refund amount
    'Delivery failed',
    [
      {
        materialCode: 'DEL_01',
        materialName: 'Delivery Charge',
        quantity: 1,
        unitPrice: 50,
        unitOfMeasure: 'PCS',
        actualQuantity: 1
      }
    ]
  );

  console.log(`   Refunding Delivery Fee of ₹50 (taxed originally at 18%)`);
  console.log(`   Reversed GST Calculated by Service: CGST ₹${refund6.cgstReversed}, SGST ₹${refund6.sgstReversed}`);

  // Delivery fee refund should reverse 18% GST (₹4.50 CGST + ₹4.50 SGST = ₹9.00 total)
  const expectedGstReversed = 9.00;
  const actualGstReversed = refund6.cgstReversed + refund6.sgstReversed;
  assert(
    Math.abs(actualGstReversed - expectedGstReversed) < 0.01,
    `Incorrect GST reversal on delivery refund! Reversed: ₹${actualGstReversed}, expected: ₹${expectedGstReversed} (Hardcoded 5% rate bug)`
  );
  console.log();

  // -------------------------------------------------------------------------
  // Stress Test 7: Webhook Replay & Double Processing (Atomic CAS Lock Check)
  // -------------------------------------------------------------------------
  console.log('--- [Stress Test 7: Webhook Replay & Double Processing] ---');
  const orderId7 = 'ORD_STRESS_007';
  const req7: PaymentIntentRequest = {
    order_id: orderId7,
    idempotency_key: 'idemp_stress_007',
    food_taxable_amount: 100.0,
    delivery_taxable_amount: 0.0,
    promo_discount_amount: 0.0,
    wallet_applied_amount: 0.0,
  };

  const res7 = await finService.processIdempotentCheckout(req7);

  // Trigger twin webhook delivery captured requests concurrently
  const [webhook1, webhook2] = await Promise.all([
    finService.handleGatewayWebhook({
      orderId: orderId7,
      intentId: res7.intentId,
      event: 'payment.captured',
      signature: 'valid_sig'
    }),
    finService.handleGatewayWebhook({
      orderId: orderId7,
      intentId: res7.intentId,
      event: 'payment.captured',
      signature: 'valid_sig'
    })
  ]);

  console.log(`   First Webhook Processed: ${webhook1.processed} | Status: ${webhook1.orderStatus}`);
  console.log(`   Second Webhook Processed: ${webhook2.processed} | Status: ${webhook2.orderStatus}`);

  // Assert that only ONE webhook is processed successfully
  assert(
    webhook1.processed !== webhook2.processed,
    `Double webhook processing allowed! Webhook 1 processed: ${webhook1.processed}, Webhook 2 processed: ${webhook2.processed}`
  );
  console.log();

  // -------------------------------------------------------------------------
  // Stress Test 8: Multi-Slab GST Calculations Checkout
  // -------------------------------------------------------------------------
  console.log('--- [Stress Test 8: Multi-Slab GST Calculations Checkout] ---');
  // Checkout containing low-tax food (₹100, 5% GST) and carbonated beverage (₹100, 18% GST)
  const req8: PaymentIntentRequest = {
    order_id: 'ORD_STRESS_008',
    idempotency_key: 'idemp_stress_008',
    food_taxable_amount: 200.0, // Combined food/bev taxable
    delivery_taxable_amount: 0.0,
    promo_discount_amount: 0.0,
    wallet_applied_amount: 0.0,
    petpooja_items: [
      {
        materialCode: 'MEAL_01',
        materialName: 'Healthy Salad',
        quantity: 1,
        unitPrice: 100,
        unitOfMeasure: 'PCS',
        taxPercent1: 2.5,
        taxPercent2: 2.5 // 5% GST
      },
      {
        materialCode: 'BEV_01',
        materialName: 'Aerated Cola',
        quantity: 1,
        unitPrice: 100,
        unitOfMeasure: 'PCS',
        taxPercent1: 9.0,
        taxPercent2: 9.0 // 18% GST
      }
    ]
  };

  const res8 = await finService.processIdempotentCheckout(req8);
  // Expected GST calculation:
  // Salad (100 * 5% = 5) + Cola (100 * 18% = 18) = ₹23.00 total GST
  const expectedTotalGst = 23.00;
  const actualTotalGst = res8.cgstTotal + res8.sgstTotal;
  console.log(`   Item 1: ₹100 (5% GST) | Item 2: ₹100 (18% GST)`);
  console.log(`   Total GST Charged: ₹${actualTotalGst} (CGST ₹${res8.cgstTotal}, SGST ₹${res8.sgstTotal})`);

  assert(
    Math.abs(actualTotalGst - expectedTotalGst) < 0.01,
    `Multi-slab GST mismatch! Charged total GST: ₹${actualTotalGst}, expected correct: ₹${expectedTotalGst}`
  );
  console.log();

  // -------------------------------------------------------------------------
  // Double-Entry Ledger Invariant Check
  // -------------------------------------------------------------------------
  console.log('--- [Ledger Balance Invariant Audit] ---');
  const fullLedger = finService.getLedgerJournal();
  console.log(`   Auditing total ledger entries count: ${fullLedger.length}`);
  
  // Group ledger entries by order and check DR vs CR balance
  const orders = Array.from(new Set(fullLedger.map(rec => rec.order_id)));
  for (const ord of orders) {
    const records = fullLedger.filter(rec => rec.order_id === ord);
    let totalDebits = 0;
    let totalCredits = 0;
    records.forEach(rec => {
      // DR accounts increase assets/expenses, decrease liabilities/revenue/equity
      if (rec.debit_account.startsWith('ASSET_') || rec.debit_account.startsWith('LIABILITY_') || rec.debit_account.startsWith('REVENUE_')) {
        totalDebits += rec.amount;
      }
      if (rec.credit_account.startsWith('ASSET_') || rec.credit_account.startsWith('LIABILITY_') || rec.credit_account.startsWith('REVENUE_')) {
        totalCredits += rec.amount;
      }
    });
    console.log(`      Order ${ord}: Total Debits = ₹${totalDebits.toFixed(2)}, Total Credits = ₹${totalCredits.toFixed(2)}`);
    assert(
      Math.abs(totalDebits - totalCredits) < 0.01,
      `Double-Entry Invariant Voilation on Order ${ord}! Debits: ₹${totalDebits.toFixed(2)}, Credits: ₹${totalCredits.toFixed(2)}`
    );
  }
  console.log();

  // -------------------------------------------------------------------------
  // Report cumulative stress testing execution results
  // -------------------------------------------------------------------------
  console.log('====================================================================');
  console.log('🏁 STRESS TEST RUN SUMMARY');
  console.log('====================================================================');
  if (failures.length > 0) {
    console.error(`🔴 FAILURE: Stress test completed with ${failures.length} payment integrity violations!`);
    failures.forEach((fail, idx) => {
      console.error(`   ${idx + 1}. ${fail}`);
    });
    if (require.main === module) {
      process.exit(1);
    } else {
      throw new Error(`Stress test failed with ${failures.length} payment integrity violations`);
    }
  } else {
    console.log('🟢 SUCCESS: All stress test scenarios passed without detecting any payment integrity violations!');
    if (require.main === module) {
      process.exit(0);
    }
  }
}

if (require.main === module) {
  runMoneyPathStressTests().catch(console.error);
}

export { runMoneyPathStressTests };
