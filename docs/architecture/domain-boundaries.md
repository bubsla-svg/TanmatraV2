# Domain Boundaries

> P0 §24 deliverable. Baseline SHA `3aea38dc` (`main`, 2026-08-06).

This document traces where each business domain's logic actually lives, and
flags every place a boundary is crossed, duplicated, or — in one case —
built and then never connected.

## 1. Money / pricing

**Single spine:** `lib/subscription-rules` (pure, DB-free). Both
`artifacts/api-server` and `artifacts/storefront` import it directly — this
is the one shared-library pattern the codebase gets right end-to-end.
`lib/subscription-rules/src/pricing.ts` holds cadence discount and the 24 h
skip/swap cutoff so API and UI cannot independently drift.

Boundary discipline is enforced by `artifacts/storefront/lib/pricingInvariants.test.ts`,
which scans the *whole tree* for rupee literals the spine cannot produce, and
carries a shrink-only DEBT register (4 pinned violations today — see
[`domain-invariants.json`](./domain-invariants.json) invariant 15 for detail).
That the register can only shrink, never grow, is itself a boundary contract:
a fifth violation fails the build; fixing one of the four existing ones and
forgetting to de-register it *also* fails the build.

**Crossing:** `components/landing/Section03B2BEnterprise.tsx` and
`components/landing/SubsidyCalculator.tsx` both compute or display prices
that don't reconcile with the spine (₹180/meal advertised vs. no spine amount
formats to that; a 3.77× pricing cliff at the 10-seat boundary in the
calculator). Both are pinned debt, not live defects that slipped past the
gate — but they are money-domain code living outside the money-domain
boundary, which is exactly the shape of defect the boundary exists to catch.

## 2. Clinical / contraindication

**Two implementations exist. Only one is connected.**

`artifacts/api-server/src/lib/clinicalGuardrailEngine.ts` is the live path:
detects glycemic anomalies from wearable readings, alerts the assigned
dietitian, surfaces advisory ingredient cautions. Its own header documents a
deliberate boundary decision — an earlier draft auto-cut `calorieTarget` and
rewrote fiber targets from a single self-reported, non-device-attested
reading; that was reviewed out because target changes are the RD's call, not
an algorithm's. It is consumed by `routes/wearable.ts` and covered by
`lib/guardrailEngines.test.ts`.

`artifacts/clinical-governance-engine` (`@tanmatra/clinical-governance-engine`)
is a separate, fully-built package: `ContraindicationEngine.ts`,
`AllergenTraceabilityService.ts`, `PackingStationInterlockService.ts`,
`AdverseEventWebhookController.ts`, `WormAuditLogger.ts`, and six more
services. **No other package.json in the monorepo lists it as a dependency,
and no file outside its own `src/` imports it.** It builds, and per
`package.json` its version is tagged `1.0.0-PROD`, but it is not reachable
from any route the API actually serves. See
[`clinical-scope.md`](./clinical-scope.md) for the full detail — this is the
single largest finding in this deliverable set.

**Boundary that does hold:** allergen matching goes through one library,
`lib/preferences-match`, imported by both `checkoutSafety.ts` and
`mealPlanner.ts` on the API side and by the storefront. PHI/clinical free-text
fields (allergens, disliked ingredients) are encrypted at rest via
`encryptClinicalAttribute` / `encryptClinicalStrings` in
`artifacts/api-server/src/lib/crypto.ts`, gated on `CLINICAL_KMS_MASTER_KEY`
being present at boot (server refuses to start without it in production).

## 3. Identity / auth

**Owner:** api-server session cookie (`authMiddleware`), with an admin token
shim (`adminSessionShim`) for admin routes. The storefront never redirects to
a login *page* for a gated fetch — it tries the call and renders
`<PhoneAuth onVerified={reload}/>` inline on a 401 (the "islands" pattern).
Admin-gated islands additionally branch on membership role.

**Boundary gap:** the `/login` route's own contract (`?next=`) is a return
destination, not an auth *step* — P0's canonical
`?step=phone|otp|account-conflict` has no route representation, so the
`account-conflict` state is unaddressable by URL. Tracked in
[`route-contract.md`](./route-contract.md) §3.2.

## 4. Analytics / privacy

**No production boundary exists.** The allowlist that is supposed to keep
clinical data out of analytics payloads
(`lib/domainInvariants.test.ts:184`, `ANALYTICS_KEY_ALLOWLIST`) is declared
*inside the test file* and imported by nothing else. Full detail in
[`privacy-analytics-contract.md`](./privacy-analytics-contract.md).

## 5. B2B / corporate

**Owner:** `routes/corporate.ts`, `routes/corporateLeads.ts`,
`routes/b2bPlanner.ts` on the API side; 11 storefront routes
(`/corporate*`, `/corporate-wellness`, `/group`, `/office-lunch`,
`/partners/*`, `/rd-partners`, `/team`) on the client side.

**Boundary gap:** the chrome layer's own B2B matcher
(`components/B2BLayout.tsx#isB2BRoute`) disagrees with which routes are
"B2B" compared to any domain taxonomy — it matches 10 of the 11 by prefix
(missing `/team`, over-matching `/corporate-wellness` by a boundary bug) —
and having matched them, un-renders their chrome without providing a
replacement. See [`layout-contracts.md`](./layout-contracts.md) §5.1–5.2.

## 6. Content / AI agents

**Owner:** `artifacts/api-server/src/lib/ai/` — gateway, registry, and five
agents (support, ops, reorder, CMS, coach), each defined with
`definePrompt`/`defineTool`. Each agent ships its own `.evals.ts` file
(`coach.evals.ts`, `ops.evals.ts`, `reorder.evals.ts`, `support.evals.ts`),
run via `pnpm run evals` — this boundary is clean: agent logic, its tools,
and its evaluation live together and nowhere else references agent internals
directly.

## 7. Summary table

| Domain | Single owner? | Boundary holds? |
|---|---|---|
| Pricing | Yes — `lib/subscription-rules` | Mostly; 4 pinned landing-page violations |
| Clinical/contraindication | **No — two engines, one orphaned** | **No** |
| Identity/auth | Yes — api-server session | Mostly; step contract incomplete |
| Analytics privacy | **No production owner at all** | **No** |
| B2B | Yes, but shell disagrees with domain | No (chrome layer) |
| AI agents | Yes — `lib/ai/` | Yes |
