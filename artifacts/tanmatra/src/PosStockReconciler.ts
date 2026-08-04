import {
  PetpoojaStockResponse,
  SapStockReconciliation,
  SapStockItem
} from './PetpoojaService';

export interface StockDiscrepancy {
  sapCode: string;
  materialName: string;
  posQty: number;
  expectedQty?: number;
  variance?: number;
}

/**
 * Domain engine for POS closing stock reconciliation and delta analysis.
 */
export class PosStockReconciler {
  /**
   * Reconciles raw Petpooja stock API response into a structured SAP Stock Reconciliation domain object.
   */
  public static mapPetpoojaToSapStock(
    response: PetpoojaStockResponse,
    date: string
  ): SapStockReconciliation {
    const items: SapStockItem[] = response.closing_json.map(item => {
      const parsedQty = parseFloat(item.qty);
      const parsedPrice = parseFloat(item.price);

      return {
        materialCode: item.sapcode,
        materialName: item.name,
        category: item.category,
        unitOfMeasure: item.unit,
        quantity: isNaN(parsedQty) ? 0 : parsedQty,
        averagePrice: isNaN(parsedPrice) ? 0 : parsedPrice
      };
    });

    return {
      date,
      items
    };
  }

  /**
   * Calculates inventory variances between POS stock snapshot and expected ERP ledger balances.
   */
  public static calculateStockVariances(
    posSnapshot: SapStockReconciliation,
    erpBalances: Map<string, number>
  ): StockDiscrepancy[] {
    const discrepancies: StockDiscrepancy[] = [];
    const processedCodes = new Set<string>();

    for (const item of posSnapshot.items) {
      processedCodes.add(item.materialCode);
      const expected = erpBalances.get(item.materialCode) || 0;
      const variance = item.quantity - expected;
      
      if (Math.abs(variance) > 0.001) {
        discrepancies.push({
          sapCode: item.materialCode,
          materialName: item.materialName,
          posQty: item.quantity,
          expectedQty: expected,
          variance: Number(variance.toFixed(3))
        });
      }
    }

    for (const [sapCode, expectedQty] of erpBalances.entries()) {
      if (!processedCodes.has(sapCode) && Math.abs(expectedQty) > 0.001) {
        discrepancies.push({
          sapCode,
          materialName: 'Unknown (Missing in POS)',
          posQty: 0,
          expectedQty,
          variance: Number((0 - expectedQty).toFixed(3))
        });
      }
    }

    return discrepancies;
  }
}
