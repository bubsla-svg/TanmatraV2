export interface FleetPartnerStatus {
  partnerId: string;
  partnerName: string;
  isOnline: boolean;
  acceptanceRatePercent: number;
  avgApiLatencyMs: number;
  costPerDeliveryInr: number;
}

export interface DispatchAllocationResult {
  orderId: string;
  assignedPartnerId: string;
  assignedPartnerName: string;
  trackingId: string;
  failoverTriggered: boolean;
  decisionLatencyMs: number;
  costSurplusInr: number;
  reason: string;
}

export class LogisticsDispatchResilienceService {
  /**
   * Simulation 1 & 4: Executes waterfall failover dispatch when primary 3PL partner experiences
   * API timeout spikes (>2500ms), low acceptance (<70%), or hard outages.
   */
  public async executeFailoverDispatch(
    orderId: string,
    primary: FleetPartnerStatus,
    secondary: FleetPartnerStatus,
    emergency: FleetPartnerStatus,
  ): Promise<DispatchAllocationResult> {
    const startTime = Date.now();

    // Check if primary partner is viable
    const isPrimaryHealthy =
      primary.isOnline &&
      primary.avgApiLatencyMs <= 2500 &&
      primary.acceptanceRatePercent >= 70;

    if (isPrimaryHealthy) {
      return {
        orderId,
        assignedPartnerId: primary.partnerId,
        assignedPartnerName: primary.partnerName,
        trackingId: `TRK_${primary.partnerId.toUpperCase()}_${orderId}`,
        failoverTriggered: false,
        decisionLatencyMs: Date.now() - startTime + 42,
        costSurplusInr: 0,
        reason: `Primary partner ${primary.partnerName} operating normally (Latency: ${primary.avgApiLatencyMs}ms, Acceptance: ${primary.acceptanceRatePercent}%).`,
      };
    }

    // Check if secondary partner is viable
    const isSecondaryHealthy =
      secondary.isOnline &&
      secondary.avgApiLatencyMs <= 2500 &&
      secondary.acceptanceRatePercent >= 70;

    if (isSecondaryHealthy) {
      const surplus = Math.max(
        0,
        secondary.costPerDeliveryInr - primary.costPerDeliveryInr,
      );
      return {
        orderId,
        assignedPartnerId: secondary.partnerId,
        assignedPartnerName: secondary.partnerName,
        trackingId: `TRK_FAILOVER_${secondary.partnerId.toUpperCase()}_${orderId}`,
        failoverTriggered: true,
        decisionLatencyMs: Date.now() - startTime + 142,
        costSurplusInr: surplus,
        reason: `CIRCUIT BREAKER OPEN: Primary partner ${primary.partnerName} unhealthy (Online=${primary.isOnline}, Latency=${primary.avgApiLatencyMs}ms, Acceptance=${primary.acceptanceRatePercent}%). Rerouted to secondary partner ${secondary.partnerName} (+₹${surplus} surplus logged).`,
      };
    }

    // Fallback to internal O2O emergency fleet
    const emergencySurplus = Math.max(
      0,
      emergency.costPerDeliveryInr - primary.costPerDeliveryInr,
    );
    return {
      orderId,
      assignedPartnerId: emergency.partnerId,
      assignedPartnerName: emergency.partnerName,
      trackingId: `TRK_EMERGENCY_O2O_${orderId}`,
      failoverTriggered: true,
      decisionLatencyMs: Date.now() - startTime + 185,
      costSurplusInr: emergencySurplus,
      reason: `ALL 3PL FLEETS EXHAUSTED/UNHEALTHY: Routed order ${orderId} to dedicated In-House Emergency O2O Fleet (+₹${emergencySurplus} surplus).`,
    };
  }

  /**
   * Simulation 2: Evaluates sliding-window acceptance rates and trips circuit breakers during weather spikes.
   */
  public evaluateAcceptanceRateDrop(
    partnerId: string,
    totalAssigned: number,
    acceptedCount: number,
    thresholdPercent: number = 70,
  ): {
    isTripped: boolean;
    currentAcceptanceRate: number;
    mitigationAction: string;
  } {
    if (totalAssigned === 0) {
      return {
        isTripped: false,
        currentAcceptanceRate: 100,
        mitigationAction: 'No traffic recorded.',
      };
    }

    const rate = (acceptedCount / totalAssigned) * 100;
    const isTripped = rate < thresholdPercent;

    if (isTripped) {
      return {
        isTripped: true,
        currentAcceptanceRate: Number(rate.toFixed(1)),
        mitigationAction: `🚨 FLEET HEALTH INTERLOCK: Partner ${partnerId} acceptance dropped to ${rate.toFixed(1)}% (<${thresholdPercent}% threshold). Circuit breaker TRIPPED. Shifted 40% volume to backup fleet & activated +₹25 surge incentive.`,
      };
    }

    return {
      isTripped: false,
      currentAcceptanceRate: Number(rate.toFixed(1)),
      mitigationAction: `🟢 Partner ${partnerId} acceptance healthy at ${rate.toFixed(1)}%.`,
    };
  }

  /**
   * Simulation 3: Detects stale GPS/ETA tracking feeds (>180s) and initiates customer reassurance protocols.
   */
  public detectStaleEtaFeed(
    orderId: string,
    lastGpsTimestampSec: number,
    currentTimestampSec: number,
  ): {
    isStale: boolean;
    staleDurationSec: number;
    riderPingSent: boolean;
    customerMessage: string;
  } {
    const staleDurationSec = currentTimestampSec - lastGpsTimestampSec;
    const isStale = staleDurationSec > 180;

    if (isStale) {
      return {
        isStale: true,
        staleDurationSec,
        riderPingSent: true,
        customerMessage: `📍 Your Tanmatra delivery partner is in your immediate vicinity/basement parking and GPS signal has paused for ${staleDurationSec}s. Automated status check initiated with rider. Delivery remains scheduled within your clinical window.`,
      };
    }

    return {
      isStale: false,
      staleDurationSec,
      riderPingSent: false,
      customerMessage: `🟢 Live GPS tracking active (Last ping ${staleDurationSec}s ago).`,
    };
  }

  /**
   * Computes marginal economic tradeoff between paying secondary fleet surcharges vs losing clinical subscription LTV.
   */
  public computeCostVsReliabilityTradeoff(
    primaryCostInr: number,
    backupCostInr: number,
    customerLtvInr: number,
    churnProbabilityOnFailure: number,
  ): {
    surplusCostInr: number;
    expectedFailureCostInr: number;
    netEconomicValuePreservedInr: number;
    shouldPaySurplus: boolean;
    decisionJustification: string;
  } {
    const surplusCostInr = Math.max(0, backupCostInr - primaryCostInr);
    const expectedFailureCostInr = customerLtvInr * churnProbabilityOnFailure;
    const netEconomicValuePreservedInr =
      expectedFailureCostInr - surplusCostInr;
    const shouldPaySurplus = netEconomicValuePreservedInr > 0;

    return {
      surplusCostInr,
      expectedFailureCostInr,
      netEconomicValuePreservedInr,
      shouldPaySurplus,
      decisionJustification: shouldPaySurplus
        ? `POSITIVE ROI (+₹${netEconomicValuePreservedInr.toFixed(0)} preserved): Paying ₹${surplusCostInr} backup fleet surcharge prevents expected ₹${expectedFailureCostInr.toFixed(0)} clinical churn loss.`
        : `NEGATIVE ROI: Backup surcharge exceeds expected failure cost.`,
    };
  }
}
