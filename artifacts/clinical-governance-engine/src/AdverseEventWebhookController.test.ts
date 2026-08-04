/**
 * Pins the OA-DEEP-1.1 hardening (TODO_optimization-auditor.md): the
 * Grade-3 AE path used to run PagerDuty -> kitchen batch lock -> patient
 * reply strictly sequentially with no timeout/retry/catch, and persisted
 * the dossier LAST — so a slow or down PagerDuty blocked the two most
 * safety-critical actions, and any thrown error meant the incident left no
 * audit trail at all. This test proves, against real timing and real
 * failure injection (not just reading the diff), that:
 *
 *   1. The dossier is persisted BEFORE any notification gateway is called.
 *   2. The three Grade-3 actions run CONCURRENTLY, not sequentially.
 *   3. A permanently-failing PagerDuty does not throw, does not block the
 *      kitchen batch lock or the patient reply, and is recorded as failed
 *      (both in the return value and in the re-persisted dossier).
 *   4. A gateway that fails twice then succeeds is retried and ultimately
 *      recorded as successful.
 *   5. A gateway that never resolves is bounded by withTimeout rather than
 *      hanging the caller forever.
 *
 * No test framework in this package (see AllergenTraceabilityService.test.ts) —
 * node:assert, zero-dependency.
 *
 * Run:
 *   npx ts-node src/AdverseEventWebhookController.test.ts
 */
import assert from 'node:assert/strict';
import {
  AdverseEventWebhookController,
  withRetry,
  withTimeout,
  type DBGateway,
  type KitchenErpGateway,
  type MedicoLegalAEDossier,
  type PagerDutyGateway,
  type WhatsAppGateway,
  type WhatsAppWebhookPayload,
} from './AdverseEventWebhookController';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function grade3Payload(text: string): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry_1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {display_phone_number: '919289213115', phone_number_id: 'pid_1'},
              messages: [
                {from: '919811122233', id: 'msg_1', timestamp: '1720069000', type: 'text', text: {body: text}},
              ],
            },
          },
        ],
      },
    ],
  };
}

async function run(): Promise<void> {
  // --- 1 & 2: persist-first ordering + true concurrency -------------------
  {
    const callLog: string[] = [];
    const timings: Record<string, number> = {};
    const start = Date.now();

    const dbGateway: DBGateway = {
      saveDossier: async () => {
        callLog.push('save');
      },
      findActiveOrderByPhone: async () => ({
        order_id: 'ORD_1',
        patient_id: 'pat_1',
        lot_number: 'LOT_1',
      }),
    };
    const pagerDutyGateway: PagerDutyGateway = {
      triggerIncident: async () => {
        callLog.push('pagerduty:start');
        await sleep(150); // deliberately the slowest of the three
        callLog.push('pagerduty:end');
        timings.pagerduty = Date.now() - start;
        return 'inc_1';
      },
    };
    const whatsAppGateway: WhatsAppGateway = {
      sendTextMessage: async () => {
        callLog.push('whatsapp');
        timings.whatsapp = Date.now() - start;
      },
    };
    const kitchenErpGateway: KitchenErpGateway = {
      lockBatchLot: async () => {
        callLog.push('kitchen');
        timings.kitchen = Date.now() - start;
      },
    };

    const controller = new AdverseEventWebhookController(
      dbGateway,
      pagerDutyGateway,
      whatsAppGateway,
      kitchenErpGateway,
    );
    const result = await controller.processInboundWebhook(
      grade3Payload('severe allergic reaction, throat swelling, cannot breathe'),
    );

    assert.equal(result.processed, true);
    assert.equal(result.severity, 'GRADE_3_CRITICAL');
    assert.equal(result.actions_failed, undefined);

    // The FIRST call of any kind must be the dossier save — persisted
    // before any gateway is even attempted.
    assert.equal(callLog[0], 'save', `expected dossier save first, got: ${callLog.join(',')}`);
    // pagerduty:start must precede whatsapp/kitchen completing (proves they
    // were launched together, not after pagerduty resolved).
    const pagerStartIdx = callLog.indexOf('pagerduty:start');
    const whatsappIdx = callLog.indexOf('whatsapp');
    const kitchenIdx = callLog.indexOf('kitchen');
    assert.ok(pagerStartIdx < whatsappIdx, 'whatsapp should start before pagerduty finishes');
    assert.ok(pagerStartIdx < kitchenIdx, 'kitchen lock should start before pagerduty finishes');
    // Concretely: whatsapp/kitchen (near-instant mocks) must complete WELL
    // before pagerduty's artificial 150ms delay resolves. A sequential
    // implementation would force them to wait until AFTER pagerduty.
    assert.ok(
      timings.whatsapp! < 100,
      `whatsapp should finish in well under pagerduty's 150ms delay, took ${timings.whatsapp}ms`,
    );
    assert.ok(
      timings.kitchen! < 100,
      `kitchen lock should finish in well under pagerduty's 150ms delay, took ${timings.kitchen}ms`,
    );
    console.log('✅ persist-first + concurrent Grade-3 actions verified');
  }

  // --- 3: a permanently-failing PagerDuty does not throw and does not ----
  //        block the batch lock or the patient reply -----------------------
  {
    let saveCalls = 0;
    let lastSaved: MedicoLegalAEDossier | undefined;
    let kitchenLocked = false;
    let patientReplied = false;

    const dbGateway: DBGateway = {
      saveDossier: async (d) => {
        saveCalls++;
        lastSaved = d;
      },
      findActiveOrderByPhone: async () => ({
        order_id: 'ORD_2',
        patient_id: 'pat_2',
        lot_number: 'LOT_2',
      }),
    };
    const pagerDutyGateway: PagerDutyGateway = {
      triggerIncident: async () => {
        throw new Error('PagerDuty outage');
      },
    };
    const whatsAppGateway: WhatsAppGateway = {
      sendTextMessage: async () => {
        patientReplied = true;
      },
    };
    const kitchenErpGateway: KitchenErpGateway = {
      lockBatchLot: async () => {
        kitchenLocked = true;
      },
    };

    const controller = new AdverseEventWebhookController(
      dbGateway,
      pagerDutyGateway,
      whatsAppGateway,
      kitchenErpGateway,
    );

    // Must resolve, not throw or reject, despite PagerDuty always failing.
    const result = await controller.processInboundWebhook(
      grade3Payload('anaphylaxis emergency, hospital now'),
    );

    assert.equal(result.processed, true);
    assert.deepEqual(result.actions_failed, ['pagerduty']);
    assert.ok(kitchenLocked, 'kitchen batch lock must still run despite PagerDuty failing');
    assert.ok(patientReplied, 'patient emergency reply must still send despite PagerDuty failing');
    assert.ok(saveCalls >= 2, 'dossier must be saved at least twice (initial + outcome update)');
    assert.equal(lastSaved?.actions_triggered.pagerduty_paged, false);
    assert.equal(lastSaved?.actions_triggered.kitchen_batch_locked, 'LOT_2');
    assert.equal(lastSaved?.actions_triggered.patient_auto_reply_sent, true);
    assert.deepEqual(lastSaved?.actions_failed, ['pagerduty']);
    console.log('✅ PagerDuty failure isolation verified: dossier saved, siblings unaffected, no throw');
  }

  // --- 4: retry — fails twice, succeeds on the 3rd attempt ----------------
  {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error(`attempt ${attempts} failed`);
        return 'ok';
      },
      'retry-test',
      {attempts: 3, timeoutMs: 1000, baseDelayMs: 20},
    );
    assert.equal(result, 'ok');
    assert.equal(attempts, 3);
    console.log('✅ withRetry succeeds after transient failures');
  }

  // --- 4b: retry — exhausts all attempts and rethrows ----------------------
  {
    let attempts = 0;
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            attempts++;
            throw new Error('permanent failure');
          },
          'retry-exhaust-test',
          {attempts: 3, timeoutMs: 1000, baseDelayMs: 10},
        ),
      /permanent failure/,
    );
    assert.equal(attempts, 3);
    console.log('✅ withRetry exhausts attempts and rethrows the last error');
  }

  // --- 5: a hung gateway is bounded by withTimeout, not left to hang forever
  {
    const neverResolves = new Promise<string>(() => {});
    await assert.rejects(
      () => withTimeout(neverResolves, 50, 'hung-gateway-test'),
      /timed out after 50ms/,
    );
    console.log('✅ withTimeout bounds a hung call instead of waiting forever');
  }

  console.log('\n✅ AdverseEventWebhookController: all assertions passed');
}

// No process.exit in this package's minimal type shim (env.d.ts) — an
// unhandled rejection crashes ts-node with a non-zero exit code on its own
// (Node 15+ default), so rethrowing here is enough to fail the run.
run().catch((err) => {
  console.error('❌ AdverseEventWebhookController.test.ts FAILED:', err);
  throw err;
});
