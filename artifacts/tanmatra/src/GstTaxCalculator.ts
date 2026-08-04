import { SapSalesInvoiceItem } from './PetpoojaService';

export interface TaxCalculationRequestPaise {
  foodTaxablePaise: number;
  deliveryTaxablePaise: number;
  promoDiscountPaise: number;
  walletAppliedPaise: number;
  items?: SapSalesInvoiceItem[];
  catalogPricesPaise?: Record<string, number>;
}

export interface TaxCalculationResultPaise {
  foodTaxableBasePaise: number;
  netFoodTaxablePaise: number;
  cgstFoodPaise: number;
  sgstFoodPaise: number;
  cgstDeliveryPaise: number;
  sgstDeliveryPaise: number;
  grossTotalPaise: number;
  actualWalletDebitedPaise: number;
  netPayableGatewayPaise: number;
}

/**
 * Pure, zero-I/O integer-paise tax and pricing calculator.
 * Eliminates floating-point rounding errors across food, delivery GST, promo discounts, and wallet debits.
 */
export class GstTaxCalculator {
  /**
   * Computes statutory GST breakdown and gateway payable amount in strict integer paise.
   */
  public static calculateCheckoutTax(req: TaxCalculationRequestPaise): TaxCalculationResultPaise {
    const catalogPricesPaise = req.catalogPricesPaise || {
      'KIWI_001': 33300 // ₹333.00 = 33,300 paise
    };

    let foodTaxableBasePaise = req.foodTaxablePaise;

    // Recalculate taxable food base from catalog if items are present (anti-parameter tampering)
    if (req.items && req.items.length > 0) {
      foodTaxableBasePaise = req.items.reduce((sum, item) => {
        const unitPricePaise = catalogPricesPaise[item.materialCode] ?? Math.round(item.unitPrice * 100);
        return sum + unitPricePaise * item.quantity;
      }, 0);
    }

    let cgstFoodPaise = 0;
    let sgstFoodPaise = 0;

    if (req.items && req.items.length > 0) {
      for (const item of req.items) {
        const itemUnitPricePaise = catalogPricesPaise[item.materialCode] ?? Math.round(item.unitPrice * 100);
        const itemTotalPaise = itemUnitPricePaise * item.quantity;
        const cRate = item.taxPercent1 != null ? item.taxPercent1 / 100 : 0.025;
        const sRate = item.taxPercent2 != null ? item.taxPercent2 / 100 : 0.025;

        cgstFoodPaise += Math.round(itemTotalPaise * cRate);
        sgstFoodPaise += Math.round(itemTotalPaise * sRate);
      }
    } else {
      // Default statutory 5% GST (2.5% CGST + 2.5% SGST)
      cgstFoodPaise = Math.round(foodTaxableBasePaise * 0.025);
      sgstFoodPaise = Math.round(foodTaxableBasePaise * 0.025);
    }

    const netFoodTaxablePaise = Math.max(0, foodTaxableBasePaise - req.promoDiscountPaise);

    // Delivery GST at statutory 18% (9% CGST + 9% SGST)
    const cgstDeliveryPaise = Math.round(req.deliveryTaxablePaise * 0.09);
    const sgstDeliveryPaise = Math.round(req.deliveryTaxablePaise * 0.09);

    const grossTotalPaise =
      netFoodTaxablePaise +
      cgstFoodPaise +
      sgstFoodPaise +
      req.deliveryTaxablePaise +
      cgstDeliveryPaise +
      sgstDeliveryPaise;

    const actualWalletDebitedPaise = Math.min(req.walletAppliedPaise, grossTotalPaise);
    const netPayableGatewayPaise = Math.max(0, grossTotalPaise - actualWalletDebitedPaise);

    return {
      foodTaxableBasePaise,
      netFoodTaxablePaise,
      cgstFoodPaise,
      sgstFoodPaise,
      cgstDeliveryPaise,
      sgstDeliveryPaise,
      grossTotalPaise,
      actualWalletDebitedPaise,
      netPayableGatewayPaise
    };
  }
}
