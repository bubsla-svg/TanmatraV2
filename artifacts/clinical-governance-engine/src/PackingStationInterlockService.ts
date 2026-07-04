import {
  ClinicalContraindicationEngine,
  DishSpecification,
  PatientProfile,
} from './ContraindicationEngine';

export type PackingSessionStatus =
  | 'IDLE'
  | 'IN_PROGRESS'
  | 'LOCKED_SAFETY_VIOLATION'
  | 'COMPLETED_READY_TO_SEAL';

export interface PackingSession {
  session_id: string;
  packing_bay_id: string;
  operator_id: string;
  order_id: string;
  patient: PatientProfile;
  status: PackingSessionStatus;
  expected_dishes: Map<
    string,
    {dish: DishSpecification; required: number; scanned: number}
  >;
  scanned_lot_numbers: string[];
  safety_violation?: {
    scanned_dish_name: string;
    batch_lot_number: string;
    rule_id: string;
    reason: string;
    timestamp_utc: string;
  };
  started_at_utc: string;
}

export interface PrinterGateway {
  setLockState(bayId: string, isLocked: boolean): Promise<void>;
  printSealLabel(bayId: string, orderId: string): Promise<string>;
}

export interface AlarmGateway {
  triggerAlarm(bayId: string, durationMs: number): Promise<void>;
  silenceAlarm(bayId: string): Promise<void>;
}

export interface AuditLoggerGateway {
  logEvent(event: any): Promise<void>;
}

export class PackingStationInterlockService {
  private readonly sessions = new Map<string, PackingSession>();
  private readonly contraindicationEngine =
    new ClinicalContraindicationEngine();

  constructor(
    private readonly printerGateway: PrinterGateway,
    private readonly alarmGateway: AlarmGateway,
    private readonly auditLogger: AuditLoggerGateway,
  ) {}

  public async startSession(
    sessionId: string,
    packingBayId: string,
    operatorId: string,
    orderId: string,
    patient: PatientProfile,
    expectedDishes: DishSpecification[],
  ): Promise<PackingSession> {
    const expectedMap = new Map<
      string,
      {dish: DishSpecification; required: number; scanned: number}
    >();
    for (const dish of expectedDishes) {
      const existing = expectedMap.get(dish.dish_id);
      if (existing) {
        existing.required += 1;
      } else {
        expectedMap.set(dish.dish_id, {dish, required: 1, scanned: 0});
      }
    }

    const session: PackingSession = {
      session_id: sessionId,
      packing_bay_id: packingBayId,
      operator_id: operatorId,
      order_id: orderId,
      patient,
      status: 'IN_PROGRESS',
      expected_dishes: expectedMap,
      scanned_lot_numbers: [],
      started_at_utc: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);
    await this.printerGateway.setLockState(packingBayId, true); // Enforce printer lock until 100% safe
    return session;
  }

  public async scanDishContainer(
    sessionId: string,
    scannedDishSpec: DishSpecification,
    batchLotNumber: string,
    preppedAtTimestampUtc: string,
  ): Promise<{
    session: PackingSession;
    action: 'ACCEPTED' | 'COMPLETED' | 'SAFETY_VIOLATION';
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Packing session ${sessionId} not found.`);
    }

    if (session.status === 'LOCKED_SAFETY_VIOLATION') {
      throw new Error(
        `Terminal locked due to active safety breach. Supervisor override required.`,
      );
    }

    // Check 1: Holding Freshness (< 24h holding at 2°C-4°C)
    const holdTimeHours =
      (Date.now() - new Date(preppedAtTimestampUtc).getTime()) /
      (1000 * 60 * 60);
    if (holdTimeHours > 24.0) {
      return this.triggerViolation(
        session,
        scannedDishSpec,
        batchLotNumber,
        'RULE_FRESHNESS_EXPIRED',
        `Lot ${batchLotNumber} held in chiller for ${holdTimeHours.toFixed(1)}h exceeding 24h limit.`,
      );
    }

    // Check 2: Order Matching Interlock
    const expectedEntry = session.expected_dishes.get(scannedDishSpec.dish_id);
    if (!expectedEntry || expectedEntry.scanned >= expectedEntry.required) {
      return this.triggerViolation(
        session,
        scannedDishSpec,
        batchLotNumber,
        'RULE_ORDER_MISMATCH',
        `Dish '${scannedDishSpec.dish_name}' is not in Order #${session.order_id} or quota already fulfilled.`,
      );
    }

    // Check 3: Biochemical Contraindication Verification
    const evalResult = this.contraindicationEngine.evaluateDish(
      session.patient,
      scannedDishSpec,
    );
    if (evalResult.status === 'HARD_STOP') {
      const firstStop = evalResult.hard_stops[0];
      return this.triggerViolation(
        session,
        scannedDishSpec,
        batchLotNumber,
        firstStop.rule_id,
        firstStop.reason,
      );
    }

    // Safe scan accepted
    expectedEntry.scanned += 1;
    session.scanned_lot_numbers.push(batchLotNumber);

    // Verify completion
    let isAllDone = true;
    for (const [, val] of session.expected_dishes) {
      if (val.scanned < val.required) {
        isAllDone = false;
        break;
      }
    }

    if (isAllDone) {
      session.status = 'COMPLETED_READY_TO_SEAL';
      await this.printerGateway.setLockState(session.packing_bay_id, false);
      await this.printerGateway.printSealLabel(
        session.packing_bay_id,
        session.order_id,
      );
      await this.auditLogger.logEvent({
        event_type: 'PACKING_INTERLOCK_SUCCESS',
        session_id: session.session_id,
        order_id: session.order_id,
        verified_lots: session.scanned_lot_numbers,
        timestamp_utc: new Date().toISOString(),
      });
      return {session, action: 'COMPLETED'};
    }

    return {session, action: 'ACCEPTED'};
  }

  private async triggerViolation(
    session: PackingSession,
    dish: DishSpecification,
    lotNumber: string,
    ruleId: string,
    reason: string,
  ): Promise<{session: PackingSession; action: 'SAFETY_VIOLATION'}> {
    session.status = 'LOCKED_SAFETY_VIOLATION';
    session.safety_violation = {
      scanned_dish_name: dish.dish_name,
      batch_lot_number: lotNumber,
      rule_id: ruleId,
      reason,
      timestamp_utc: new Date().toISOString(),
    };

    await this.printerGateway.setLockState(session.packing_bay_id, true);
    await this.alarmGateway.triggerAlarm(session.packing_bay_id, 30000);
    await this.auditLogger.logEvent({
      event_type: 'CLINICAL_SAFETY_INTERLOCK_BREACH',
      session_id: session.session_id,
      packing_bay_id: session.packing_bay_id,
      operator_id: session.operator_id,
      patient_id: session.patient.patient_id,
      violation: session.safety_violation,
    });

    return {session, action: 'SAFETY_VIOLATION'};
  }

  public async supervisorOverrideReset(
    sessionId: string,
    supervisorEmpId: string,
    supervisorPin: string,
    actionTaken: 'CONTAINER_DISCARDED_AND_REPLACED',
  ): Promise<PackingSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'LOCKED_SAFETY_VIOLATION') {
      throw new Error('Invalid override state.');
    }

    if (supervisorPin !== '998102') {
      throw new Error('Unauthorized supervisor credentials.');
    }

    await this.alarmGateway.silenceAlarm(session.packing_bay_id);
    await this.auditLogger.logEvent({
      event_type: 'QA_SUPERVISOR_INTERLOCK_RESET',
      session_id: sessionId,
      supervisor_id: supervisorEmpId,
      cleared_violation: session.safety_violation,
      action_taken: actionTaken,
      timestamp_utc: new Date().toISOString(),
    });

    session.status = 'IN_PROGRESS';
    session.safety_violation = undefined;
    return session;
  }
}
