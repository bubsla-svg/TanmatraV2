# Clinical Scope

> P0 §24 deliverable. Baseline SHA `3aea38dc` (`main`, 2026-08-06).

This document defines what "clinical" means in this codebase on this SHA:
which surfaces make clinical claims, which code actually enforces safety, and
where the two disagree.

## 1. Two contraindication implementations — one live, one orphaned

### 1.1 The live path

`artifacts/api-server/src/lib/clinicalGuardrailEngine.ts` — consumed by
`routes/wearable.ts`, covered by `lib/guardrailEngines.test.ts`. Detects
glycemic anomalies (≥140 mg/dL postprandial) in wearable readings, alerts the
assigned dietitian, and surfaces **advisory** ingredient cautions to the
storefront. Its header records a genuine safety review: an earlier draft
auto-cut `calorieTarget` by 150 kcal per event down to a 1,500 kcal floor and
rewrote fiber targets, from a single self-reported, non-device-attested
reading, with no dietitian approval and no hysteresis. That was pulled before
merge — target changes stay the RD's call.

Allergen enforcement is `lib/preferences-match`, consumed by
`checkoutSafety.ts` (api-server) and by the storefront directly — one shared
library, imported on both sides, not duplicated.

### 1.2 The orphaned path

`artifacts/clinical-governance-engine` — package name
`@tanmatra/clinical-governance-engine`, version `1.0.0-PROD`, described in
its own `package.json` as *"Zero-dependency Deterministic Contraindication
Engine, Packing Station Interlock, AE Webhooks, and WORM Audit Logger for
Tanmatra therapeutic nutrition."* 5,143 lines across 20 source files:

```
ContraindicationEngine.ts          AllergenTraceabilityService.ts
PackingStationInterlockService.ts  AdverseEventWebhookController.ts
WormAuditLogger.ts                 DpdpaPrivacyConsentService.ts
LogisticsDispatchResilienceService.ts
FinancialPaymentsLedgerService.ts
SecurityThreatMitigationService.ts
DisasterRecoveryResilienceService.ts
WearableMealScoringEngine.ts
UnifiedGoLiveReadinessService.ts
PerformanceGameDaySimulationService.ts
CxOperationsSupportService.ts
ObservabilityMonitoringService.ts
```

**No `package.json` in the monorepo lists it as a dependency. No file
outside its own `src/` imports from it.** It has its own test runner
(`npx ts-node src/verify_suite.ts`) and presumably passes it — that was not
re-verified here, since the finding that matters is reachability, not
correctness of unreachable code. `docs/ARCHITECTURE_COHERENCE.md` correctly
labels it "Internal" and makes no wiring claim, so this is not a doc drift —
it is a built subsystem that was never connected.

**Named in its own filenames but not implemented anywhere reachable:**
- Packing-station interlock (should this block a kitchen from packing a
  dish against an active allergen flag? Unknown — not reachable from any
  fulfillment route.)
- AE (adverse-event) webhooks (should this notify anyone on a reported
  reaction? Unknown — not reachable from any support/ops route.)
- WORM audit logging for clinical mutations (should every clinical field
  change be immutably logged? Unknown — the live `crypto.ts` encryption path
  does not call into this logger.)

For a "clinical-grade meal-delivery and wellness platform" (per the root
`CLAUDE.md`), an unconnected packing-station interlock and AE webhook
controller is the highest-severity finding in this deliverable set: the
*name* of the safety mechanism exists in the repo, which is exactly the
condition under which someone reasonably — and wrongly — assumes it runs.

## 2. What clinical data crosses the money-path/analytics boundary

See [`privacy-analytics-contract.md`](./privacy-analytics-contract.md) for
the full analysis. Summary: the allowlist that should strip clinical fields
from analytics events exists only inside a test file
(`lib/domainInvariants.test.ts`) and is not imported by any production
analytics call site.

## 3. PHI encryption at rest — holds

`artifacts/api-server/src/lib/crypto.ts` implements
`encryptClinicalAttribute` / `encryptClinicalStrings`, gated on
`CLINICAL_KMS_MASTER_KEY` (aliases: `MASTER_KEY`, `DPDPA_MASTER_KEY_HEX`,
`CLINICAL_MASTER_KEY_HEX`; 64 hex chars, AES-256-GCM). Boot validation in
`lib/validateEnv.ts` fails the server start in production if absent. Applied
to array-valued free-text clinical columns (allergens, disliked ingredients)
with a documented rollout invariant: `encryptPreferencesPatch` only encrypts
not-yet-encrypted elements, so a column mid-rollout can hold a mix without
double-encrypting. This is the one clinical-boundary claim in the root
`CLAUDE.md` that checks out completely on this SHA.

## 4. Storefront clinical surfaces

Family classification (see [`routes.json`](./routes.json)) counts 10
storefront routes as `clinical`: `/clinical`, `/care/[condition]`,
`/metabolic`, `/coach`, `/performance`, `/premium`, `/account/symptoms`,
`/account/wellness`, `/account/appointments`, `/account/connections`. All 10
resolve to a real `page.tsx`. None of them render chrome from the orphaned
`clinical-governance-engine` package — they call the api-server's ordinary
REST surface through hand-written clients in `lib/`, same as every other
storefront route.

## 5. Scope statement for this SHA

**"Clinical" claims that are true today:** PHI encryption at rest,
allergen matching via `preferences-match`, advisory (non-mutating) glycemic
alerting to a human dietitian.

**"Clinical" claims that are not true today, despite named code existing:**
deterministic contraindication engine enforcement, packing-station interlock,
adverse-event webhook delivery, WORM audit logging of clinical mutations,
production-side analytics stripping of clinical fields.
