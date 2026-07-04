# Tanmatra Production Deliverable 4: WORM Audit Trail Schema & RBAC Policy

**Document Version:** 1.0.0-PROD  
**Target Platform:** Tanmatra (`https://tanmatra.food`)  
**Domain:** Override Governance, Immutable Audit Trails & DPDP Act Compliance (Clinical Gate 6 & 10)  
**Evidentiary Standard:** Indian Evidence Act, 1872 (Section 65B Electronic Records Admissibility)  

---

## 1. Evidentiary Compliance & Legal Retention Framework

In the event of a medico-legal product liability lawsuit under the **Consumer Protection Act (CPA) 2019** or a statutory investigation by the **FSSAI** or **Medical Council**, Tanmatra must prove beyond reasonable doubt:
1. Exactly which clinical contraindication rules and nutritional specifications were active at the exact second a meal order was placed.
2. Whether a warning alert was explicitly presented to and acknowledged by the patient.
3. Whether a Registered Dietitian (RD) or treating physician authorized an override of a clinical threshold, including the exact lab report URI and clinical rationale used to justify that decision.

To satisfy Section 65B of the Indian Evidence Act, Section 43A of the IT Act, and Section 8 of the DPDP Act 2023, Tanmatra implements an **Immutable Write-Once-Read-Many (WORM) Cryptographic Audit Ledger** with an **8-year mandatory retention period** (matching Indian medical record retention norms under NMC Telemedicine Guidelines 2020).

---

## 2. Role-Based Access Control (RBAC) & IAM Policy Matrix

To prevent unauthorized clinical modifications, access to Tanmatra's protocol engine, contraindication overrides, and patient health data is strictly controlled via Role-Based Access Control (RBAC) enforced at the API gateway and GraphQL/REST resolver layers.

### 2.1 Comprehensive RBAC Policy Matrix

| Role Identifier | Role Description & Minimum Credentials | Permitted Clinical Actions | Prohibited Clinical Actions | Authentication & Override Verification |
| :--- | :--- | :--- | :--- | :--- |
| `ROLE_PATIENT_CONSUMER` | End-user / Patient or authenticated caregiver on `tanmatra.food`. | • Complete 60-sec metabolic intake.<br>• Acknowledge **Warning-Level** alerts (e.g., sodium or moderate GI).<br>• View personal meal macros & allergens. | • **CANNOT** override Hard-Stop contraindications (e.g., CKD K⁺, IgE allergens, pregnancy Listeria locks).<br>• **CANNOT** edit clinical diagnostic tags directly without re-intake. | Standard OAuth2 / OTP login. Must tick explicit digital consent box storing IP, user-agent, and timestamp for warnings. |
| `ROLE_TIER_1_SUPPORT` | Customer Care Rep / Order Dispatch Support Agent. | • View order delivery status and address.<br>• Pause or cancel scheduled deliveries.<br>• View non-clinical dietary preferences (e.g., Jain, vegan). | • **CANNOT** view patient medical diagnoses, HbA1c, eGFR, or lab reports (DPDP Act restriction).<br>• **CANNOT** override or edit any clinical rule or warning. | SSO / 2FA via corporate LDAP. Restricted to customer service CRM view with health data masked (`*****`). |
| `ROLE_TIER_2_CLINICAL_RD` | On-Duty Registered Dietitian (Indian Dietetic Assoc. registered). | • Override **Biochemical Hard-Stops** (Sodium, K⁺, Phosphorus, Carbs, Protein) when justified by uploaded lab reports.<br>• Author custom leached/modified meal plans.<br>• Execute 15-minute emergency AE triage. | • **CANNOT** override IgE-mediated anaphylactic allergen exclusions.<br>• **CANNOT** override FSSAI kitchen hygiene or expiration rules. | FIDO2 Hardware Key / Digital Signature Certificate (DSC) + IDA Registration Token verification. |
| `ROLE_TIER_3_CMO` | Chief Medical Officer / Clinical Advisory Panel (MBBS / MD / DM). | • Full clinical override authority across all biochemical and diagnostic parameters.<br>• Approve or lock protocol menu schemas.<br>• Authorize regulatory FSSAI/CPA disclosures. | • **CANNOT** bypass physical kitchen packing-station QR barcode interlocks or allergen isolation protocols. | Class-3 Digital Signature Certificate (DSC) + Medical Council Registration verification. |
| `ROLE_QA_SUPERVISOR` | ISO 22000 Kitchen Quality Assurance Supervisor (Noida Facility). | • Execute packing station interlock PIN reset for physically replaced/damaged containers.<br>• Trigger emergency kitchen lot locks across NCR. | • **CANNOT** access patient medical profiles, names, or contact info.<br>• **CANNOT** alter recipe nutritional specs or contraindication thresholds. | biometric kiosk login + 6-digit dynamic hardware token in Noida kitchen. |

---

## 3. Cryptographic Hash-Chained WORM Architecture

To ensure audit records cannot be silently altered or deleted even by database administrators, every audit event is serialized, timestamped, and linked to the previous event using a **SHA-256 Cryptographic Hash Chain** (similar to a structured Merkle chain or AWS QLDB ledger).

```
+-------------------------------------------------------+
| AUDIT EVENT (n-1): Session Start                      |
| event_id: aud_7721                                    |
| event_hash: 8f4a9b2c...                               |
+-------------------------------------------------------+
                           │
                           ▼ (previous_event_hash)
+-------------------------------------------------------+
| AUDIT EVENT (n): Clinical RD Override Approved        |
| event_id: aud_7722                                    |
| timestamp: 2026-07-04T05:14:02.109Z                   |
| actor: ROLE_TIER_2_CLINICAL_RD (emp_rd_402)           |
| previous_event_hash: 8f4a9b2c...                      |
| payload_hmac: SHA256(payload + previous_event_hash)   |
| event_hash: d3e10a8f94c2b810938...                    |
+-------------------------------------------------------+
                           │
                           ▼ (previous_event_hash)
+-------------------------------------------------------+
| AUDIT EVENT (n+1): Kitchen Packing Interlock Success  |
| event_id: aud_7723                                    |
| previous_event_hash: d3e10a8f94c2b810938...           |
+-------------------------------------------------------+
```

If an unauthorized actor tampers with `aud_7722` (e.g., changing an overridden potassium value from 720 mg to 550 mg), `event_hash` changes, instantly breaking the cryptographic chain for `aud_7723` and alerting the CISO and Medico-Legal Auditor.

---

## 4. Complete JSON Schemas for Core Clinical Events

### 4.1 Schema 1: Patient Warning Acknowledgment Event (`PATIENT_WARNING_ACK`)
Logged when a patient acknowledges a Warning-Level alert (e.g., controlled T2D or mild hypertension) during cart checkout on `tanmatra.food`.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PatientWarningAcknowledgmentEvent",
  "type": "object",
  "required": ["event_id", "event_type", "timestamp_utc", "actor", "chaining", "payload"],
  "properties": {
    "event_id": { "type": "string", "pattern": "^aud_[0-9]+_[a-z0-9]+$" },
    "event_type": { "type": "string", "const": "PATIENT_WARNING_ACKNOWLEDGMENT" },
    "timestamp_utc": { "type": "string", "format": "date-time" },
    "actor": {
      "type": "object",
      "required": ["user_id", "role", "ip_address", "user_agent", "dpdp_consent_token"],
      "properties": {
        "user_id": { "type": "string" },
        "role": { "type": "string", "const": "ROLE_PATIENT_CONSUMER" },
        "ip_address": { "type": "string" },
        "user_agent": { "type": "string" },
        "dpdp_consent_token": { "type": "string" }
      }
    },
    "chaining": {
      "type": "object",
      "required": ["previous_event_hash", "event_hash"],
      "properties": {
        "previous_event_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "event_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
      }
    },
    "payload": {
      "type": "object",
      "required": ["order_id", "dish_id", "dish_name", "triggered_rule_id", "acknowledged_threshold", "consent_legal_text"],
      "properties": {
        "order_id": { "type": "string" },
        "dish_id": { "type": "string" },
        "dish_name": { "type": "string" },
        "triggered_rule_id": { "type": "string", "const": "RULE_T2D_CONTROLLED_WARNING_V1" },
        "acknowledged_threshold": { "type": "string", "const": "Glycemic Index 58 > 55 max warning" },
        "consent_legal_text": {
          "type": "string",
          "const": "I acknowledge that this meal exceeds my recommended glycemic/sodium warning threshold and accept personal responsibility for consuming it within my daily dietary allocation under physician care."
        }
      }
    }
  }
}
```

### 4.2 Schema 2: Clinical RD Override Approved Event (`CLINICAL_RD_OVERRIDE`)
Logged when a Registered Dietitian overrides a Hard-Stop for a CKD or T2D patient based on uploaded diagnostic labs.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ClinicalRDOverrideEvent",
  "type": "object",
  "required": ["event_id", "event_type", "timestamp_utc", "actor", "chaining", "payload"],
  "properties": {
    "event_id": { "type": "string" },
    "event_type": { "type": "string", "const": "CLINICAL_RD_OVERRIDE_APPROVED" },
    "timestamp_utc": { "type": "string", "format": "date-time" },
    "actor": {
      "type": "object",
      "required": ["employee_id", "role", "ida_registration_number", "dsc_signature_token"],
      "properties": {
        "employee_id": { "type": "string" },
        "role": { "type": "string", "const": "ROLE_TIER_2_CLINICAL_RD" },
        "ida_registration_number": { "type": "string" },
        "dsc_signature_token": { "type": "string" }
      }
    },
    "chaining": {
      "type": "object",
      "required": ["previous_event_hash", "event_hash"],
      "properties": {
        "previous_event_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "event_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
      }
    },
    "payload": {
      "type": "object",
      "required": ["patient_id", "overridden_rule_id", "dish_id", "original_limit", "approved_limit", "clinical_justification", "lab_evidence_vault_uri"],
      "properties": {
        "patient_id": { "type": "string" },
        "overridden_rule_id": { "type": "string", "const": "RULE_CKD_HARD_STOP_V1" },
        "dish_id": { "type": "string" },
        "original_limit": { "type": "string", "const": "Potassium max 600mg/meal" },
        "approved_limit": { "type": "string", "const": "Potassium approved 710mg for this specific leached meal" },
        "clinical_justification": { "type": "string" },
        "lab_evidence_vault_uri": { "type": "string", "format": "uri" }
      }
    }
  }
}
```

---

## 5. Production TypeScript WORM Logger & RBAC Middleware

The following TypeScript implementation enforces RBAC permissions before any clinical transaction and writes hash-chained WORM audit logs compliant with Section 65B of the Indian Evidence Act.

```typescript
import crypto from 'crypto';

export type UserRole = 'ROLE_PATIENT_CONSUMER' | 'ROLE_TIER_1_SUPPORT' | 'ROLE_TIER_2_CLINICAL_RD' | 'ROLE_TIER_3_CMO' | 'ROLE_QA_SUPERVISOR';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  credentials?: string;
  ipAddress: string;
  userAgent: string;
}

export interface WormAuditRecord {
  event_id: string;
  event_type: string;
  timestamp_utc: string;
  actor: AuthenticatedUser;
  chaining: {
    previous_event_hash: string;
    event_hash: string;
  };
  payload: Record<string, any>;
}

export class RBACEnforcementMiddleware {
  private static readonly PERMISSION_MATRIX: Record<string, UserRole[]> = {
    'ACKNOWLEDGE_WARNING': ['ROLE_PATIENT_CONSUMER'],
    'OVERRIDE_BIOCHEMICAL_HARD_STOP': ['ROLE_TIER_2_CLINICAL_RD', 'ROLE_TIER_3_CMO'],
    'OVERRIDE_ALLERGEN_HARD_STOP': [], // Strictly prohibited for all roles without 0ppm ELISA
    'LOCK_KITCHEN_PRODUCTION_LOT': ['ROLE_TIER_2_CLINICAL_RD', 'ROLE_TIER_3_CMO', 'ROLE_QA_SUPERVISOR'],
    'VIEW_UNMASKED_CLINICAL_BIOMARKERS': ['ROLE_PATIENT_CONSUMER', 'ROLE_TIER_2_CLINICAL_RD', 'ROLE_TIER_3_CMO'],
    'RESET_PACKING_STATION_INTERLOCK': ['ROLE_QA_SUPERVISOR', 'ROLE_TIER_3_CMO']
  };

  public static authorize(action: string, user: AuthenticatedUser): void {
    const allowedRoles = this.PERMISSION_MATRIX[action];
    if (!allowedRoles) {
      throw new Error(`Security Exception: Action '${action}' is not defined in the RBAC matrix.`);
    }

    if (!allowedRoles.includes(user.role)) {
      throw new Error(`RBAC Access Denied: User role '${user.role}' is not authorized to perform action '${action}'.`);
    }
  }
}

export class CryptographicWormLogger {
  private lastEventHash: string = '0000000000000000000000000000000000000000000000000000000000000000'; // Genesis hash

  constructor(
    private readonly wormStorageGateway: { appendImmutableRecord(record: WormAuditRecord): Promise<void>; getLatestHash(): Promise<string> },
    private readonly hmacSecretKey: string = process.env.WORM_AUDIT_HMAC_KEY || 'tanmatra_evd_65b_secret'
  ) {}

  public async initializeGenesis(): Promise<void> {
    try {
      this.lastEventHash = await this.wormStorageGateway.getLatestHash();
    } catch {
      this.lastEventHash = '0000000000000000000000000000000000000000000000000000000000000000';
    }
  }

  public async logEvent(eventType: string, actor: AuthenticatedUser, payload: Record<string, any>): Promise<WormAuditRecord> {
    const timestampUtc = new Date().toISOString();
    const eventId = `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const previousHash = this.lastEventHash;

    // Construct canonical serialized payload for hashing
    const canonicalString = JSON.stringify({
      event_id: eventId,
      event_type: eventType,
      timestamp_utc: timestampUtc,
      actor,
      previous_event_hash: previousHash,
      payload
    });

    // Compute HMAC-SHA256 event hash
    const eventHash = crypto.createHmac('sha256', this.hmacSecretKey).update(canonicalString).digest('hex');

    const record: WormAuditRecord = {
      event_id: eventId,
      event_type: eventType,
      timestamp_utc: timestampUtc,
      actor,
      chaining: {
        previous_event_hash: previousHash,
        event_hash: eventHash
      },
      payload
    };

    // Append to WORM storage (Cloud Storage Object Lock / BigQuery with 8-year retention)
    await this.wormStorageGateway.appendImmutableRecord(record);
    this.lastEventHash = eventHash;
    return record;
  }
}
```
