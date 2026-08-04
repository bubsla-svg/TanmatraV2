import test from 'node:test';
import assert from 'node:assert/strict';
import { PosStockReconciler } from './PosStockReconciler';
import { PetpoojaStockResponse } from './PetpoojaService';

test('PosStockReconciler.mapPetpoojaToSapStock parses quantities and populates stock items', () => {
  const stockResponse: PetpoojaStockResponse = {
    code: '200',
    success: '1',
    message: 'Success',
    closing_json: [
      {
        sapcode: 'MAT-101',
        name: 'Basmati Rice',
        category: 'Grains',
        unit: 'KG',
        qty: '25.5',
        price: '80.00',
        restaurant_id: 'OUTLET-1'
      },
      {
        sapcode: 'MAT-102',
        name: 'Olive Oil',
        category: 'Oils',
        unit: 'LTR',
        qty: '10.0',
        price: '500.00',
        restaurant_id: 'OUTLET-1'
      }
    ]
  };

  const reconciled = PosStockReconciler.mapPetpoojaToSapStock(stockResponse, '2026-07-29');

  assert.equal(reconciled.date, '2026-07-29');
  assert.equal(reconciled.items.length, 2);
  assert.equal(reconciled.items[0].quantity, 25.5);
  assert.equal(reconciled.items[0].averagePrice, 80.0);
});

test('PosStockReconciler.calculateStockVariances detects variance between POS and ERP', () => {
  const stockResponse: PetpoojaStockResponse = {
    code: '200',
    success: '1',
    message: 'Success',
    closing_json: [
      {
        sapcode: 'MAT-101',
        name: 'Basmati Rice',
        category: 'Grains',
        unit: 'KG',
        qty: '20.0',
        price: '80.00',
        restaurant_id: 'OUTLET-1'
      }
    ]
  };

  const posSnapshot = PosStockReconciler.mapPetpoojaToSapStock(stockResponse, '2026-07-29');
  const erpBalances = new Map<string, number>([['MAT-101', 25.0]]);

  const variances = PosStockReconciler.calculateStockVariances(posSnapshot, erpBalances);

  assert.equal(variances.length, 1);
  assert.equal(variances[0].sapCode, 'MAT-101');
  assert.equal(variances[0].variance, -5.0);
});
