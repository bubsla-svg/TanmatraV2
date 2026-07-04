# India DPDPA 2023 Legal Privacy, Consent & Medical Risk Audit

**Target Organization:** Tanmatra Kitchens India Private Limited (`https://tanmatra.food` & `@workspace/tanmatra-mobile`)  
**Audit Scope:** Digital Personal Data Protection Act (DPDPA 2023) Compliance, Telemedicine Practice Guidelines 2020 Medical Disclaimers, Granular Purpose Consent, Right to Erasure Enforceability, Verifiable Parental Consent for Minors, and WORM Consent Receipts.  
**Auditor Authority:** Product Counsel Assistant & Privacy UX Auditor.

---

## 1. Executive Summary & Legal-Risk Matrix

Because Tanmatra ingests sensitive health telemetry (eGFR renal markers, serum potassium, blood glucose trends, and wearable activity streams) to formulate clinical meal plans, the platform processes personal data that carries heightened scrutiny under the **India Digital Personal Data Protection Act (DPDPA 2023)** and the **National Medical Commission (NMC) Telemedicine Guidelines**.

Failing to secure explicit, unbundled affirmative consent or failing to honor granular withdrawal requests exposes Tanmatra to financial penalties under DPDPA Schedule 1 up to **₹250 Crore INR** per breach, alongside clinical misrepresentation liabilities.

### Legal-Risk Matrix & Remediation Controls

| Assessment Pillar | Statutory & Regulatory Reference | Identified Operational Vulnerability | Risk Severity & Exploitability | Mandatory Control & Remediation Gate |
| :--- | :--- | :--- | :---: | :--- |
| **1. Explicit Health Profiling Consent** | DPDPA 2023 Section 6(1)<br/>*(Notice & Affirmative Consent)* | Ingesting wearable biometrics (`WearableTelemetryPayload`) or blood lab values without explicit notice and affirmative click-wrap opt-in at onboarding. | **HIGH**<br/>`[Requires Legal Counsel Confirmation]` | Implement mandatory onboarding notice modal detailing exact biomarkers collected, purpose, and processing duration; prohibit pre-ticked checkboxes. |
| **2. Granular Purpose Withdrawal** | DPDPA 2023 Section 6(4)<br/>*(Right to Withdraw Consent)* | Bundling food delivery terms with continuous Apple/Garmin sync and WhatsApp marketing; lack of 1-click withdrawal toggle inside mobile settings. | **HIGH**<br/>`[Requires Legal Counsel Confirmation]` | Unbundle consent into 4 independent toggles (`PURPOSE_CLINICAL_MEAL_MATCHING`, `PURPOSE_WEARABLE_SYNC`, etc.); ensure withdrawal stops processing within $<24\text{ hours}$ without blocking food ordering. |
| **3. Right to Erasure vs Statutory Hold** | DPDPA 2023 Section 12(3)<br/>*(Erasure of Personal Data)* | User requests account deletion, but backend either refuses deletion due to tax logs OR deletes critical statutory GST invoices and Grade 3 medico-legal dossiers. | **CRITICAL**<br/>`[Requires Legal Counsel Confirmation]` | Deploy split-deletion engine: anonymize user profile, biometrics, and delivery addresses in 30 days, while placing financial ledgers (GST Section 34 notes) and Grade 3 AE dossiers under 8-year statutory legal hold. |
| **4. Click-Wrap Medical Disclaimers** | NMC Telemedicine Guidelines 2020 & Consumer Protection Act 2019 | Relying on passive website footer text (`Terms of Use`) to warn patients with CKD Stage 3b or Diabetes that Tanmatra meals do not replace clinical prescriptions. | **CRITICAL**<br/>`[Requires Legal Counsel Confirmation]` | Enforce mandatory affirmative click-wrap checkbox before first checkout on `Clinical` and `Performance` protocols: *"I understand Tanmatra provides precision dietary scoring, not medical diagnosis..."* |
| **5. Minors & Guardian Handling** | DPDPA 2023 Section 9<br/>*(Processing of Personal Data of Children)* | Allowing users under 18 years of age to register athletic/performance profiles or submit CGM trends without verifiable parental/guardian consent and age verification. | **CRITICAL**<br/>`[Requires Legal Counsel Confirmation]` | Enforce date-of-birth gate at signup; if age $<18$, block profiling and trigger mandatory parental consent verification via DigiLocker / Aadhaar-linked guardian phone OTP before activating telemetry sync. |
| **6. WORM Consent Receipt Audit Trail**| DPDPA 2023 Section 8(1)<br/>*(Compliance & Evidence)* | Storing user consent status as mutable boolean flags (`is_agreed: true`) in PostgreSQL without cryptographic proof of notice version or IP timestamp. | **MEDIUM**<br/>`[Requires Legal Counsel Confirmation]` | Emit SHA-256 hashed consent receipts containing user ID, policy version (`DPDPA_NOTICE_V1.4`), IP address, and granular toggles into our immutable WORM audit ledger (`CryptographicWormLogger`). |

---

## 2. UX Copy & Privacy Control Recommendations

To eliminate dark patterns and comply with DPDPA Section 5 (Notice in English and 22 scheduled Indian languages), the mobile onboarding and settings viewports (`@workspace/tanmatra-mobile`) must implement the following standardized copy:

### A. Affirmative Click-Wrap Medical Disclaimer (Pre-Checkout Modal)
> **🏥 Clinical Nutrition & Medical Advisory Disclosure**  
> *"Tanmatra uses proprietary nutritional scoring algorithms ($D$) and registered dietitian (RD) advisory formulations to match culinary dishes against your health goals. **Tanmatra is a precision culinary platform, not a licensed healthcare provider.** Our meal plans do not constitute medical diagnosis, treatment, or prescription therapy. If you have chronic kidney disease (CKD), diabetes, or severe allergies, consult your treating physician before altering your diet."*  
>  
> [ ] **I have read and affirmatively agree to the Clinical Advisory Disclosure (Required for Clinical/Performance plans).**

### B. Granular Consent Toggles (Settings -> Privacy & Data Control)
* [x] **Core Clinical Meal Matching (Required for Personalized Menu):** *Allows Tanmatra to process your health biomarkers (age, weight, eGFR, glucose) to calculate menu match scores and prevent contraindicated meal checkouts.*
* [ ] **Continuous Wearable Device Sync (Optional):** *Allows hourly synchronization of active calories, resting heart rate, and sleep scores from Garmin/Apple Watch via Open Wearables.*  
  *👉 `[Revoke Sync Consent]` (Stops data pulling immediately; reverts menu to standard static calorie display).*
* [ ] **WhatsApp O2O Order & Safety Notifications (Optional):** *Allows Tanmatra to send live delivery tracking, kitchen prep pings, and emergency safety instructions to your verified mobile number.*
* [ ] **De-Identified Nutritional R&D Analytics (Optional):** *Allows Tanmatra to aggregate anonymized meal selection patterns to improve our clinical recipes.*

---

## 3. Consent Event Schema & Erasure Payload Requirements

All consent interactions and deletion requests must serialize into strict JSON schemas compliant with our immutable backend gateways:

### WORM Consent Receipt Schema (`DpdpaConsentReceipt`)
```json
{
  "$schema": "https://tanmatra.food/schemas/dpdpa-consent-receipt-v1.json",
  "consent_receipt_id": "cns_rcpt_99218472_01",
  "user_id": "tanmatra_user_901",
  "notice_version": "DPDPA_NOTICE_V1.4_EN",
  "captured_at_iso": "2026-07-04T07:01:00Z",
  "client_context": {
    "ip_address": "103.21.124.8",
    "user_agent": "TanmatraMobile/1.0.4 (iOS 17.5)",
    "device_fingerprint": "dev_ios_uuid_abc123"
  },
  "granular_consents": {
    "PURPOSE_CLINICAL_MEAL_MATCHING": true,
    "PURPOSE_WEARABLE_SYNC": true,
    "PURPOSE_WHATSAPP_NOTIFICATIONS": true,
    "PURPOSE_ANONYMIZED_RD_ANALYTICS": false
  },
  "guardian_verification": null,
  "cryptographic_proof_sha256": "8f3b2a1c4e5d6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a"
}
```

### Right to Erasure Scheduling Payload (`DpdpaErasureJob`)
```json
{
  "erasure_job_id": "erase_job_8812_usr_901",
  "user_id": "tanmatra_user_901",
  "requested_at_iso": "2026-07-04T07:01:00Z",
  "scheduled_execution_iso": "2026-08-03T07:01:00Z",
  "anonymization_targets": [
    "user_profiles (demographics, weight, age)",
    "user_biometric_telemetry (hourly timeseries)",
    "saved_delivery_addresses (Sector 62 residential strings)"
  ],
  "statutory_legal_hold_exemptions": [
    "order_financial_ledgers (Retained 8 years under Companies Act & India GST Section 34 rules)",
    "medico_legal_dossiers (Grade 3 Critical AEs retained 8 years under FSSAI / NMC liability rules)"
  ],
  "status": "SCHEDULED_GRACE_PERIOD_30_DAYS"
}
```

---

## 4. Must-Fix List Before Go-Live (DPDPA 2023 Gating)

Before public registration opens on Day 1, the legal and engineering leads must verify all 5 non-negotiable privacy gates:

- [ ] **GATE-PRIV-01 (Onboarding Click-Wrap):** Verify that new users cannot place an order on `Clinical` or `Performance` protocols without affirmatively ticking the mandatory medical advisory disclaimer checkbox.
- [ ] **GATE-PRIV-02 (Granular Consent Unbundling):** Verify that revoking `PURPOSE_WEARABLE_SYNC` immediately halts telemetry ingestion within $<1\text{ second}$ while keeping standard food ordering functional.
- [ ] **GATE-PRIV-03 (Minors Age Gate & Guardian Interlock):** Verify that entering a birthdate representing age $<18$ blocks biometric profiling until a verifiable guardian phone OTP is recorded and hashed.
- [ ] **GATE-PRIV-04 (Split Right-to-Erasure Execution):** Verify that running an account deletion job scrubs eGFR and phone numbers to `[REDACTED_PHI]` while keeping balanced financial journal lines intact for India GST audits.
- [ ] **GATE-PRIV-05 (WORM Receipt Hash Verification):** Verify every consent grant or withdrawal appends an immutable SHA-256 hash record to `CryptographicWormLogger`.
