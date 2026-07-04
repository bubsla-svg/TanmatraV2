# ISO 22000 / FSSAI Food Safety Systems Audit & O2O Telemetry Architecture

**Target Organization:** Tanmatra Kitchens India Private Limited (`https://tanmatra.food`)  
**Audit Scope:** Cloud Kitchen Operations (Noida Sector 62 / Delhi NCR & Bengaluru), O2O Telemetry, Allergen Exclusion, Batch/Lot Traceability Schema, KDS Display Protocols, and Emergency Recall Command Center.  
**Auditor Authority:** Lead ISO 22000 Food Safety Management System (FSMS) Auditor & FSSAI Schedule 4 Compliance Architect.

---

## 1. Executive Summary & Simulation Scenario

In precision clinical nutrition, an undeclared food allergen is not a quality defect—it is an **immediate life-threatening medical emergency (Anaphylaxis / Grade 4 Adverse Event)**. This audit evaluates Tanmatra's production readiness against a 4-stage simulated failure drill:

1. **Stage 1 (Order Placement):** User `pat_peanut_severe_099` (documented severe IgE-mediated peanut/tree nut allergy) places an order for *Moong Dal Chilla with Curd* and an add-on *Protein Boost Chutney*.
2. **Stage 2 (Hidden Variant Metadata Entry):** An upstream supplier (`SUP_AGRO_042`) quietly substituted cold-pressed sunflower oil with an unrefined peanut-blended oil (`LOT_OIL_PNT_991`) in the chutney base ingredient metadata without updating product title tags.
3. **Stage 3 (Mid-Shift Contamination Event):** During prep at `BAY_NOIDA_02`, a line cook utilizes a blender previously exposed to peanut paste without performing an ATP bioluminescence verification swab, contaminating production batch `BATCH_CHUTNEY_884`.
4. **Stage 4 (Multi-Order Recall & Containment):** Contamination is detected mid-shift via quality control ATP testing at $T+14\text{ mins}$. The system must identify all affected orders, lock kitchen bays, and broadcast emergency medical recall communications to all recipients within a **60-minute SLA**.

---

## 2. Step-by-Step Failure Drill Timeline ($T+00$ to $T+60\text{ Mins}$)

| Timestamp | Phase | Simulated Event | Architectural & Operational System Response |
| :--- | :--- | :--- | :--- |
| **$T+00:00$** | **Ingestion** | Patient `pat_peanut_severe_099` adds *Moong Dal Chilla* + *Protein Boost Chutney* to cart. | **Allergen Exclusion Guarantee:** Engine cross-references patient profile (`allergies: ["PEANUT", "TREE_NUT"]`) against ingredient variant metadata (deep scan of sub-ingredients, processing aids, and carrier oils). |
| **$T+00:02$** | **Interlock** | System detects `LOT_OIL_PNT_991` (Peanut Oil carrier) in *Protein Boost Chutney* metadata. | **Hard Stop Interlock:** Cart item *Protein Boost Chutney* is blocked (`RULE_PEANUT_HIDDEN_VARIANT_STOP`). System auto-substitutes *Zero-Allergen Mint-Coriander Chutney* (`LOT_MINT_102`) and flags order with `ALLERGEN_ISOLATION_REQUIRED`. |
| **$T+05:30$** | **KDS Routing** | Order `ORD_ALLERGEN_7712` fires to Noida Sector 62 Cloud Kitchen Display System (KDS). | **No-Truncation KDS Display:** Order banner renders in 36pt high-contrast crimson banner across top 35% of monitor: `🚨 SEVERE PEANUT ALLERGY - 0 PPM REQUIRED - ROUTE TO STERILE BAY 1 ONLY`. Truncation / ellipses (`...`) disabled by CSS/KDS firmware. |
| **$T+14:15$** | **QC Detection** | Shift QC supervisor conducts routine mid-shift ATP bioluminescence swab on `BAY_NOIDA_02` blender nozzle. | Swab reading returns `340 RLU` (Relative Light Units; threshold for sterile clean is $<50\text{ RLU}$). Immunoassay strip confirms presence of peanut protein ($\ge 2.5\text{ ppm}$). |
| **$T+14:45$** | **Containment** | QC Supervisor hits emergency **[LOCK BATCH]** command on Kitchen Tablet for `BATCH_CHUTNEY_884`. | **O2O ERP Lock:** Kitchen ERP instantly locks `BATCH_CHUTNEY_884` and parent lot `LOT_OIL_PNT_991` across all 4 cloud kitchens. Label printers at all bays cease printing labels for any order linked to this batch. |
| **$T+15:00$** | **Traceability** | Traceability engine queries WORM audit ledger for all active/dispatched orders referencing `BATCH_CHUTNEY_884`. | Engine identifies 14 affected orders: 6 in prep (instantly cancelled on KDS), 4 out for delivery with riders, and 4 delivered within the last 25 minutes. |
| **$T+16:30$** | **Recall Broadcast** | **Multi-Order Recall Command Center** initiates P0 emergency communication broadcast. | **Automated Broadcast:** System dispatches Priority-0 WhatsApp, SMS, push alerts, and automated IVR voice calls to the 4 delivered customers: *"🚨 URGENT MEDICAL RECALL: Do not consume Order ORD_XXXX. Contamination risk detected. Paramedic support line: +91 92892 13115."* |
| **$T+18:00$** | **Rider Intercept** | Logistics integration pushes override command to delivery partner apps (Zomato/Swiggy/Shadowfax API). | The 4 riders in transit receive flashing modal: *"STOP DELIVERY - RETURN TO KITCHEN IMMEDIATELY - DO NOT HANDOVER FOOD."* |
| **$T+45:00$** | **Revalidation** | Kitchen Bay 2 undergoes deep CIP (Clean-In-Place) sanitation protocol and 3-stage ATP re-swabbing. | ATP swabs return `12 RLU`, `8 RLU`, `15 RLU` (all $<50\text{ RLU}$). Bay unlocked for standard prep by Lead FSMS Auditor. |
| **$T+58:00$** | **Dossier Closure** | Recall Command Center logs complete audit chain and incident post-mortem to WORM storage. | 100% of affected customers confirmed contacted within 43 minutes 45 seconds ($<60\text{ min}$ SLA). Zero adverse health events reported. |

---

## 3. Mean Time to Detect / Isolate / Notify (MTTD / MTTI / MTTN) Targets

To maintain ISO 22000 certification and prevent medical liability, Tanmatra must enforce the following strict quantitative SLAs:

| Metric | Definition | Maximum Permissible SLA | Target Operational Benchmark | Architectural Mechanism |
| :--- | :--- | :---: | :---: | :--- |
| **MTTD (Mean Time to Detect)** | Elapsed time from contamination occurrence or hidden variant entry to system flagging. | **15 Minutes** | **$< 2\text{ Seconds}$** (Digital metadata)<br/>**$< 15\text{ Mins}$** (Physical kitchen ATP swab) | Deterministic JSON schema validation on supplier catalog uploads; mandatory 30-minute cadence ATP bioluminescence kitchen swabbing. |
| **MTTI (Mean Time to Isolate)** | Elapsed time from positive detection to total ERP batch lock and printer shutdown. | **2 Minutes** | **$< 50\text{ Milliseconds}$** | Distributed ERP event bus locking lot UUID across all kitchen bays and inhibiting ZPL/EPL printer gateways instantly. |
| **MTTN (Mean Time to Notify)** | Elapsed time from isolation lock to 100% multi-channel broadcast receipt by affected consumers and riders. | **60 Minutes** | **$< 3\text{ Minutes}$** | Concurrent multi-channel webhook dispatch (WhatsApp Business API, Twilio SMS, Firebase Push, O2O Rider API). |

---

## 4. Technical Specifications: Traceability Schema & KDS Display

### A. Batch / Lot Traceability Schema (`OrderTraceabilityRecord`)
Every meal portion leaving a Tanmatra kitchen must carry a cryptographic pedigree linking farm-level supplier lots to the consumer's medical profile:

```json
{
  "order_id": "ORD_ALLERGEN_7712",
  "patient_id": "pat_peanut_severe_099",
  "kitchen_id": "NOIDA_SECTOR_62_KITCHEN_01",
  "prep_bay": "BAY_STERILE_ALLERGEN_01",
  "packer_id": "emp_packer_noida_12",
  "timestamp_sealed": "2026-07-04T11:22:15Z",
  "patient_allergen_profile": ["PEANUT", "TREE_NUT", "SHELLFISH"],
  "kds_critical_flag": "🚨 SEVERE PEANUT ALLERGY - 0 PPM REQUIRED - ROUTE TO STERILE BAY 1 ONLY",
  "dishes": [
    {
      "dish_id": "dish_moong_chilla",
      "dish_name": "Renal-Safe Leached Moong Dal Chilla",
      "production_batch_id": "BATCH_CHILLA_902",
      "ingredient_lots": [
        {
          "ingredient_code": "ING_MOONG_DAL",
          "supplier_id": "SUP_AGRO_042",
          "supplier_lot_number": "LOT_DAL_2026_088",
          "coa_verified_ppm": { "peanut_ppm": 0.0, "gluten_ppm": 2.1 },
          "receipt_timestamp": "2026-07-01T08:00:00Z"
        },
        {
          "ingredient_code": "ING_COLD_PRESSED_OIL",
          "supplier_id": "SUP_AGRO_042",
          "supplier_lot_number": "LOT_MINT_102",
          "coa_verified_ppm": { "peanut_ppm": 0.0 },
          "receipt_timestamp": "2026-07-02T10:30:00Z"
        }
      ]
    }
  ],
  "tamper_seal_barcode": "SEAL_ORD_ALLERGEN_7712_HASH_8832a",
  "worm_ledger_tx": "tx_worm_9918237746129"
}
```

### B. KDS Critical Flag No-Truncation Requirement
Standard kitchen display screens truncate long customer notes with ellipses (`...`), which hides critical safety text like `"NO PEANUTS - SEVERE ALLERGY"`. Tanmatra KDS stations must enforce strict rendering constraints:

```css
/* KDS Critical Flag Rendering Standard (ISO 22000 Compliance) */
.kds-allergen-banner {
  background-color: #dc2626 !important; /* High-visibility crimson */
  color: #ffffff !important;
  font-size: 32px !important;
  font-weight: 900 !important;
  line-height: 1.2 !important;
  padding: 16px 24px !important;
  border: 4px solid #fef08a !important;
  text-transform: uppercase !important;
  
  /* CRITICAL: Prohibit truncation or clipping under any viewport width */
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: clip !important;
  word-wrap: break-word !important;
  min-height: 120px !important;
  display: flex !important;
  align-items: center !important;
}
```

---

## 5. Required O2O Kitchen Telemetry Dashboards

To maintain governance across Noida, Delhi NCR, and Bengaluru kitchens, central operations must maintain three real-time telemetry dashboards:

### Dashboard 1: Live Kitchen Hygiene & Airlock Monitor
* **Primary Widgets:** Real-time ATP swab pass/fail rates per bay; UV-C sterilization cycle countdowns; differential air pressure across sterile preparation bays (must maintain $+15\text{ Pa}$ positive pressure in allergen-free isolation rooms).
* **Alert Trigger:** Any ATP swab reading $>50\text{ RLU}$ instantly turns bay status **RED**, disabling order routing to that station.

### Dashboard 2: Supplier Lot Traceability & CoA Matrix
* **Primary Widgets:** Live genealogy graph mapping active production batches back to supplier Certificate of Analysis (CoA) lot uploads; allergen ppm distribution curves.
* **Alert Trigger:** Automatic flag if any ingredient variant metadata contains carrier oils or processing aids conflicting with declared 0-ppm specifications.

### Dashboard 3: Emergency Recall Command Center
* **Primary Widgets:** Live map tracking dispatched orders containing locked lots; multi-channel broadcast confirmation funnel (Sent $\rightarrow$ Delivered $\rightarrow$ Read / Acknowledged $\rightarrow$ Rider Intercepted).
* **Alert Trigger:** Automated PagerDuty escalation if any recall notice remains unacknowledged by a consumer or rider beyond $T+10\text{ mins}$.

---

## 6. Critical Controls Checklist Before Go-Live (FSSAI / ISO 22000 Gating)

Before launching commercial operations in any cloud kitchen, the facility must pass 100% of the following critical controls:

- [ ] **CC-01 (Metadata Deep Scan):** Verify backend ingestion engine parses 100% of sub-ingredient variant metadata (carrier oils, emulsifiers, anti-caking agents) before allowing catalog listing.
- [ ] **CC-02 (KDS No-Truncation Audit):** Physically inspect all 15-inch and 22-inch kitchen display monitors to confirm 36pt allergen flags wrap across multiple lines without ellipses.
- [ ] **CC-03 (Printer Hardware Interlock):** Verify that invoking `lockBatchLot()` in ERP cuts power/data commands to zebra barcode printers at packing stations within $<100\text{ ms}$.
- [ ] **CC-04 (Sterile Bay Positive Pressure):** Verify HVAC airlock sensors trigger an audible alarm if sterile preparation bay doors remain open $>30\text{ seconds}$.
- [ ] **CC-05 (60-Minute Drill Verification):** Perform live end-to-end synthetic recall simulation proving MTTD $<15\text{ m}$, MTTI $<2\text{ m}$, and MTTN $<60\text{ m}$ across WhatsApp and Rider APIs.
- [ ] **CC-06 (Shift Handover Sanitation):** Enforce strict shift-change interlock: incoming shift leads cannot print order tickets until logging 5 consecutive clean ATP swab readings ($<50\text{ RLU}$) into the kitchen tablet.
