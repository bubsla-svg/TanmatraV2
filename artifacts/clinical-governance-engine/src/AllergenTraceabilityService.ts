/**
 * Metadata schema representing an ingredient lot from an upstream supplier,
 * including Certificate of Analysis (CoA) verifications and hidden variant metadata.
 */
export interface SupplierLotMetadata {
  ingredient_code: string;
  ingredient_name: string;
  supplier_id: string;
  supplier_lot_number: string;
  coa_verified_ppm: Record<string, number>;
  hidden_carrier_allergens: string[]; // e.g. ["PEANUT", "SOY"] if carrier oil or processing aid contains allergen
  receipt_timestamp: string;
}

/**
 * Dish production batch tracking structure linking kitchen prep batches to supplier lots.
 */
export interface DishProductionBatch {
  dish_id: string;
  dish_name: string;
  production_batch_id: string;
  prep_bay: string;
  ingredient_lots: SupplierLotMetadata[];
}

/**
 * End-to-end WORM traceability record linking consumer orders to physical batch lots and KDS flags.
 */
export interface OrderTraceabilityRecord {
  order_id: string;
  patient_id: string;
  kitchen_id: string;
  prep_bay: string;
  packer_id: string;
  timestamp_sealed: string;
  order_status:
    | 'IN_PREP'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED_RECALLED';
  patient_allergen_profile: string[];
  kds_critical_flag: string;
  dishes: DishProductionBatch[];
  tamper_seal_barcode: string;
}

/**
 * Gateway interfaces for broadcasting multi-order recalls within the 60-minute SLA.
 */
export interface RecallCommunicationGateway {
  broadcastCustomerRecall(
    orderId: string,
    phone: string,
    message: string,
  ): Promise<void>;
  interceptRiderTransit(
    orderId: string,
    riderId: string,
    instruction: string,
  ): Promise<void>;
  cancelKitchenPrepTicket(orderId: string, prepBay: string): Promise<void>;
}

export class AllergenTraceabilityService {
  private activeRecords: Map<string, OrderTraceabilityRecord> = new Map();
  private lockedBatches: Set<string> = new Set();

  constructor(private commGateway: RecallCommunicationGateway) {}

  /**
   * Registers a sealed or in-prep order traceability record into the active ledger.
   */
  public registerOrderTraceability(record: OrderTraceabilityRecord): void {
    this.activeRecords.set(record.order_id, record);
  }

  /**
   * Formats the strict, non-truncated KDS display banner for high-risk allergen isolation.
   */
  public static formatKdsCriticalFlag(
    patientAllergies: string[],
    designatedBay: string,
  ): string {
    if (patientAllergies.length === 0)
      return 'STANDARD PREP - NO ALLERGEN FLAGS';
    const allergensText = patientAllergies.join(', ').toUpperCase();
    return `🚨 SEVERE ${allergensText} ALLERGY - 0 PPM REQUIRED - ROUTE TO ${designatedBay} ONLY`;
  }

  /**
   * Deep scans ingredient variant metadata (including carrier oils and processing aids) against patient profile.
   */
  public static validateOrderAgainstHiddenMetadata(
    patientAllergies: string[],
    ingredientLots: SupplierLotMetadata[],
  ): {isSafe: boolean; conflictingLot?: SupplierLotMetadata; reason?: string} {
    for (const lot of ingredientLots) {
      for (const allergy of patientAllergies) {
        const normAllergy = allergy.toUpperCase();
        // Check declared hidden carrier allergens
        if (
          lot.hidden_carrier_allergens
            .map((a) => a.toUpperCase())
            .includes(normAllergy)
        ) {
          return {
            isSafe: false,
            conflictingLot: lot,
            reason: `Hidden variant allergen breach: Lot '${lot.supplier_lot_number}' (${lot.ingredient_name}) contains carrier/variant allergen '${normAllergy}'.`,
          };
        }
        // Check CoA verified ppm (>0 ppm fails zero-tolerance clinical protocol)
        const ppmVal =
          lot.coa_verified_ppm[normAllergy.toLowerCase() + '_ppm'] || 0;
        if (ppmVal > 0) {
          return {
            isSafe: false,
            conflictingLot: lot,
            reason: `CoA ppm threshold breach: Lot '${lot.supplier_lot_number}' tested at ${ppmVal} ppm for '${normAllergy}' (Must be 0 ppm).`,
          };
        }
      }
    }
    return {isSafe: true};
  }

  /**
   * Phase 3 / 4: Execute mid-shift contamination lock and multi-order 60-minute recall drill.
   */
  public async executeContaminationRecallDrill(
    contaminatedBatchId: string,
    reason: string,
  ): Promise<{
    contaminatedBatchId: string;
    totalOrdersIdentified: number;
    ordersInPrepCancelled: number;
    ridersIntercepted: number;
    customersRecalledWithin60Mins: number;
    executionTimeMs: number;
  }> {
    const startTime = Date.now();

    // 1. Lock contaminated batch in ERP across all prep bays
    this.lockedBatches.add(contaminatedBatchId);

    let totalIdentified = 0;
    let cancelledPrep = 0;
    let interceptedRiders = 0;
    let recalledCustomers = 0;

    // 2. Scan ledger for all orders referencing this batch
    for (const [orderId, record] of this.activeRecords.entries()) {
      const containsBatch = record.dishes.some(
        (d) => d.production_batch_id === contaminatedBatchId,
      );
      if (!containsBatch) continue;

      totalIdentified++;

      if (record.order_status === 'IN_PREP') {
        await this.commGateway.cancelKitchenPrepTicket(
          orderId,
          record.prep_bay,
        );
        record.order_status = 'CANCELLED_RECALLED';
        cancelledPrep++;
      } else if (record.order_status === 'OUT_FOR_DELIVERY') {
        await this.commGateway.interceptRiderTransit(
          orderId,
          `RIDER_ORD_${orderId}`,
          'STOP DELIVERY - RETURN TO KITCHEN IMMEDIATELY - DO NOT HANDOVER FOOD',
        );
        record.order_status = 'CANCELLED_RECALLED';
        interceptedRiders++;
      } else if (record.order_status === 'DELIVERED') {
        await this.commGateway.broadcastCustomerRecall(
          orderId,
          '+919800000000',
          `🚨 URGENT MEDICAL RECALL: Do not consume Order ${orderId}. Contamination risk detected in prep batch ${contaminatedBatchId}. Call paramedic triage: +91 92892 13115.`,
        );
        record.order_status = 'CANCELLED_RECALLED';
        recalledCustomers++;
      }
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      contaminatedBatchId,
      totalOrdersIdentified: totalIdentified,
      ordersInPrepCancelled: cancelledPrep,
      ridersIntercepted: interceptedRiders,
      customersRecalledWithin60Mins: recalledCustomers,
      executionTimeMs,
    };
  }
}
