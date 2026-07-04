# Production QA Testing Matrix: Tanmatra Clinical Governance & CRO Platform

This document establishes the end-to-end Quality Assurance (QA) verification matrix for the Tanmatra precision nutrition ecosystem (`https://tanmatra.food` & `@workspace/tanmatra-mobile`). Every test case maps directly to our verified backend engines and mobile UI overrides.

---

## 1. Automated Execution Commands

Before performing manual UI validation, execute the automated regression suites to confirm baseline integrity:

```bash
# 1. Execute complete backend clinical governance & wearable scoring engine suite
npx -y ts-node@10.9.2 --files src/verify_suite.ts

# 2. Execute mobile TypeScript & JSX bundler type validation
pnpm --filter @workspace/tanmatra-mobile run typecheck
```

---

## 2. Test Suite 1: Clinical Governance & Contraindication Hard Stops (`ContraindicationEngine.ts`)

| Test ID | Test Case Description | Prerequisites / Input State | Execution Steps | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-BIO-01** | CKD Potassium Hard Stop | Patient dossier: `eGFR: 38 mL/min`, diagnosis `CKD_STAGE_3B`. Dish: `Aliya Viral Beetroot Curd` (`K+: 680 mg`). | 1. Invoke `evaluateDish(ckdPatient, beetrootDish)` during meal customization. | System evaluates potassium (`680 mg > 500 mg threshold`). Returns `status: "HARD_STOP"`, `is_checkout_blocked: true`. | **PASS** only if checkout is strictly locked with rule ID `RULE_CKD_HARD_STOP_V1`. |
| **TC-BIO-02** | T2D Glycemic Load Interlock | Patient dossier: `HbA1c: 7.8%`, diagnosis `T2D`. Dish with `Glycemic Load: 22`. | 1. Attempt to add dish to cart under therapeutic diabetes protocol. | Engine flags `GL > 15`. Blocks transaction with `RULE_T2D_GL_HARD_STOP_V1`. | **PASS** only if high-GL carbohydrate meals are rejected automatically. |
| **TC-BIO-03** | Pregnancy Microbial Safety | Patient dossier: `is_pregnant: true`. Dish containing unpasteurized dairy or raw sprouts. | 1. Select dish containing unpasteurized curd or raw bean sprouts. | Engine triggers `RULE_PREGNANCY_MICROBIAL_HARD_STOP_V1`. Suggests leached / pasteurized alternative. | **PASS** only if zero unpasteurized items bypass the filter. |

---

## 3. Test Suite 2: Packing Station Barcode & Hardware Interlock (`PackingStationInterlockService.ts`)

| Test ID | Test Case Description | Prerequisites / Input State | Execution Steps | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-PCK-01** | Contraindicated Lot Scan | Active packing session at `BAY_NOIDA_01` for CKD patient `ORD_9912`. Packer scans container barcode for `Aliya Viral Beetroot Curd`. | 1. Execute `scanDishContainer()` with contraindicated dish specification. | Printer gateway hardware lock engaged (`locked = true`). Tamper-evident seal label printing aborted. | **PASS** if label printer refuses to dispense physical seal label. |
| **TC-PCK-02** | Hardware Alarm & Audit | Same state as TC-PCK-01 after contraindicated scan attempt. | 1. Observe alarm gateway and WORM audit logger. | Alarm sounds at `85dB` for `30,000ms`. Event `CLINICAL_SAFETY_INTERLOCK_BREACH` appended to WORM log. | **PASS** if alarm triggers and WORM audit chain logs breach hash. |

---

## 4. Test Suite 3: Adverse Event Triage & Medico-Legal Dossiers (`AdverseEventWebhookController.ts`)

| Test ID | Test Case Description | Prerequisites / Input State | Execution Steps | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADV-01** | Grade 3 Anaphylactic Ingestion | Inbound WhatsApp webhook message from `+91 9811122233`: *"My throat is swelling up and having reaction after eating the salad!"* | 1. Ingest webhook payload via `processInboundWebhook()`. | NLP engine classifies severity as `GRADE_3_CRITICAL`. Medico-legal dossier saved to DB. | **PASS** if dossier is generated within `<200ms` with exact patient mapping. |
| **TC-ADV-02** | Automated Lot Lock & PagerDuty | Same state as TC-ADV-01 after dossier creation. | 1. Verify automated response execution across ERP and PagerDuty. | PagerDuty triggers P0 incident. Noida ERP locks production lot `LOT_BEET_882`. Emergency auto-reply sent to user. | **PASS** if production lot is immediately locked in ERP to prevent further dispatches. |

---

## 5. Test Suite 4: Wearable-to-Meal Euclidean Scoring Engine (`WearableMealScoringEngine.ts`)

| Test ID | Scenario & Telemetry Input | Translation Vector Output ($\vec{T}$) | Euclidean Distance Ranking ($D$) | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-WRE-01** | **Scenario A (Post-Workout Recovery)**<br/>Garmin telemetry: `active_calories_burned_today: 620 kcal` (>600 kcal trigger). | Protocol: `Performance`<br/>Targets: `Carbs: 50g (+25%)`, `Protein: 45g (+15g)`, `Fat: 12g`<br/>Weights: $w_p=2.5, w_c=1.5, w_f=1.0$ | **Rank #1: Grilled Chicken, Sautéed Veg & Mash**<br/>Distance: `27.36` (Match Score: `45%`) | **PASS** if high-protein chicken dish ranks #1 over light snacks. |
| **TC-WRE-02** | **Scenario B (Metabolic Crash Protection)**<br/>CGM telemetry: `current_glucose_mgdl: 74 mg/dL`, trend: `falling_rapidly`. | Protocol: `Clinical`<br/>Targets: `Carbs: 35g (Low-GI)`, `Protein: 18g`, `Fat: 6g`<br/>Weights: $w_c=2.0, w_p=1.5, w_f=1.0$ | **Rank #1: Moong Dal Chilla with Curd**<br/>Distance: `5.00` (Match Score: `90%`) | **PASS** if slow-release complex carb dish ranks #1 with Distance $\le 5.00$. |
| **TC-WRE-03** | **Scenario C (Wellness Core Recovery)**<br/>Oura telemetry: `sleep_efficiency_score: 0.68` (<75%), `hrv_status: low_strain`. | Protocol: `Wellness`<br/>Targets: `Carbs: 20g`, `Protein: 6g`, `Fat: 4g`<br/>Weights: $w_f=2.0, w_c=1.2, w_p=1.2$ | **Rank #1: Aliya Viral Beetroot Curd** & **Activated Charcoal Smoothie**<br/>Distance: `2.61` (Match Score: `95%`) | **PASS** if light, anti-inflammatory/detox selections achieve 95% match. |
| **TC-WRE-04** | **Active Hyperglycemic Spike**<br/>CGM telemetry: `current_glucose_mgdl: 172 mg/dL` (>160 mg/dL threshold). | Protocol: `Clinical`<br/>Targets: `Carbs: 10g (<15g net)`, `Protein: 35g`, `Fat: 15g`<br/>Weights: $w_c=3.0$ (heavy penalty) | **Rank #1: Grilled Chicken Breast (Single Serve)**<br/>Distance: `13.56` (0g Carbs / 31g Protein) | **PASS** if zero-carb keto dish is strictly selected over carbohydrate items. |

---

## 6. Test Suite 5: Mobile CRO & UX Overrides (`@workspace/tanmatra-mobile`)

| Test ID | Conversion Vector & Component | Execution Steps | Expected UI / UX Behavior | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-CRO-01** | Intake Funnel De-Gating (`app/index.tsx`) | 1. Open app as guest visitor without completing 60-s assessment.<br/>2. Tap "Browse Menu First" escape hatch. | User immediately enters menu catalog. Floating non-intrusive banner prompts: *"Tap to calibrate menu with 5-second Apple Health prefill."* | **PASS** if catalog is browseable ungated while preserving clinical safety interlock on cart add. |
| **TC-CRO-02** | Logistics Reassurance (`HyperlocalHeader.tsx`) | 1. Inspect top header on mobile viewport.<br/>2. Tap `Sector 62, Noida NCR ▾`.<br/>3. Enter PIN `201301` or tap `Use Live Device GPS Location`. | Header displays animated green ping dot with `32 MINS · NOIDA KITCHEN ONLINE`. Modal opens smoothly and updates local sector label upon confirmation. | **PASS** if address modal resolves geographical doubt between Bengaluru HQ and Noida kitchen. |
| **TC-CRO-03** | WhatsApp Fallback Checkout (`WhatsAppFallbackModal`) | 1. Add meal to cart.<br/>2. Simulate payment gateway timeout or disabled JavaScript during checkout trigger. | System intercepts checkout error and launches fallback prompt linking to `whatsapp://send?phone=919289213115` with pre-populated order JSON. | **PASS** if pre-formatted WhatsApp handshake contains item ID, price, and sector address. |
| **TC-CRO-04** | Nutrient Progressive Disclosure (`MenuCard.tsx`) | 1. View product listing card on mobile screen.<br/>2. Tap on the 4-column macro pill box (`Calories`, `Protein`, `Carbs`, `Fat`). | Card shows clean, high-contrast macro badges (`388 kcal`, `42g`, `28g`, `12g`). Tapping expands detailed percentage breakdown (`51% P · 34% C · 15% F`). | **PASS** if primary card layout stays visually uncluttered on compact viewports. |
| **TC-CRO-05** | Multi-Tier Up-sell Stepping Stones (`MenuCard.tsx`) | 1. Locate `SELECT PROGRAM PREFERENCE` section inside `MenuCard`.<br/>2. Select `Start 3-Day Protocol Trial`.<br/>3. Tap CTA button. | Radio selector highlights with green border. Price dynamically reflects 25% first-order discount (`₹1,125`). CTA updates to `ACTIVATE 3-DAY PROTOCOL TRIAL · ₹1,125`. | **PASS** if user can seamlessly select Single (`₹333`), Trial (`₹1,125`), or Weekly (`₹7,490/wk`). |
| **TC-CRO-06** | Action-Proximate Trust Architecture (`MenuCard.tsx` & `TrustBadges.tsx`) | 1. Inspect visual hierarchy around product imagery and cart buttons. | Top right of dish image displays `✓ RD Advisory Board Verified`. Bottom near checkout displays `FSSAI LIC: 22725926001018 • ISO 22000 CERTIFIED`. | **PASS** if statutory compliance markers are prominently anchored adjacent to conversion actions. |
| **TC-CRO-07** | Protocol Switcher Feedback (`ProtocolSwitcher.tsx`) | 1. Tap between `Wellness`, `Performance`, and `Clinical` protocol tabs.<br/>2. Observe status bar and progress indicator. | Active tab border changes color (`#10b981` vs `#f97316` vs `#3b82f6`). Pulse loader animates across bottom (`⚡ Re-calibrating...`). Status bar displays `Garmin & Apple Watch Sync Active`. | **PASS** if transition animations complete within `<850ms` and update active protocol theme. |

---

## 7. Rollback & Contingency Protocols

If any critical test case fails in staging or production, execute the immediate containment actions below:

1. **Clinical Safety Interlock Failure (TC-BIO / TC-PCK fails):**
   - *Immediate Action:* Set global environment flag `EXPO_PUBLIC_ENFORCE_STRICT_AIRLOCK=1` to force all guest users through mandatory clinical review before order dispatch.
2. **Payment Gateway Outage (TC-CRO-03):**
   - *Immediate Action:* Toggle feature flag `ENABLE_WHATSAPP_ONLY_CHECKOUT=true` in edge router configuration to route 100% of checkout traffic to the Noida kitchen WhatsApp triage desk (`+91 92892 13115`).
3. **Wearable API Disconnect / Rate Limit (TC-WRE fails):**
   - *Immediate Action:* Fallback to steady-state baseline vector ($C=40\text{g}, P=30\text{g}, F=12\text{g}$) and display banner: *"Showing standard balanced menu. Re-sync device in settings."*
