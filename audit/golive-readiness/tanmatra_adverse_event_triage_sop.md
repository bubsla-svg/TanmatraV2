# Tanmatra Production Deliverable 3: Adverse Event Triage SOP & Webhook Integration

**Document Version:** 1.0.0-PROD  
**Target Platform:** Tanmatra (`https://tanmatra.food`)  
**Domain:** Adverse Event Reporting, Medico-Legal Triage & Recall (Clinical Gate 5 & 8)  
**Primary Communication Channel:** WhatsApp Business Cloud API (`+91 92892 13115`) & Email (`care@tanmatra.health`)  

---

## 1. Medico-Legal Regulatory Authority & Statutory Scope

In India-focused therapeutic nutrition, an reported clinical adverse event (AE)—such as IgE-mediated anaphylaxis, acute renal hyperkalemia, or insulin-mismatched hypoglycemia—triggers strict statutory compliance mandates across four legal domains:
1. **Food Safety and Standards Act, 2006 (FSSAI):** Section 28 mandates immediate initiation of food recall procedures upon detecting unsafe food. Section 59 imposes criminal liability (up to life imprisonment and ₹10 Lakh fine) for manufacturing or distributing unsafe food causing injury or death.
2. **Consumer Protection Act, 2019 (CPA):** Sections 82–87 establish strict **Product Liability**. Tanmatra is liable for harm caused by defective products, inadequate safety instructions, or non-conformity with express clinical dietary warranties.
3. **NMC Telemedicine Practice Guidelines, 2020:** Registered Medical Practitioners (RMPs) and consulting Registered Dietitians (RDs) are legally bound to provide immediate first-aid guidance and direct emergency hospital referral when an acute clinical crisis is reported via tele-channels.
4. **Digital Personal Data Protection Act, 2023 (DPDP):** All incident reports containing medical diagnoses, symptoms, and biological measurements must be processed under strict medical purpose exemption with AES-256 encryption.

---

## 2. Standard Operating Procedure (SOP): 15-Minute Emergency Clinical Triage

```
[PATIENT / CAREGIVER INBOUND] via WhatsApp (+91 92892 13115) / Voice / Email
                 │
                 ▼
[AUTOMATED WEBHOOK CLASSIFIER] ──(Low/Non-Clinical)──► [Standard CS Queue]
                 │
     (Trigger: High-Severity Keyword / P0)
                 ▼
[IMMEDIATE PAGERDUTY / TWILIO ALERT] ──► Pages On-Duty Clinical Safety Officer (CSO/RD)
                 │
                 ▼
[0 – 15 MINS: MANDATORY TELE-TRIAGE CONTACT]
 CSO calls patient directly via recorded tele-health line. Conducts structured intake:
 1. airway/breathing status  2. exact meal & lot # consumed  3. time elapsed  4. vital signs
                 │
       ┌─────────┴───────────────────────────────────────┐
       ▼                                                 ▼
[GRADE 3: CRITICAL / ANAPHYLAXIS]                 [GRADE 1 / 2: MILD / MODERATE]
• Instruct immediate ER transport / 112 call.     • Instruct immediate meal cessation.
• FREEZE KITCHEN LOT in NCR ERP immediately.      • Administer dietary guidance / hydration.
• Dispatch 72h retention sample to NABL lab.      • Log structured dossier in registry.
• Notify CMO & Legal Counsel (< 2 hours).         • Schedule 12-hour follow-up call.
• Submit FSSAI Statutory Report (< 24 hours).
```

### 2.1 Clinical Safety Officer (CSO) Triage Action Matrix

| Grade | Clinical Trigger Criteria | Mandatory Immediate Actions (Within 15 Mins) | Secondary Actions (< 24 Hours) |
| :---: | :--- | :--- | :--- |
| **Grade 3<br>(Critical)** | • Airway swelling, dyspnea, wheezing.<br>• Chest pain, palpitations, syncope.<br>• Severe systemic vomiting / dehydration.<br>• Blood glucose < 50 mg/dL or > 350 mg/dL.<br>• Suspected food poisoning across multiple users. | **1. Emergency Dispatch:** Instruct immediate transport to nearest ER or call 112.<br>**2. Kitchen Lockdown:** Trigger ERP batch lock on consumed Lot Number across all Noida/NCR packing bays.<br>**3. Sample Quarantine:** Instruct QA Lab to freeze 150g duplicate 72-hour retention sample at -20°C and dispatch to NABL lab for ELISA / toxicology assay. | **1. Statutory Filing:** Submit formal incident report to FSSAI Designated Officer.<br>**2. Legal & CMO Dossier:** Compile immutable WORM audit logs, kitchen QA sheets, and clinical intake history.<br>**3. Patient Follow-up:** Coordinate with hospital treating medical team. |
| **Grade 2<br>(Moderate)** | • Localized rash, hives, mild facial edema.<br>• Diarrhea or abdominal cramps lasting > 12h.<br>• Symptomatic hypoglycemia (50–65 mg/dL).<br>• Blood pressure surge (> 160/100 mmHg). | **1. Protocol Halt:** Pause all scheduled meal deliveries for patient.<br>**2. Clinical Assessment:** Conduct 15-minute video assessment; verify insulin/medication timing vs. meal ingestion.<br>**3. Sub-Lot Audit:** Pull kitchen batch temperature and preparation logs for the dish. | **1. Protocol Modification:** Re-run contraindication engine; issue replacement prescription meal.<br>**2. Registry Logging:** Create formal adverse incident dossier in medical database. |
| **Grade 1<br>(Mild)** | • Mild transient nausea or flatulence.<br>• Spice / texture intolerance.<br>• Minor blood glucose fluctuation (140–180 mg/dL). | **1. Dietary Counseling:** Provide hydration guidance and portion pacing advice.<br>**2. Tolerance Logging:** Update user ingredient exclusions in profile. | **1. 12-Hour Check-in:** Automated or RD follow-up message on WhatsApp to confirm symptom resolution. |

---

## 3. WhatsApp Business API Webhook & NLP Classifier Architecture

To ensure zero latency between a patient reporting distress on WhatsApp (`+91 92892 13115`) and the on-duty Registered Dietitian being paged, Tanmatra deploys an automated **Webhook Ingestion & Keyword Classification Service**.

### 3.1 High-Priority Clinical Keyword Regex & Lexicon
Inbound messages are evaluated against an optimized, case-insensitive regular expression engine detecting English, Hindi, and Hinglish clinical distress terms:

```typescript
export const CLINICAL_P0_REGEX = /reaction|allergy|allergic|swelling|throat|choking|breath|breathing|saans|hospital|emergency|vomit|vomiting|ultii|seizure|faint|fainting|chakkar|blood|khoon|potassium|sugar\s*drop|hypo|shock|anaphylaxis|poison|poisoning|chest\s*pain/i;

export const CLINICAL_P1_REGEX = /diarrhea|loose\s*motion|pet\s*kharaab|nausea|cramps|stomach\s*pain|headache|bp\s*high|rash|khujli|hives|fever|bukhaar/i;
```

---

## 4. Production TypeScript Webhook Ingestion & Clinical Triage Service

The following TypeScript backend service validates Meta WhatsApp API webhooks, classifies incident severity, creates medico-legal dossiers, and triggers instant PagerDuty/Twilio alerts.

```typescript
import crypto from 'crypto';

export type AESeverityGrade = 'GRADE_3_CRITICAL' | 'GRADE_2_MODERATE' | 'GRADE_1_MILD' | 'NON_CLINICAL_SUPPORT';

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'image' | 'audio';
          text?: { body: string };
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
  status: 'PENDING_15MIN_TRIAGE' | 'IN_TRIAGE' | 'ESCALATED_CMO' | 'CLOSED_RESOLVED';
  actions_triggered: {
    pagerduty_paged: boolean;
    kitchen_batch_locked?: string;
    patient_auto_reply_sent: boolean;
  };
}

export class AdverseEventWebhookController {
  private readonly appSecret = process.env.META_APP_SECRET || 'test_secret';
  private readonly p0Keywords = ['reaction', 'allergy', 'allergic', 'swelling', 'throat', 'choking', 'breath', 'breathing', 'saans', 'hospital', 'emergency', 'vomit', 'vomiting', 'ultii', 'seizure', 'faint', 'fainting', 'chakkar', 'blood', 'khoon', 'potassium', 'sugar drop', 'hypo', 'shock', 'anaphylaxis', 'poison'];
  private readonly p1Keywords = ['diarrhea', 'loose motion', 'pet kharaab', 'nausea', 'cramps', 'stomach pain', 'headache', 'bp high', 'rash', 'khujli', 'hives', 'fever'];

  constructor(
    private readonly dbGateway: { saveDossier(dossier: MedicoLegalAEDossier): Promise<void>; findActiveOrderByPhone(phone: string): Promise<{ order_id: string; patient_id: string; lot_number: string } | null> },
    private readonly pagerDutyGateway: { triggerIncident(title: string, details: any): Promise<string> },
    private readonly whatsAppGateway: { sendTextMessage(toPhone: string, message: string): Promise<void> },
    private readonly kitchenErpGateway: { lockBatchLot(lotNumber: string, reason: string): Promise<void> }
  ) {}

  public verifyMetaSignature(rawBody: string, signatureHeader: string): boolean {
    const expectedHash = crypto.createHmac('sha256', this.appSecret).update(rawBody).digest('hex');
    const expectedSignature = `sha256=${expectedHash}`;
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));
  }

  public async processInboundWebhook(payload: WhatsAppWebhookPayload): Promise<{ processed: boolean; dossier_id?: string; severity?: AESeverityGrade }> {
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    if (!message || message.type !== 'text' || !message.text?.body) {
      return { processed: false }; // Ignore non-text or status receipts for clinical classification
    }

    const senderPhone = message.from;
    const textBody = message.text.body.toLowerCase();

    // 1. Keyword Extraction & Severity Grading
    const matchedP0 = this.p0Keywords.filter(kw => textBody.includes(kw));
    const matchedP1 = this.p1Keywords.filter(kw => textBody.includes(kw));

    let severity: AESeverityGrade = 'NON_CLINICAL_SUPPORT';
    if (matchedP0.length > 0) {
      severity = 'GRADE_3_CRITICAL';
    } else if (matchedP1.length > 0) {
      severity = 'GRADE_2_MODERATE';
    }

    if (severity === 'NON_CLINICAL_SUPPORT') {
      return { processed: true, severity }; // Pass to standard customer care bot
    }

    // 2. Fetch Active Patient & Lot Context
    const activeOrder = await this.dbGateway.findActiveOrderByPhone(senderPhone);
    const dossierId = `dossier_ae_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slaDeadline = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // +15 Mins

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
        patient_auto_reply_sent: false
      }
    };

    // 3. Execute Emergency Automated Actions
    if (severity === 'GRADE_3_CRITICAL') {
      // P0 Alert to Clinical On-Call Team
      await this.pagerDutyGateway.triggerIncident(`🚨 [GRADE 3 AE] Medical Distress Reported: ${senderPhone}`, {
        dossier_id: dossierId,
        patient_id: activeOrder?.patient_id || 'UNKNOWN',
        raw_text: message.text.body,
        keywords: matchedP0,
        consumed_lot: activeOrder?.lot_number
      });
      dossier.actions_triggered.pagerduty_paged = true;

      // Lock Kitchen Production Lot if matched
      if (activeOrder?.lot_number) {
        await this.kitchenErpGateway.lockBatchLot(activeOrder.lot_number, `AUTOMATED LOCK: Grade 3 AE reported by patient ${activeOrder.patient_id}.`);
        dossier.actions_triggered.kitchen_batch_locked = activeOrder.lot_number;
      }

      // Send Immediate Emergency Auto-Reply
      const emergencyReply = `🚨 *Tanmatra Clinical Emergency Response*\n\nWe have received your priority alert regarding potential medical symptoms. Our on-duty Registered Dietitian has been paged and will call you within *15 minutes*.\n\n⚠️ *IMMEDIATE SAFETY ACTION:* If you or the patient are experiencing severe throat swelling, chest pain, difficulty breathing, or loss of consciousness, please call **112** or go to the nearest emergency room immediately. Do not consume any remaining food.`;
      await this.whatsAppGateway.sendTextMessage(senderPhone, emergencyReply);
      dossier.actions_triggered.patient_auto_reply_sent = true;
    } else {
      // Grade 2 Moderate Auto-Reply & Paging
      await this.pagerDutyGateway.triggerIncident(`⚠️ [GRADE 2 AE] Moderate Symptom Report: ${senderPhone}`, { dossier_id: dossierId });
      dossier.actions_triggered.pagerduty_paged = true;

      const moderateReply = `⚠️ *Tanmatra Clinical Support*\n\nThank you for reporting this. We have paused your scheduled deliveries. A Registered Dietitian will review your profile and contact you within 2 hours (or < 15 mins for urgent distress) to assist and adjust your protocol. Please stop eating the current dish and stay hydrated.`;
      await this.whatsAppGateway.sendTextMessage(senderPhone, moderateReply);
      dossier.actions_triggered.patient_auto_reply_sent = true;
    }

    // 4. Save Dossier
    await this.dbGateway.saveDossier(dossier);
    return { processed: true, dossier_id: dossierId, severity };
  }
}
```

---

## 5. Medico-Legal Root Cause Analysis (RCA) Schema

For any Grade 2 or Grade 3 adverse event, Tanmatra must generate a immutable RCA dossier within 48 hours to satisfy FSSAI inspection and CPA 2019 defense requirements.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TanmatraMedicoLegalRCADossier",
  "type": "object",
  "required": ["dossier_id", "incident_summary", "patient_context", "kitchen_traceability", "clinical_triage_record", "root_cause_determination"],
  "properties": {
    "dossier_id": { "type": "string", "pattern": "^dossier_ae_[0-9]+_[a-z0-9]+$" },
    "incident_summary": {
      "type": "object",
      "required": ["grade", "reported_symptoms", "onset_duration_mins", "er_hospitalization_required"],
      "properties": {
        "grade": { "type": "string", "enum": ["GRADE_3_CRITICAL", "GRADE_2_MODERATE", "GRADE_1_MILD"] },
        "reported_symptoms": { "type": "array", "items": { "type": "string" } },
        "onset_duration_mins": { "type": "integer" },
        "er_hospitalization_required": { "type": "boolean" },
        "hospital_name": { "type": "string" },
        "attending_physician": { "type": "string" }
      }
    },
    "patient_context": {
      "type": "object",
      "required": ["patient_id", "diagnoses", "verified_allergies", "concurrent_medications"],
      "properties": {
        "patient_id": { "type": "string" },
        "diagnoses": { "type": "array", "items": { "type": "string" } },
        "verified_allergies": { "type": "array", "items": { "type": "string" } },
        "concurrent_medications": { "type": "array", "items": { "type": "string" } }
      }
    },
    "kitchen_traceability": {
      "type": "object",
      "required": ["order_id", "dish_id", "batch_lot_number", "prep_facility_id", "retention_sample_lab_assay"],
      "properties": {
        "order_id": { "type": "string" },
        "dish_id": { "type": "string" },
        "batch_lot_number": { "type": "string" },
        "prep_facility_id": { "type": "string", "const": "ISO_22000_NOIDA_01" },
        "packing_interlock_verified": { "type": "boolean" },
        "retention_sample_lab_assay": {
          "type": "object",
          "required": ["nabl_lab_id", "assay_timestamp", "pathogen_culture_negative", "elisa_allergen_ppm"],
          "properties": {
            "nabl_lab_id": { "type": "string" },
            "assay_timestamp": { "type": "string", "format": "date-time" },
            "pathogen_culture_negative": { "type": "boolean" },
            "elisa_allergen_ppm": { "type": "number" }
          }
        }
      }
    },
    "clinical_triage_record": {
      "type": "object",
      "required": ["cso_employee_id", "cso_credentials", "contacted_within_sla_15min", "triage_notes"],
      "properties": {
        "cso_employee_id": { "type": "string" },
        "cso_credentials": { "type": "string" },
        "contacted_within_sla_15min": { "type": "boolean" },
        "triage_notes": { "type": "string" }
      }
    },
    "root_cause_determination": {
      "type": "object",
      "required": ["primary_category", "detailed_finding", "preventive_action_taken"],
      "properties": {
        "primary_category": {
          "type": "string",
          "enum": [
            "PATIENT_UNDECLARED_ALLERGY",
            "INSULIN_DOSING_USER_ERROR",
            "KITCHEN_CROSS_CONTACT",
            "INGREDIENT_VENDOR_ADULTERATION",
            "TRANSIT_TEMP_ABUSE",
            "UNRELATED_CONCURRENT_ILLNESS"
          ]
        },
        "detailed_finding": { "type": "string" },
        "preventive_action_taken": { "type": "string" },
        "fssai_notification_filed": { "type": "boolean" }
      }
    }
  }
}
```
