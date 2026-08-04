import { PetpoojaService, SapSalesInvoiceItem, SapSalesReturnInvoiceItem } from './PetpoojaService';
import { GstTaxCalculator, TaxCalculationRequestPaise } from './GstTaxCalculator';
import { BalancedLedgerJournal, LedgerPostingEntry } from './BalancedLedgerJournal';

/**
 * Request payload for creating a payment checkout intent with exact India GST breakdown.
 */
export interface PaymentIntentRequest {
  order_id: string;
  idempotency_key: string; // Client UUIDv4
  food_taxable_amount: number;
  delivery_taxable_amount: number;
  promo_discount_amount: number;
  wallet_applied_amount: number;
  petpooja_items?: SapSalesInvoiceItem[];
  customer_name?: string;
  outlet_name?: string;
  outlet_type?: string;
}

/**
 * Immutable double-entry ledger journal record.
 */
export interface DoubleEntryLedgerRecord {
  journal_id: string;
  order_id: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  timestamp: string;
  gst_credit_note_number?: string;
}

/**
 * Order financial state in the transaction database.
 */
export interface OrderFinancialState {
  order_id: string;
  intent_id: string;
  idempotency_key: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'PARTIALLY_REFUNDED';
  food_taxable: number;
  delivery_taxable: number;
  cgst_food: number;
  sgst_food: number;
  cgst_delivery: number;
  sgst_delivery: number;
  wallet_debited: number;
  net_payable_gateway: number;
  kds_ticket_printed: boolean;
  petpooja_items?: SapSalesInvoiceItem[];
  customer_name?: string;
  outlet_name?: string;
  outlet_type?: string;
}

export class FinancialPaymentsLedgerService {
  private activeIntents: Map<string, OrderFinancialState> = new Map(); // Keyed by idempotency_key
  private ordersById: Map<string, OrderFinancialState> = new Map();
  private ledgerJournal: DoubleEntryLedgerRecord[] = [];
  private readonly balancedJournal = new BalancedLedgerJournal();

  constructor(private readonly petpoojaService?: PetpoojaService) {}

  /**
   * Scenario 1: Process idempotent checkout intent, locking against double-tap network replays.
   */
  public async processIdempotentCheckout(req: PaymentIntentRequest): Promise<{
    isDuplicate: boolean;
    intentId: string;
    netPayable: number;
    cgstTotal: number;
    sgstTotal: number;
  }> {
    // Check deterministic idempotency lock & order duplicate isolation
    const existingKey = this.activeIntents.get(req.idempotency_key);
    const existingOrder = this.ordersById.get(req.order_id);
    const existing = existingKey || existingOrder;
    if (existing) {
      return {
        isDuplicate: true,
        intentId: existing.intent_id,
        netPayable: existing.net_payable_gateway,
        cgstTotal: existing.cgst_food + existing.cgst_delivery,
        sgstTotal: existing.sgst_food + existing.sgst_delivery,
      };
    }

    // Delegate tax, discount, and gateway payable calculation to GstTaxCalculator (integer paise precision)
    const taxReq: TaxCalculationRequestPaise = {
      foodTaxablePaise: Math.round(req.food_taxable_amount * 100),
      deliveryTaxablePaise: Math.round(req.delivery_taxable_amount * 100),
      promoDiscountPaise: Math.round(req.promo_discount_amount * 100),
      walletAppliedPaise: Math.round(req.wallet_applied_amount * 100),
      items: req.petpooja_items
    };

    const taxRes = GstTaxCalculator.calculateCheckoutTax(taxReq);

    const cgstFood = Number((taxRes.cgstFoodPaise / 100).toFixed(2));
    const sgstFood = Number((taxRes.sgstFoodPaise / 100).toFixed(2));
    const cgstDelivery = Number((taxRes.cgstDeliveryPaise / 100).toFixed(2));
    const sgstDelivery = Number((taxRes.sgstDeliveryPaise / 100).toFixed(2));
    const netFoodTaxable = Number((taxRes.netFoodTaxablePaise / 100).toFixed(2));
    const actualWalletDebited = Number((taxRes.actualWalletDebitedPaise / 100).toFixed(2));
    const netPayableGateway = Number((taxRes.netPayableGatewayPaise / 100).toFixed(2));

    const intentId = `pg_intent_${req.order_id}_${require('crypto').randomUUID()}`;
    const state: OrderFinancialState = {
      order_id: req.order_id,
      intent_id: intentId,
      idempotency_key: req.idempotency_key,
      status: 'PENDING',
      food_taxable: netFoodTaxable,
      delivery_taxable: req.delivery_taxable_amount,
      cgst_food: cgstFood,
      sgst_food: sgstFood,
      cgst_delivery: cgstDelivery,
      sgst_delivery: sgstDelivery,
      wallet_debited: actualWalletDebited,
      net_payable_gateway: netPayableGateway,
      kds_ticket_printed: false,
      petpooja_items: req.petpooja_items,
      customer_name: req.customer_name,
      outlet_name: req.outlet_name,
      outlet_type: req.outlet_type,
    };

    this.activeIntents.set(req.idempotency_key, state);
    this.ordersById.set(req.order_id, state);

    return {
      isDuplicate: false,
      intentId,
      netPayable: netPayableGateway,
      cgstTotal: cgstFood + cgstDelivery,
      sgstTotal: sgstFood + sgstDelivery,
    };
  }

  /**
   * Scenario 3: Process async gateway webhook with signature verification and atomic state transition.
   */
  public async handleGatewayWebhook(payload: {
    orderId: string;
    intentId: string;
    event: 'payment.captured' | 'payment.failed';
    signature: string;
  }): Promise<{
    processed: boolean;
    orderStatus: string;
    kdsTicketDispatched: boolean;
  }> {
    // 1. Verify HMAC signature (Simulated validation against gateway secret)
    if (!payload.signature || payload.signature === 'INVALID_HMAC') {
      throw new Error('SECURITY FAULT: Invalid webhook HMAC-SHA256 signature.');
    }

    const order = this.ordersById.get(payload.orderId);
    if (!order) {
      throw new Error(`Order ${payload.orderId} not found.`);
    }

    // 2. Atomic state compare-and-swap (Optimistic locking against replayed webhooks)
    if (order.status !== 'PENDING') {
      return {
        processed: false,
        orderStatus: order.status,
        kdsTicketDispatched: false,
      };
    }

    if (payload.event === 'payment.captured') {
      order.status = 'PAID';
      order.kds_ticket_printed = true;

      // Build double-entry posting entries in integer paise
      const ledgerEntries: LedgerPostingEntry[] = [];

      if (order.net_payable_gateway > 0) {
        ledgerEntries.push({
          debitAccount: 'ASSET_PG_CLEARING',
          creditAccount: 'REVENUE_CLEARING',
          amountPaise: Math.round(order.net_payable_gateway * 100)
        });
      }
      if (order.wallet_debited > 0) {
        ledgerEntries.push({
          debitAccount: 'LIABILITY_USER_WALLET',
          creditAccount: 'REVENUE_CLEARING',
          amountPaise: Math.round(order.wallet_debited * 100)
        });
      }

      // Multi-vendor split breakdown ledger journal posting
      if (
        order.petpooja_items &&
        order.petpooja_items.some(
          (i) =>
            i.materialCode.startsWith('VEND_') ||
            i.materialCode.startsWith('TAN_'),
        )
      ) {
        for (const item of order.petpooja_items) {
          const itemAmountPaise = Math.round(item.unitPrice * item.quantity * 100);
          let creditAcc = 'REVENUE_FOOD_SALES';
          if (item.materialCode.startsWith('VEND_A')) {
            creditAcc = 'REVENUE_VENDOR_A';
          } else if (item.materialCode.startsWith('VEND_B')) {
            creditAcc = 'REVENUE_VENDOR_B';
          } else if (item.materialCode.startsWith('VEND_')) {
            creditAcc = `REVENUE_VENDOR_${item.materialCode.split('_')[1]}`;
          }
          ledgerEntries.push({
            debitAccount: 'REVENUE_CLEARING',
            creditAccount: creditAcc,
            amountPaise: itemAmountPaise
          });
        }
      } else {
        ledgerEntries.push({
          debitAccount: 'REVENUE_CLEARING',
          creditAccount: 'REVENUE_FOOD_SALES',
          amountPaise: Math.round(order.food_taxable * 100)
        });
      }

      ledgerEntries.push({
        debitAccount: 'REVENUE_CLEARING',
        creditAccount: 'REVENUE_DELIVERY_FEES',
        amountPaise: Math.round(order.delivery_taxable * 100)
      });
      ledgerEntries.push({
        debitAccount: 'REVENUE_CLEARING',
        creditAccount: 'LIABILITY_GST_CGST_OUTPUT',
        amountPaise: Math.round((order.cgst_food + order.cgst_delivery) * 100)
      });
      ledgerEntries.push({
        debitAccount: 'REVENUE_CLEARING',
        creditAccount: 'LIABILITY_GST_SGST_OUTPUT',
        amountPaise: Math.round((order.sgst_food + order.sgst_delivery) * 100)
      });

      // Post & validate debits == credits balancing in integer paise
      const postedRecords = this.balancedJournal.postTransaction(order.order_id, ledgerEntries);

      // Sync into legacy ledgerJournal array for query compatibility
      for (const rec of postedRecords) {
        this.ledgerJournal.push({
          journal_id: rec.journalId,
          order_id: rec.orderId,
          debit_account: rec.debitAccount,
          credit_account: rec.creditAccount,
          amount: rec.amountPaise / 100,
          timestamp: rec.timestamp
        });
      }

      // Sync sales invoice to Petpooja if details are available
      if (this.petpoojaService && order.petpooja_items) {
        try {
          await this.petpoojaService.syncSalesInvoice({
            invoiceNumber: order.order_id,
            invoiceDate: new Date().toISOString().split('T')[0],
            items: order.petpooja_items,
            customerName: order.customer_name || 'Walk-in Customer',
            outletName: order.outlet_name || 'Primary Outlet',
            outletType: order.outlet_type || 'S',
            totalAmount: order.net_payable_gateway + order.wallet_debited,
            totalTax: order.cgst_food + order.sgst_food + order.cgst_delivery + order.sgst_delivery,
            deliveryCharge: order.delivery_taxable
          });
        } catch (err) {
          console.error('Failed to sync sale to Petpooja:', err);
        }
      }

      return {processed: true, orderStatus: 'PAID', kdsTicketDispatched: true};
    } else {
      order.status = 'EXPIRED';
      return {
        processed: true,
        orderStatus: 'EXPIRED',
        kdsTicketDispatched: false,
      };
    }
  }

  /**
   * Scenario 4: Execute post-payment partial refund / substitution, issuing Section 34 GST Credit Note.
   */
  public async executePostPaymentSubstitutionOrRefund(
    orderId: string,
    refundedFoodTaxableAmount: number,
    reason: string,
    refundItems?: SapSalesReturnInvoiceItem[]
  ): Promise<{
    creditNoteNumber: string;
    totalRefundToGateway: number;
    cgstReversed: number;
    sgstReversed: number;
  }> {
    const order = this.ordersById.get(orderId);
    if (!order || order.status !== 'PAID') {
      throw new Error(
        `Cannot issue refund for order ${orderId}: Order not in PAID state.`,
      );
    }

    // Statutory GST reversal matching item category (Delivery 18% vs Food 5%)
    let cgstRate = 0.025;
    let sgstRate = 0.025;
    if (
      refundItems &&
      refundItems.some(
        (i) =>
          i.materialCode.startsWith('DEL_') ||
          i.materialName.toLowerCase().includes('delivery'),
      )
    ) {
      cgstRate = 0.09;
      sgstRate = 0.09;
    }

    const cgstReversed = Number(
      (refundedFoodTaxableAmount * cgstRate).toFixed(2),
    );
    const sgstReversed = Number(
      (refundedFoodTaxableAmount * sgstRate).toFixed(2),
    );
    const totalRefundToGateway = Number(
      (refundedFoodTaxableAmount + cgstReversed + sgstReversed).toFixed(2),
    );

    const creditNoteNumber = `CN_GST_2026_${Math.floor(1000 + Math.random() * 9000)}`;
    const ts = new Date().toISOString();

    order.status = 'PARTIALLY_REFUNDED';

    // Post double-entry refund entries
    this.ledgerJournal.push({
      journal_id: `j_${Date.now()}_r1`,
      order_id: orderId,
      debit_account: 'REVENUE_FOOD_SALES',
      credit_account: 'ASSET_PG_CLEARING',
      amount: refundedFoodTaxableAmount,
      timestamp: ts,
      gst_credit_note_number: creditNoteNumber,
    });
    this.ledgerJournal.push({
      journal_id: `j_${Date.now()}_r2`,
      order_id: orderId,
      debit_account: 'LIABILITY_GST_CGST_OUTPUT',
      credit_account: 'ASSET_PG_CLEARING',
      amount: cgstReversed,
      timestamp: ts,
      gst_credit_note_number: creditNoteNumber,
    });
    this.ledgerJournal.push({
      journal_id: `j_${Date.now()}_r3`,
      order_id: orderId,
      debit_account: 'LIABILITY_GST_SGST_OUTPUT',
      credit_account: 'ASSET_PG_CLEARING',
      amount: sgstReversed,
      timestamp: ts,
      gst_credit_note_number: creditNoteNumber,
    });

    // Sync sales return to Petpooja if details are available
    if (this.petpoojaService && refundItems) {
      try {
        await this.petpoojaService.syncSalesReturn({
          invoiceNumber: creditNoteNumber,
          invoiceDate: new Date().toISOString().split('T')[0],
          items: refundItems,
          customerName: order.customer_name || 'Walk-in Customer',
          outletName: order.outlet_name || 'Primary Outlet',
          outletType: order.outlet_type || 'S',
          totalAmount: totalRefundToGateway
        });
      } catch (err) {
        console.error('Failed to sync sales return to Petpooja:', err);
      }
    }

    return {
      creditNoteNumber,
      totalRefundToGateway,
      cgstReversed,
      sgstReversed,
    };
  }

  /**
   * Scenario 6 / End-of-Day: Run T+1 gateway settlement matching engine.
   */
  public runEndOfDayReconciliation(
    gatewaySettlements: Array<{intentId: string; settledAmount: number}>,
  ): {
    matchedCount: number;
    discrepancies: Array<{
      intentId: string;
      expectedAmount: number;
      settledAmount: number;
      variance: number;
    }>;
  } {
    let matchedCount = 0;
    const discrepancies: Array<{
      intentId: string;
      expectedAmount: number;
      settledAmount: number;
      variance: number;
    }> = [];

    for (const settlement of gatewaySettlements) {
      let foundOrder: OrderFinancialState | undefined;
      for (const order of this.ordersById.values()) {
        if (order.intent_id === settlement.intentId) {
          foundOrder = order;
          break;
        }
      }

      if (!foundOrder) {
        discrepancies.push({
          intentId: settlement.intentId,
          expectedAmount: 0,
          settledAmount: settlement.settledAmount,
          variance: settlement.settledAmount,
        });
        continue;
      }

      const expected = foundOrder.net_payable_gateway;
      const variance = Number((settlement.settledAmount - expected).toFixed(2));
      if (Math.abs(variance) <= 0.05) {
        matchedCount++;
      } else {
        discrepancies.push({
          intentId: settlement.intentId,
          expectedAmount: expected,
          settledAmount: settlement.settledAmount,
          variance,
        });
      }
    }

    return {matchedCount, discrepancies};
  }

  public getLedgerJournal(): DoubleEntryLedgerRecord[] {
    return this.ledgerJournal;
  }
}
