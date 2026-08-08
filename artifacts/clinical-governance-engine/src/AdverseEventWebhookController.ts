import crypto from 'crypto';

export type AESeverityGrade =
  | 'GRADE_3_CRITICAL'
  | 'GRADE_2_MODERATE'
  | 'GRADE_1_MILD'
  | 'NON_CLINICAL_SUPPORT';

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {display_phone_number: string; phone_number_id: string};
        contacts?: Array<{profile: {name: string}; wa_id: string}>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'image' | 'audio';
          text?: {body: string};
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface MedicoLegalAEDossier {
  dossier_id: string;
  incident_timestamp_utc: string;
  patient_phone: string;
  patient_id?: string;
  raw_message_text: string;
  assigned_severity: AESeverityGrade;
  triggered_keywords: string[];
  triage_sla_deadline_utc: string;
  status:
    | 'PENDING_15MIN_TRIAGE'
    | 'IN_TRIAGE'
    | 'ESCALATED_CMO'
    | 'CLOSED_RESOLVED';
  actions_triggered: {
    pagerduty_paged: boolean;
    kitchen_batch_locked?: string;
    patient_auto_reply_sent: boolean;
  };
  /**
   * Named actions that failed even after retries (e.g. "pagerduty",
   * "kitchen_batch_lock", "patient_reply"). Present and non-empty on a
   * PERSISTED dossier means at least one automated safety action did not go
   * through — this is the audit trail a monitoring process alerts on, since
   * this package has no logger/alerting dependency of its own to inject.
   */
  actions_failed?: string[];
}

export interface DBGateway {
  saveDossier(dossier: MedicoLegalAEDossier): Promise<void>;
  findActiveOrderByPhone(
    phone: string,
  ): Promise<{order_id: string; patient_id: string; lot_number: string} | null>;
}

export interface PagerDutyGateway {
  triggerIncident(title: string, details: any): Promise<string>;
}

export interface WhatsAppGateway {
  sendTextMessage(toPhone: string, message: string): Promise<void>;
}

export interface KitchenErpGateway {
  lockBatchLot(lotNumber: string, reason: string): Promise<void>;
}

export interface RetryOptions {
  attempts: number;
  timeoutMs: number;
  baseDelayMs: number;
}

const DEFAULT_RETRY: RetryOptions = {attempts: 3, timeoutMs: 5_000, baseDelayMs: 300};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Races `promise` against a timeout. NOTE: this bounds how long the CALLER
 * waits — it does not cancel the underlying gateway call, since none of the
 * Gateway interfaces below accept an AbortSignal. Combined with retry +
 * Promise.allSettled at the call site, this still closes the actual defect
 * (one slow/hung gateway blocking every other safety action indefinitely);
 * it is not the same guarantee as a true abortable request.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Bounded retry with exponential backoff + jitter. Rethrows the last error
 * once `attempts` is exhausted — callers use Promise.allSettled so a
 * persistent failure surfaces as a rejected settlement, not a thrown
 * exception that would abort sibling actions. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  opts: RetryOptions = DEFAULT_RETRY,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await withTimeout(fn(), opts.timeoutMs, label);
    } catch (err) {
      lastErr = err;
      if (attempt < opts.attempts) {
        const backoff = opts.baseDelayMs * 2 ** (attempt - 1);
        const jitter = Math.random() * opts.baseDelayMs;
        await sleep(backoff + jitter);
      }
    }
  }
  throw lastErr;
}

export class AdverseEventWebhookController {
  /** Resolved lazily in verifyMetaSignature(). This used to fall back to a
   * hardcoded secret baked into source ('tanmatra_webhook_secret_2026') when
   * META_APP_SECRET was unset — a violation of the repo's no-hardcoded-secrets
   * rule, and worse than no check at all: signature verification against a
   * public-in-git secret is theater. Now absent config fails LOUDLY at the
   * point of use instead of silently "verifying" against a known value. */
  private get appSecret(): string {
    const secret = process.env.META_APP_SECRET;
    if (!secret) {
      throw new Error(
        'META_APP_SECRET is not configured — cannot verify webhook signatures. ' +
          'Refusing to fall back to a hardcoded secret.',
      );
    }
    return secret;
  }
  private readonly p0Keywords = [
    'reaction',
    'allergy',
    'allergic',
    'swelling',
    'throat',
    'choking',
    'breath',
    'breathing',
    'saans',
    'hospital',
    'emergency',
    'vomit',
    'vomiting',
    'ultii',
    'seizure',
    'faint',
    'fainting',
    'chakkar',
    'blood',
    'khoon',
    'potassium',
    'sugar drop',
    'hypo',
    'shock',
    'anaphylaxis',
    'poison',
  ];
  private readonly p1Keywords = [
    'diarrhea',
    'loose motion',
    'pet kharaab',
    'nausea',
    'cramps',
    'stomach pain',
    'headache',
    'bp high',
    'rash',
    'khujli',
    'hives',
    'fever',
  ];

  constructor(
    private readonly dbGateway: DBGateway,
    private readonly pagerDutyGateway: PagerDutyGateway,
    private readonly whatsAppGateway: WhatsAppGateway,
    private readonly kitchenErpGateway: KitchenErpGateway,
  ) {}

  public verifyMetaSignature(
    rawBody: string,
    signatureHeader: string,
  ): boolean {
    const expectedHash = crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex');
    const expectedSignature = `sha256=${expectedHash}`;
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSignature),
    );
  }

  /** Fires PagerDuty, the kitchen batch lock, and the patient emergency
   * reply CONCURRENTLY — none may gate the others, since a slow/down
   * PagerDuty must never delay quarantining a contaminated batch or warning
   * a patient to seek emergency care. Mutates `dossier.actions_triggered`
   * from the ACTUAL settled outcomes and returns the names of any actions
   * that failed after retries. */
  private async runGrade3Actions(
    dossier: MedicoLegalAEDossier,
    senderPhone: string,
    rawText: string,
    matchedP0: string[],
    activeOrder: {order_id: string; patient_id: string; lot_number: string} | null,
  ): Promise<string[]> {
    const emergencyReply = `🚨 *Tanmatra Clinical Emergency Response*\n\nWe have received your priority alert regarding potential medical symptoms. Our on-duty Registered Dietitian has been paged and will call you within *15 minutes*.\n\n⚠️ *IMMEDIATE SAFETY ACTION:* If you or the patient are experiencing severe throat swelling, chest pain, difficulty breathing, or loss of consciousness, please call **112** or go to the nearest emergency room immediately. Do not consume any remaining food.`;

    const [pagerDutyResult, lockResult, replyResult] = await Promise.allSettled([
      withRetry(
        () =>
          this.pagerDutyGateway.triggerIncident(
            `🚨 [GRADE 3 AE] Medical Distress Reported: ${senderPhone}`,
            {
              dossier_id: dossier.dossier_id,
              patient_id: activeOrder?.patient_id || 'UNKNOWN',
              raw_text: rawText,
              keywords: matchedP0,
              consumed_lot: activeOrder?.lot_number,
            },
          ),
        'pagerduty:grade3',
      ),
      activeOrder?.lot_number
        ? withRetry(
            () =>
              this.kitchenErpGateway.lockBatchLot(
                activeOrder.lot_number,
                `AUTOMATED LOCK: Grade 3 AE reported by patient ${activeOrder.patient_id}.`,
              ),
            'kitchen_batch_lock',
          )
        : Promise.resolve(undefined),
      withRetry(
        () => this.whatsAppGateway.sendTextMessage(senderPhone, emergencyReply),
        'patient_reply:grade3',
      ),
    ]);

    dossier.actions_triggered.pagerduty_paged = pagerDutyResult.status === 'fulfilled';
    dossier.actions_triggered.kitchen_batch_locked =
      activeOrder?.lot_number && lockResult.status === 'fulfilled'
        ? activeOrder.lot_number
        : undefined;
    dossier.actions_triggered.patient_auto_reply_sent = replyResult.status === 'fulfilled';

    const failed: string[] = [];
    if (pagerDutyResult.status === 'rejected') failed.push('pagerduty');
    if (activeOrder?.lot_number && lockResult.status === 'rejected') failed.push('kitchen_batch_lock');
    if (replyResult.status === 'rejected') failed.push('patient_reply');
    return failed;
  }

  /** Same concurrency treatment as Grade 3, scaled to a Grade 2 report:
   * PagerDuty paging and the patient reply run independently so one cannot
   * block the other. */
  private async runGrade2Actions(
    dossier: MedicoLegalAEDossier,
    senderPhone: string,
  ): Promise<string[]> {
    const moderateReply = `⚠️ *Tanmatra Clinical Support*\n\nThank you for reporting this. We have paused your scheduled deliveries. A Registered Dietitian will review your profile and contact you within 2 hours (or < 15 mins for urgent distress) to assist and adjust your protocol. Please stop eating the current dish and stay hydrated.`;

    const [pagerDutyResult, replyResult] = await Promise.allSettled([
      withRetry(
        () =>
          this.pagerDutyGateway.triggerIncident(
            `⚠️ [GRADE 2 AE] Moderate Symptom Report: ${senderPhone}`,
            {dossier_id: dossier.dossier_id},
          ),
        'pagerduty:grade2',
      ),
      withRetry(
        () => this.whatsAppGateway.sendTextMessage(senderPhone, moderateReply),
        'patient_reply:grade2',
      ),
    ]);

    dossier.actions_triggered.pagerduty_paged = pagerDutyResult.status === 'fulfilled';
    dossier.actions_triggered.patient_auto_reply_sent = replyResult.status === 'fulfilled';

    const failed: string[] = [];
    if (pagerDutyResult.status === 'rejected') failed.push('pagerduty');
    if (replyResult.status === 'rejected') failed.push('patient_reply');
    return failed;
  }

  public async processInboundWebhook(
    payload: WhatsAppWebhookPayload,
  ): Promise<{
    processed: boolean;
    dossier_id?: string;
    severity?: AESeverityGrade;
    actions_failed?: string[];
  }> {
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    if (!message || message.type !== 'text' || !message.text?.body) {
      return {processed: false};
    }

    const senderPhone = message.from;
    const textBody = message.text.body.toLowerCase();

    const matchedP0 = this.p0Keywords.filter((kw) => textBody.includes(kw));
    const matchedP1 = this.p1Keywords.filter((kw) => textBody.includes(kw));

    let severity: AESeverityGrade = 'NON_CLINICAL_SUPPORT';
    if (matchedP0.length > 0) {
      severity = 'GRADE_3_CRITICAL';
    } else if (matchedP1.length > 0) {
      severity = 'GRADE_2_MODERATE';
    }

    if (severity === 'NON_CLINICAL_SUPPORT') {
      return {processed: true, severity};
    }

    const activeOrder =
      await this.dbGateway.findActiveOrderByPhone(senderPhone);
    const dossierId = `dossier_ae_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slaDeadline = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const dossier: MedicoLegalAEDossier = {
      dossier_id: dossierId,
      incident_timestamp_utc: new Date().toISOString(),
      patient_phone: senderPhone,
      patient_id: activeOrder?.patient_id,
      raw_message_text: message.text.body,
      assigned_severity: severity,
      triggered_keywords: [...matchedP0, ...matchedP1],
      triage_sla_deadline_utc: slaDeadline,
      status: 'PENDING_15MIN_TRIAGE',
      actions_triggered: {
        pagerduty_paged: false,
        patient_auto_reply_sent: false,
      },
    };

    // Persist FIRST: the medico-legal record must exist even if every
    // downstream notification below fails outright.
    await this.dbGateway.saveDossier(dossier);

    const actionsFailed =
      severity === 'GRADE_3_CRITICAL'
        ? await this.runGrade3Actions(dossier, senderPhone, message.text.body, matchedP0, activeOrder)
        : await this.runGrade2Actions(dossier, senderPhone);
    if (actionsFailed.length > 0) dossier.actions_failed = actionsFailed;

    // Re-persist so the stored dossier reflects what ACTUALLY happened, not
    // the all-false defaults it was created with above.
    await this.dbGateway.saveDossier(dossier);

    return {
      processed: true,
      dossier_id: dossierId,
      severity,
      ...(actionsFailed.length > 0 ? {actions_failed: actionsFailed} : {}),
    };
  }
}
