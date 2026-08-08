# Clinical-Governance-Engine Integration Review

> 2026-08-08. Follow-up to [`clinical-scope.md`](./clinical-scope.md) §1.2, which
> flagged `artifacts/clinical-governance-engine` (5,143 lines, zero dependents)
> as the highest-severity P0 finding. This document records the full
> per-service integration review that finding called for. Method: every source
> file in the package was read end-to-end, its verify suite was executed, and
> the live api-server integration surfaces (checkout, KDS, dispatch,
> symptom-logs, wearable) were mapped for insertion points.
>
> **Headline verdict: none of the six clinically-named services is safe to
> wire today — not even in advisory mode.** Each needs either input data that
> does not exist in the live schema, a delivery channel with no production
> implementation, or duplicates a live mechanism outright. Wiring any of them
> now would fabricate inputs or silently no-op outputs — recreating, one level
> down, the exact failure mode the package already embodies: a safety
> mechanism that appears to exist but does not run.

## How the live system does clinical safety today (the bar to match)

Two house patterns, both synchronous in Express handlers:

- **Blocking**: `lib/checkoutSafety.ts` (pure, DB-free, wraps
  `@workspace/preferences-match`) called inline in `POST /orders`
  (`routes/checkout.ts:184,220`) and in the subscription path
  (`lib/loyaltyEngine.ts` safety evaluation) — 422 with structured reasons,
  order never persisted. The subscription path writes an `ops_actions` audit
  row before throwing.
- **Advisory**: `lib/clinicalGuardrailEngine.ts` called from
  `routes/wearable.ts:394` — always responds 200; alerts the RD by upserting a
  templated row into `rdClientSummariesTable` plus a `logger.warn`. It
  deliberately never writes `dailyTargetsTable`; `guardrailEngines.test.ts`
  regression-pins that ("the engine wrote daily_targets — the autonomous
  clinical intervention is back").

The advisory pattern works because its input (a glucose number) already
exists and its output (a summary row) goes to an existing table. That is the
test every candidate below fails.

## Per-service verdicts

| Service | Verdict | Blocking reason |
|---|---|---|
| `ContraindicationEngine` | **Needs product decision + data pipeline** | Real, deterministic rule logic (all 6 rules traced) — but its `PatientProfile` (structured eGFR/potassium/HbA1c biomarkers, severity-tiered allergies) and `DishSpecification` (micros, glycemic load, ELISA certification) match nothing in the live schema. `patient_biomarkers` is generic jsonb; `DishData` has no micros. Fail-opens on missing biomarkers — partial data is worse than none. |
| `PackingStationInterlockService` | **Needs business/liability decision** | A real gate (lock + alarm on violation), but: in-memory session state (dies on restart/multi-instance), all four hardware gateways (printer/alarm/audit/supervisor-auth) unimplemented, same nonexistent data shape as above — and software halting a physical kitchen is an operational-liability call (who overrides a false positive, how fast), not an engineering one. |
| `AllergenTraceabilityService` | **Strongest candidate — blocked on data source** | Genuinely non-duplicative: lot-level CoA-ppm / hidden-carrier checks + recall drill, disjoint from `preferences-match`'s declared-allergen matching. Has real edge-case tests. But no supplier-lot/CoA table exists anywhere in `lib/db`, and its recall gateway has no implementation. Viable project **if** CoA data is captured somewhere today. |
| `AdverseEventWebhookController` | **Needs recipient decision** | Inbound-WhatsApp receiver, not an outbound webhook. Severity triage is keyword substring-matching on free text (not clinically validated). All four delivery gateways (PagerDuty/WhatsApp/KitchenErp/DB) are bare interfaces with zero implementations — wired today, every "page a human"/"lock a batch" action silently no-ops. Had a hardcoded fallback HMAC secret (fixed, this change). |
| `WormAuditLogger` | **Do not adopt as-is** | Real HMAC hash-chaining, but "WORM" is delegated to a storage gateway nobody implemented; no chain-verification method; had a hardcoded fallback key (fixed, this change). The live `audit_log` table + `lib/audit.ts` is the proven insert-only path — if tamper-evidence becomes a compliance requirement, harden **that** (e.g. add a hash-chain column) rather than adopting this parallel mechanism. |
| `DpdpaPrivacyConsentService` | **Out of scope — duplicates live code** | The live consent path is `usersTable.dpdpConsentAt`, written from `routes/auth.ts` and `routes/checkout.ts`. This class is a richer but disconnected redesign with its own field names and no persistence. Wiring it creates two sources of truth for DPDPA consent. Granular consent, if legally required, is a schema migration on the live path. |

## The other nine services: scope-inflated bundling — excluded

`CxOperationsSupportService`, `DisasterRecoveryResilienceService`,
`FinancialPaymentsLedgerService`, `LogisticsDispatchResilienceService`,
`ObservabilityMonitoringService`, `PerformanceGameDaySimulationService`,
`SecurityThreatMitigationService`, `UnifiedGoLiveReadinessService`,
`WearableMealScoringEngine`.

The package's own `package.json` scopes it to "Contraindication Engine,
Packing Station Interlock, AE Webhooks, and WORM Audit Logger" — none of
these nine is that. `UnifiedGoLiveReadinessService`'s own 10-domain risk
taxonomy shows the package was assembled as a whole-platform "go-live
certification" bundle. Several return **hardcoded numbers dressed as measured
results** (`rtoAchievedSec = 22`, `overallScore: 99, grade: 'A+ (Production
Certified)'`, checkout conversion `99.92%` + unconditional `GO`) — running
`npm test` here prints "🟢 FINAL EXECUTIVE DECISION: GO FOR COMMERCIAL
LAUNCH" regardless of anything. Treat that banner as theater, never as
evidence. `FinancialPaymentsLedgerService` duplicates the live money path
(CLAUDE.md: the server owns every amount); `LogisticsDispatchResilienceService`
duplicates `lib/dispatch.ts`'s domain. If any capability here is wanted, it
is a separate initiative with its own review — not part of "clinical
governance."

**`WearableMealScoringEngine` is the one actively dangerous file**: its
`translateTelemetry()` hard-overrides nutrition targets from a single CGM
reading with no RD approval — the exact "unattended clinical intervention"
documented as reviewed out of the live `clinicalGuardrailEngine.ts` before
merge, at a different, unreconciled threshold (>160 vs ≥140 mg/dL). It now
carries a ⛔ do-not-wire header and `@deprecated` marker (this change).

## Containment applied in this change

1. `WearableMealScoringEngine.ts` — ⛔ header + `@deprecated`: never import
   outside the package; the sanctioned path is the live advisory engine.
2. `AdverseEventWebhookController.ts` — removed hardcoded fallback webhook
   secret (`'tanmatra_webhook_secret_2026'`); signature verification now
   fails loudly when `META_APP_SECRET` is unset instead of "verifying"
   against a public-in-git value.
3. `WormAuditLogger.ts` — removed hardcoded fallback HMAC key
   (`'tanmatra_evd_65b_secret_key'`); the key must now be supplied explicitly
   or via `WORM_AUDIT_HMAC_KEY` (verify_suite passes a labeled test fixture).
4. This document; `README.md` remediation status updated.

No wiring. The package still has zero dependents, by design of this review.

## Open questions that gate any future wiring (owner decisions)

1. **ContraindicationEngine**: will anyone build the biomarker + dish-micros
   ingestion its input shape needs? Without that there is nothing to
   integrate. If yes: advisory-first launch is strongly recommended given the
   fail-open-on-missing-data behavior.
2. **Packing interlock**: does the business want software able to halt a
   physical packing operation at all? If yes — who overrides a false-positive
   lock, on what authority, how fast? (Also note `POST /ops/wms/route-fulfillment`
   bypasses the KDS board entirely; a KDS-only interlock would not cover it.)
3. **AllergenTraceability**: is supplier CoA-ppm lot data captured anywhere
   today (spreadsheet, portal, paper)? If yes, this is the best candidate in
   the package — first step would be a `supplier_lots` schema + a pure
   `lib/allergenTraceability.ts` in api-server, advisory-only. If no, it is
   aspirational.
4. **Adverse events**: who receives an AE page (on-call RD? clinical safety
   officer?) and over what real channel (PagerDuty, WhatsApp Business,
   email/SMS)? Note the honest starting point for AE handling is the live but
   unguarded `POST /symptom-logs` (`routes/ecosystem.ts:68`) — e.g. a
   severity-threshold advisory alert mirroring `processBiometricAnomaly` —
   not this controller. The keyword triage needs clinical sign-off regardless.
5. **WORM audit**: is tamper-evident logging an actual compliance requirement
   (auditor/DPDPA)? If yes, harden the existing `audit_log` path.
6. **DPDPA granular consent**: an active legal requirement? If yes, schema
   migration on `usersTable`, not adoption of the disconnected class.
