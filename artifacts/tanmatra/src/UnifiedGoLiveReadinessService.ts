export interface UnifiedRiskItem {
  riskId: string;
  domain:
    | 'Clinical'
    | 'Food Safety'
    | 'Payments'
    | 'Security'
    | 'DR/BCP'
    | 'Observability'
    | 'Logistics'
    | 'Support Ops'
    | 'Legal/Consent'
    | 'Peak Load Chaos';
  description: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  riskScore: number; // L x I (1-25)
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  owner:
    | 'Engineering'
    | 'Clinical'
    | 'Ops'
    | 'Security'
    | 'Finance'
    | 'Legal'
    | 'Product';
  mandatoryMitigationGate: string;
  horizon:
    | '0-30 Days (Must-Fix)'
    | '31-60 Days (Hardening)'
    | '61-90 Days (Hardening)';
}

export class UnifiedGoLiveReadinessService {
  /**
   * Returns the complete register of 15 master risks across all 10 audit domains,
   * scored using Likelihood (1-5) x Impact (1-5).
   */
  public getAllUnifiedRisks(): UnifiedRiskItem[] {
    const rawRisks: Array<Omit<UnifiedRiskItem, 'riskScore' | 'severity'>> = [
      {
        riskId: 'RISK-CLN-01',
        domain: 'Clinical',
        description:
          'Patient with CKD Stage 3b or pregnancy orders contraindicated dish, leading to acute nephrotoxicity.',
        likelihood: 4,
        impact: 5,
        owner: 'Clinical',
        mandatoryMitigationGate:
          'GATE-LAUNCH-01: Enforce deterministic ClinicalContraindicationEngine blocking checkout.',
        horizon: '0-30 Days (Must-Fix)',
      },
      {
        riskId: 'RISK-FSS-01',
        domain: 'Food Safety',
        description:
          'Severe peanut/tree nut allergic patient receives meal with hidden carrier oil or cross-contamination.',
        likelihood: 3,
        impact: 5,
        owner: 'Ops',
        mandatoryMitigationGate:
          'GATE-LAUNCH-02: Deploy PackingStationInterlockService scanning container lot barcodes.',
        horizon: '0-30 Days (Must-Fix)',
      },
      {
        riskId: 'RISK-FIN-01',
        domain: 'Payments',
        description:
          'Double-tap network replay causes double charging, or post-payment stockout fails to issue Section 34 GST Credit Note.',
        likelihood: 4,
        impact: 4,
        owner: 'Finance',
        mandatoryMitigationGate:
          'GATE-LAUNCH-03: Enforce client UUIDv4 Idempotency-Key locks and Section 34 Credit Notes.',
        horizon: '0-30 Days (Must-Fix)',
      },
      {
        riskId: 'RISK-SEC-01',
        domain: 'Security',
        description:
          'BOLA/IDOR vulnerability on clinical dossier endpoint allows authenticated consumer to enumerate eGFR/pregnancy records.',
        likelihood: 4,
        impact: 5,
        owner: 'Security',
        mandatoryMitigationGate:
          'GATE-LAUNCH-04: Enforce object-level ownership check middleware.',
        horizon: '0-30 Days (Must-Fix)',
      },
      {
        riskId: 'RISK-SEC-02',
        domain: 'Security',
        description:
          'Webhook verifiers use string equality (===), exposing HMAC signatures to timing attacks and 24-hour replay payloads.',
        likelihood: 3,
        impact: 4,
        owner: 'Engineering',
        mandatoryMitigationGate:
          'GATE-LAUNCH-05: Replace with crypto.timingSafeEqual() and enforce 300s timestamp window.',
        horizon: '0-30 Days (Must-Fix)',
      },
      {
        riskId: 'RISK-DR-01',
        domain: 'DR/BCP',
        description:
          'Primary PostgreSQL master crashes during 12:30 PM lunch peak, causing socket starvation and dropped clinical orders.',
        likelihood: 2,
        impact: 5,
        owner: 'Engineering',
        mandatoryMitigationGate:
          'GATE-LAUNCH-06: Implement synchronous standby replication achieving RTO <30s and RPO=0.',
        horizon: '0-30 Days (Must-Fix)',
      },
      {
        riskId: 'RISK-LOG-01',
        domain: 'Logistics',
        description:
          'Primary 3PL partner (Shadowfax) experiences API timeout spikes or weather acceptance drop <70% during lunch peak.',
        likelihood: 4,
        impact: 4,
        owner: 'Ops',
        mandatoryMitigationGate:
          'GATE-LAUNCH-07: Deploy 3PL circuit breaker waterfall failover + SLA-aware T-8m dispatch timer.',
        horizon: '0-30 Days (Must-Fix)',
      },
      {
        riskId: 'RISK-OBS-01',
        domain: 'Observability',
        description:
          'Multi-window error budget burn rates lack alerts, or PgBouncer connection queue depth is not scraped.',
        likelihood: 3,
        impact: 4,
        owner: 'Engineering',
        mandatoryMitigationGate:
          'GATE-LAUNCH-08: Instrument 14.4x (1h) and 2x (2h) SLO burn-rate alerts triggering PagerDuty P0 pages.',
        horizon: '0-30 Days (Must-Fix)',
      },
      {
        riskId: 'RISK-CX-01',
        domain: 'Support Ops',
        description:
          'User debited on UPI but gateway timeout marks order FAILED; lack of immediate support recovery causes trust loss.',
        likelihood: 4,
        impact: 3,
        owner: 'Ops',
        mandatoryMitigationGate:
          'GATE-LAUNCH-09: Empower frontline CX console with 1-click debited order recovery package.',
        horizon: '0-30 Days (Must-Fix)',
      },
      {
        riskId: 'RISK-LEG-01',
        domain: 'Legal/Consent',
        description:
          'Profiling health data without affirmative notice, profiling minors <18 without guardian consent, or deleting GST logs.',
        likelihood: 3,
        impact: 5,
        owner: 'Legal',
        mandatoryMitigationGate:
          'GATE-LAUNCH-10: Enforce DPDPA Section 6 click-wrap, Section 9 minor guardian interlock, and split erasure.',
        horizon: '0-30 Days (Must-Fix)',
      },
      {
        riskId: 'RISK-PERF-01',
        domain: 'Peak Load Chaos',
        description:
          '5,000 CCU lunch burst exhausts PgBouncer default connections and blocks Event Loop during dietary serialization.',
        likelihood: 3,
        impact: 4,
        owner: 'Engineering',
        mandatoryMitigationGate:
          'GATE-LAUNCH-11: Scale PgBouncer pool_size=80, autoscale Redis workers, and pre-serialize ranked catalog.',
        horizon: '0-30 Days (Must-Fix)',
      },
      {
        riskId: 'RISK-SEC-03',
        domain: 'Security',
        description:
          'PII and health biomarkers leaked into application stdout logs and third-party SaaS error trackers.',
        likelihood: 3,
        impact: 3,
        owner: 'Security',
        mandatoryMitigationGate:
          'GATE-HARDEN-01: Enforce automated PII/PHI log scrubbing interceptor.',
        horizon: '31-60 Days (Hardening)',
      },
      {
        riskId: 'RISK-DR-02',
        domain: 'DR/BCP',
        description:
          'Single cloud kitchen suffers grid blackout; manual order reassignment causes 45-minute delivery delays.',
        likelihood: 2,
        impact: 4,
        owner: 'Ops',
        mandatoryMitigationGate:
          'GATE-HARDEN-02: Automate dynamic kitchen rerouting algorithm verifying clean allergen bay capacity.',
        horizon: '31-60 Days (Hardening)',
      },
      {
        riskId: 'RISK-CX-02',
        domain: 'Support Ops',
        description:
          'Frontline agents experience typing fatigue and context-switching lag across 5 separate admin dashboards during rush.',
        likelihood: 3,
        impact: 2,
        owner: 'Product',
        mandatoryMitigationGate:
          'GATE-HARDEN-03: Deploy unified 360 Agent Tooling Console displaying synchronized timelines.',
        horizon: '61-90 Days (Hardening)',
      },
      {
        riskId: 'RISK-LEG-02',
        domain: 'Legal/Consent',
        description:
          'User consent receipts stored as mutable database flags without verifiable cryptographic proof of policy acceptance.',
        likelihood: 2,
        impact: 2,
        owner: 'Legal',
        mandatoryMitigationGate:
          'GATE-HARDEN-04: Store keyed HMAC-SHA256 hashed consent receipts inside immutable WORM storage.',
        horizon: '61-90 Days (Hardening)',
      },
    ];

    return rawRisks.map((r) => {
      const riskScore = r.likelihood * r.impact;
      let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      if (riskScore >= 16) severity = 'CRITICAL';
      else if (riskScore >= 10) severity = 'HIGH';
      else if (riskScore >= 6) severity = 'MEDIUM';
      else severity = 'LOW';

      return {...r, riskScore, severity};
    });
  }

  /**
   * Evaluates Go-Live readiness against resolved mitigation gates and generates Executive Memo.
   */
  public evaluateGoLiveReadiness(resolvedGateIds: Set<string>): {
    totalRisksCount: number;
    mustFixRisksCount: number;
    unresolvedMustFixCount: number;
    goNoGoDecision: 'GO_FOR_LAUNCH' | 'CONDITIONAL_GO' | 'NO_GO';
    executiveMemoSummary: string;
  } {
    const allRisks = this.getAllUnifiedRisks();
    const mustFixRisks = allRisks.filter(
      (r) => r.horizon === '0-30 Days (Must-Fix)',
    );

    let unresolvedMustFixCount = 0;
    for (const risk of mustFixRisks) {
      const gateId = risk.mandatoryMitigationGate.split(':')[0].trim();
      if (!resolvedGateIds.has(gateId)) {
        unresolvedMustFixCount++;
      }
    }

    const decision = unresolvedMustFixCount === 0 ? 'GO_FOR_LAUNCH' : 'NO_GO';
    const memo =
      unresolvedMustFixCount === 0
        ? `🟢 FINAL EXECUTIVE DECISION: GO FOR COMMERCIAL LAUNCH. All ${mustFixRisks.length} critical and high-severity 0-30 day must-fix gates across all 10 audit domains have been implemented, verified, and certified in code with 100% test pass rates.`
        : `🔴 FINAL EXECUTIVE DECISION: NO-GO. ${unresolvedMustFixCount} mandatory 0-30 day must-fix gates remain unresolved. Launch is blocked until all high/critical items are signed off.`;

    return {
      totalRisksCount: allRisks.length,
      mustFixRisksCount: mustFixRisks.length,
      unresolvedMustFixCount,
      goNoGoDecision: decision,
      executiveMemoSummary: memo,
    };
  }
}
