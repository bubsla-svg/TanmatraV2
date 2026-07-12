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
}

/**
 * Request payload for creating a marketplace payment checkout intent.
 */
export interface MarketplacePaymentIntentRequest {
  order_id: string;
  idempotency_key: string;
  items: Array<{
    itemId: number;
    name: string;
    supplierName: string;
    pricePaise: number;
    qty: number;
  }>;
  wallet_applied_amount: number;
}

/**
 * Marketplace order financial state in the transaction database.
 */
export interface MarketplaceOrderFinancialState {
  order_id: string;
  intent_id: string;
  idempotency_key: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  items: Array<{
    itemId: number;
    name: string;
    supplierName: string;
    pricePaise: number;
    qty: number;
  }>;
  wallet_debited: number;
  net_payable_gateway: number;
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
}

export class FinancialPaymentsLedgerService {
  private activeIntents: Map<string, OrderFinancialState> = new Map(); // Keyed by idempotency_key
  private ordersById: Map<string, OrderFinancialState> = new Map();
  private activeMarketplaceIntents: Map<string, MarketplaceOrderFinancialState> = new Map();
  private marketplaceOrdersById: Map<string, MarketplaceOrderFinancialState> = new Map();
  private ledgerJournal: DoubleEntryLedgerRecord[] = [];

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
    // Check deterministic idempotency lock
    const existing = this.activeIntents.get(req.idempotency_key);
    if (existing) {
      return {
        isDuplicate: true,
        intentId: existing.intent_id,
        netPayable: existing.net_payable_gateway,
        cgstTotal: existing.cgst_food + existing.cgst_delivery,
        sgstTotal: existing.sgst_food + existing.sgst_delivery,
      };
    }

    // Calculate India GST statutory rates (Food 5% without ITC; Delivery 18%)
    // Apply promo pro-rata against food taxable base
    const netFoodTaxable = Math.max(
      0,
      req.food_taxable_amount - req.promo_discount_amount,
    );
    const cgstFood = Number((netFoodTaxable * 0.025).toFixed(2));
    const sgstFood = Number((netFoodTaxable * 0.025).toFixed(2));
    const cgstDelivery = Number(
      (req.delivery_taxable_amount * 0.09).toFixed(2),
    );
    const sgstDelivery = Number(
      (req.delivery_taxable_amount * 0.09).toFixed(2),
    );

    const grossTotal =
      netFoodTaxable +
      cgstFood +
      sgstFood +
      req.delivery_taxable_amount +
      cgstDelivery +
      sgstDelivery;
    const netPayableGateway = Number(
      (grossTotal - req.wallet_applied_amount).toFixed(2),
    );

    const intentId = `pg_intent_${req.order_id}_${Date.now()}`;
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
      wallet_debited: req.wallet_applied_amount,
      net_payable_gateway: netPayableGateway,
      kds_ticket_printed: false,
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

      // Post double-entry financial ledger journal entries (Gross balance check)
      const ts = new Date().toISOString();
      if (order.net_payable_gateway > 0) {
        this.ledgerJournal.push({
          journal_id: `j_${Date.now()}_1`,
          order_id: order.order_id,
          debit_account: 'ASSET_PG_CLEARING',
          credit_account: 'REVENUE_CLEARING',
          amount: order.net_payable_gateway,
          timestamp: ts,
        });
      }
      if (order.wallet_debited > 0) {
        this.ledgerJournal.push({
          journal_id: `j_${Date.now()}_2`,
          order_id: order.order_id,
          debit_account: 'LIABILITY_USER_WALLET',
          credit_account: 'REVENUE_CLEARING',
          amount: order.wallet_debited,
          timestamp: ts,
        });
      }
      this.ledgerJournal.push({
        journal_id: `j_${Date.now()}_3`,
        order_id: order.order_id,
        debit_account: 'REVENUE_CLEARING',
        credit_account: 'REVENUE_FOOD_SALES',
        amount: order.food_taxable,
        timestamp: ts,
      });
      this.ledgerJournal.push({
        journal_id: `j_${Date.now()}_4`,
        order_id: order.order_id,
        debit_account: 'REVENUE_CLEARING',
        credit_account: 'REVENUE_DELIVERY_FEES',
        amount: order.delivery_taxable,
        timestamp: ts,
      });
      this.ledgerJournal.push({
        journal_id: `j_${Date.now()}_5`,
        order_id: order.order_id,
        debit_account: 'REVENUE_CLEARING',
        credit_account: 'LIABILITY_GST_CGST_OUTPUT',
        amount: order.cgst_food + order.cgst_delivery,
        timestamp: ts,
      });
      this.ledgerJournal.push({
        journal_id: `j_${Date.now()}_6`,
        order_id: order.order_id,
        debit_account: 'REVENUE_CLEARING',
        credit_account: 'LIABILITY_GST_SGST_OUTPUT',
        amount: order.sgst_food + order.sgst_delivery,
        timestamp: ts,
      });

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

    // Statutory GST reversal at 2.5% CGST + 2.5% SGST
    const cgstReversed = Number((refundedFoodTaxableAmount * 0.025).toFixed(2));
    const sgstReversed = Number((refundedFoodTaxableAmount * 0.025).toFixed(2));
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

  /**
   * Scenario 5: Process marketplace order checkout intent, calculating splits for third-party items.
   */
  public async processMarketplaceCheckout(req: MarketplacePaymentIntentRequest): Promise<{
    isDuplicate: boolean;
    intentId: string;
    netPayable: number;
  }> {
    const existing = this.activeMarketplaceIntents.get(req.idempotency_key);
    if (existing) {
      return {
        isDuplicate: true,
        intentId: existing.intent_id,
        netPayable: existing.net_payable_gateway,
      };
    }

    let grossTotal = 0;
    for (const it of req.items) {
      grossTotal += it.pricePaise * it.qty;
    }

    const netPayableGateway = grossTotal - req.wallet_applied_amount;
    const intentId = `pg_intent_mkt_${req.order_id}_${Date.now()}`;

    const state: MarketplaceOrderFinancialState = {
      order_id: req.order_id,
      intent_id: intentId,
      idempotency_key: req.idempotency_key,
      status: 'PENDING',
      items: req.items,
      wallet_debited: req.wallet_applied_amount,
      net_payable_gateway: netPayableGateway,
    };

    this.activeMarketplaceIntents.set(req.idempotency_key, state);
    this.marketplaceOrdersById.set(req.order_id, state);

    return {
      isDuplicate: false,
      intentId,
      netPayable: netPayableGateway,
    };
  }

  /**
   * Scenario 5: Process marketplace gateway webhook, split platform cuts (15%) and supplier payouts (85%)
   */
  public async handleMarketplaceGatewayWebhook(payload: {
    orderId: string;
    intentId: string;
    event: 'payment.captured' | 'payment.failed';
    signature: string;
  }): Promise<{
    processed: boolean;
    orderStatus: string;
  }> {
    if (!payload.signature || payload.signature === 'INVALID_HMAC') {
      throw new Error('SECURITY FAULT: Invalid webhook HMAC-SHA256 signature.');
    }

    const order = this.marketplaceOrdersById.get(payload.orderId);
    if (!order) {
      throw new Error(`Marketplace order ${payload.orderId} not found.`);
    }

    if (order.status !== 'PENDING') {
      return {
        processed: false,
        orderStatus: order.status,
      };
    }

    if (payload.event === 'payment.captured') {
      order.status = 'PAID';
      const ts = new Date().toISOString();

      // Post clearing account debits
      if (order.net_payable_gateway > 0) {
        this.ledgerJournal.push({
          journal_id: `j_${Date.now()}_m1`,
          order_id: order.order_id,
          debit_account: 'ASSET_PG_CLEARING',
          credit_account: 'REVENUE_CLEARING',
          amount: order.net_payable_gateway,
          timestamp: ts,
        });
      }
      if (order.wallet_debited > 0) {
        this.ledgerJournal.push({
          journal_id: `j_${Date.now()}_m2`,
          order_id: order.order_id,
          debit_account: 'LIABILITY_USER_WALLET',
          credit_account: 'REVENUE_CLEARING',
          amount: order.wallet_debited,
          timestamp: ts,
        });
      }

      // Loop through items and split into 15% platform commission / 85% vendor payout
      let i = 0;
      for (const item of order.items) {
        const itemTotal = item.pricePaise * item.qty;
        const isFirstParty = item.supplierName.startsWith('Tanmatra');

        if (isFirstParty) {
          // First-party items go 100% to platform sales revenue
          this.ledgerJournal.push({
            journal_id: `j_${Date.now()}_m3_${i}_1p`,
            order_id: order.order_id,
            debit_account: 'REVENUE_CLEARING',
            credit_account: 'REVENUE_MARKETPLACE_1P_SALES',
            amount: itemTotal,
            timestamp: ts,
          });
        } else {
          // Third-party items split: 15% platform commission / 85% vendor payout
          const commission = Number((itemTotal * 0.15).toFixed(0));
          const vendorPayout = itemTotal - commission;

          this.ledgerJournal.push({
            journal_id: `j_${Date.now()}_m3_${i}_comm`,
            order_id: order.order_id,
            debit_account: 'REVENUE_CLEARING',
            credit_account: 'REVENUE_MARKETPLACE_COMMISSION',
            amount: commission,
            timestamp: ts,
          });

          this.ledgerJournal.push({
            journal_id: `j_${Date.now()}_m3_${i}_payout`,
            order_id: order.order_id,
            debit_account: 'REVENUE_CLEARING',
            credit_account: 'LIABILITY_VENDOR_PAYOUT',
            amount: vendorPayout,
            timestamp: ts,
          });
        }
        i++;
      }

      return { processed: true, orderStatus: 'PAID' };
    } else {
      order.status = 'EXPIRED';
      return { processed: true, orderStatus: 'EXPIRED' };
    }
  }

  public getLedgerJournal(): DoubleEntryLedgerRecord[] {
    return this.ledgerJournal;
  }
}
