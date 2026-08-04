import test from 'node:test';
import assert from 'node:assert/strict';
import { ErpInvoiceMapper, PetpoojaAuthConfig } from './ErpInvoiceMapper';
import { SapPurchaseInvoice, SapPurchaseReturnInvoice, SapRawMaterial } from './PetpoojaService';

const mockConfig: PetpoojaAuthConfig = {
  appKey: 'test_key',
  appSecret: 'test_secret',
  accessToken: 'test_token',
  menuSharingCode: 'test_code'
};

test('ErpInvoiceMapper.mapSapToPetpooja correctly maps purchase invoice with batch info', () => {
  const sapInvoice: SapPurchaseInvoice = {
    invoiceNumber: 'INV-1001',
    invoiceDate: '2026-07-29',
    supplierName: 'Organic Foods Ltd',
    outletName: 'Koramangala Kitchen',
    outletType: 'CloudKitchen',
    totalAmount: 1500.0,
    totalTax: 75.0,
    totalDiscount: 0,
    deliveryCharge: 50.0,
    items: [
      {
        materialCode: 'MAT-001',
        materialName: 'Quinoa Grain',
        quantity: 10,
        unitPrice: 150.0,
        unitOfMeasure: 'KG',
        batchNumber: 'B20260729',
        expiryDate: '2026-12-31'
      }
    ]
  };

  const mapped = ErpInvoiceMapper.mapSapToPetpooja(sapInvoice, mockConfig);

  assert.equal(mapped.app_key, 'test_key');
  assert.equal(mapped.Purchase.invoiceNumber, 'INV-1001');
  assert.equal(mapped.Purchase.enable_batch_wise_inventory, 'yes');
  assert.equal(mapped.Purchase.itemDetails.length, 1);
  assert.equal(mapped.Purchase.itemDetails[0].itemName, 'Quinoa Grain');
  assert.equal(mapped.Purchase.itemDetails[0].batch_code, 'B20260729');
  assert.equal(mapped.Purchase.itemDetails[0].price, '150.00');
  assert.equal(mapped.Purchase.itemDetails[0].amount, '1500.00');
});

test('ErpInvoiceMapper.mapSapToPetpoojaReturn maps return invoice DTO', () => {
  const returnInvoice: SapPurchaseReturnInvoice = {
    invoiceNumber: 'RET-2001',
    invoiceDate: '2026-07-29',
    supplierName: 'Fresh Produce Vendor',
    outletName: 'Indiranagar Outlet',
    outletType: 'Outlet',
    items: [
      {
        materialCode: 'MAT-002',
        materialName: 'Avocado',
        quantity: 5,
        unitPrice: 120.0,
        unitOfMeasure: 'KG'
      }
    ]
  };

  const mapped = ErpInvoiceMapper.mapSapToPetpoojaReturn(returnInvoice, mockConfig);

  assert.equal(mapped.Sale.invoiceNumber, 'RET-2001');
  assert.equal(mapped.Sale.updateStock, '1');
  assert.equal(mapped.Sale.itemDetails[0].sapCode, 'MAT-002');
});
