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

export class AdverseEventWebhookController {
  private readonly appSecret: string;
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
  ) {
    const secret = process.env.META_APP_SECRET;
    if (!secret) {
      throw new Error('Missing META_APP_SECRET environment variable. Failing closed.');
    }
    this.appSecret = secret;
  }

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

  public async processInboundWebhook(
    payload: WhatsAppWebhookPayload,
  ): Promise<{
    processed: boolean;
    dossier_id?: string;
    severity?: AESeverityGrade;
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

    let severity: AESeverityGrade = 'GRADE_2_MODERATE'; // Default to moderate for safety
    if (matchedP0.length > 0) {
      severity = 'GRADE_3_CRITICAL';
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

    if (severity === 'GRADE_3_CRITICAL') {
      await this.pagerDutyGateway.triggerIncident(
        `🚨 [GRADE 3 AE] Medical Distress Reported: ${senderPhone}`,
        {
          dossier_id: dossierId,
          patient_id: activeOrder?.patient_id || 'UNKNOWN',
          raw_text: message.text.body,
          keywords: matchedP0,
          consumed_lot: activeOrder?.lot_number,
        },
      );
      dossier.actions_triggered.pagerduty_paged = true;

      if (activeOrder?.lot_number) {
        await this.kitchenErpGateway.lockBatchLot(
          activeOrder.lot_number,
          `AUTOMATED LOCK: Grade 3 AE reported by patient ${activeOrder.patient_id}.`,
        );
        dossier.actions_triggered.kitchen_batch_locked = activeOrder.lot_number;
      }

      const emergencyReply = `🚨 *Tanmatra Clinical Emergency Response*\n\nWe have received your priority alert regarding potential medical symptoms. Our on-duty Registered Dietitian has been paged and will call you within *15 minutes*.\n\n⚠️ *IMMEDIATE SAFETY ACTION:* If you or the patient are experiencing severe throat swelling, chest pain, difficulty breathing, or loss of consciousness, please call **112** or go to the nearest emergency room immediately. Do not consume any remaining food.`;
      await this.whatsAppGateway.sendTextMessage(senderPhone, emergencyReply);
      dossier.actions_triggered.patient_auto_reply_sent = true;
    } else {
      await this.pagerDutyGateway.triggerIncident(
        `⚠️ [GRADE 2 AE] Moderate Symptom Report: ${senderPhone}`,
        {dossier_id: dossierId},
      );
      dossier.actions_triggered.pagerduty_paged = true;

      const moderateReply = `⚠️ *Tanmatra Clinical Support*\n\nThank you for reporting this. We have paused your scheduled deliveries. A Registered Dietitian will review your profile and contact you within 2 hours (or < 15 mins for urgent distress) to assist and adjust your protocol. Please stop eating the current dish and stay hydrated.`;
      await this.whatsAppGateway.sendTextMessage(senderPhone, moderateReply);
      dossier.actions_triggered.patient_auto_reply_sent = true;
    }

    await this.dbGateway.saveDossier(dossier);
    return {processed: true, dossier_id: dossierId, severity};
  }
}
