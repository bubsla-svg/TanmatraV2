# DEFECT-VERIFY-MONEYPATH-DEADLIST-001 — the money-path integration list stops executing at its first comment

**Found:** 2026-08-15, during TNM-MENU-01 M-1 (the push-menu fence session), while wiring the
§7.2 replay test into `verify.yml` per manual §7.9 ("new tests join the named lists").
**Status:** OPEN — reported, deliberately not fixed in the M-1 PR (see "Interim mitigation").

## Symptom

`.github/workflows/verify.yml` → job `money-integration` → step **"Money-path integration
tests"** names **100** test files. Only **15** of them execute. The other
**85** have never run from this step, while the step reports green.

## Root cause

The step's `run:` uses YAML **folded** block style (`>`), which joins the command, the file
list and the interleaved explanatory `#` lines into a **single shell line**. Bash treats the
first `#` word it meets as the start of a comment, so everything after it — 85 file
arguments — is commented out. The step "passes" because the surviving prefix passes and the
commented remainder is not an error. (Ironically, several of the in-scalar comments explain
why a test was added to the list "so it actually runs"; the comment itself is what stops it
and everything after it from running.)

The `lint:test-reach` gate does not catch this: it resolves which files workflows *name*,
not which files the resulting shell command *executes*, so a file named after a `#` counts
as reached.

## What executes today (15 files)

- `./src/routes/payments.integrity.test.ts`
- `./src/routes/payments.webhook.test.ts`
- `./src/routes/payments.subscriptionOrder.test.ts`
- `./src/routes/subscriptions.order.test.ts`
- `./src/routes/subscriptions.idempotency.test.ts`
- `./src/routes/refunds.test.ts`
- `./src/routes/orders.mine.test.ts`
- `./src/routes/menu.audit.test.ts`
- `./src/routes/ops.audit.test.ts`
- `./src/routes/adminRoles.test.ts`
- `./src/routes/delivery.opsGate.test.ts`
- `./src/routes/compliance.test.ts`
- `./src/lib/trialRedemption.test.ts`
- `./src/routes/payments.trialCreditback.test.ts`
- `./src/routes/subscriptions.planV2Trial.test.ts`

## What never executes (85 files)

- `./src/routes/subscriptions.dayplan.test.ts`
- `./src/routes/subscriptions.planV2AddOns.test.ts`
- `subscriptions.changePlan.test.ts`
- `./src/routes/subscriptions.cancel.test.ts`
- `./src/routes/subscriptions.skip.test.ts`
- `./src/routes/subscriptions.sprint56.test.ts`
- `./src/routes/subscriptions.creditLedger.test.ts`
- `./src/lib/loyaltyEngine.creditDerivation.test.ts`
- `./src/routes/subscriptions.quoteCreditPreview.test.ts`
- `./src/routes/subscriptions.catalogQuote.test.ts`
- `./src/routes/loyalty.referral.test.ts`
- `./src/routes/loyalty.checkout.test.ts`
- `./src/routes/checkout.premiumGate.test.ts`
- `./src/routes/checkout.quote.test.ts`
- `./src/routes/dishRationales.test.ts`
- `./src/routes/coachAgent.test.ts`
- `./src/routes/rdAdvisory.appointmentOrder.test.ts`
- `./src/routes/vouchers.test.ts`
- `./src/routes/premium.paymentOrder.test.ts`
- `./src/routes/addons.test.ts`
- `./src/lib/ai/agents/ops.refundCap.test.ts`
- `./src/lib/ai/agents/ops.updateOrderStatus.test.ts`
- `./src/routes/marketplace.checkout.test.ts`
- `./src/routes/marketplace.paymentsIntegration.test.ts`
- `./src/routes/marketplace.items.test.ts`
- `./src/routes/corporate.subsidyLedger.test.ts`
- `./src/routes/corporate.teams.test.ts`
- `./src/lib/reconciliationScheduler.test.ts`
- `./src/lib/loyaltyEngine.checkout.test.ts`
- `./src/routes/savedMeals.test.ts`
- `./src/routes/wellness.test.ts`
- `./src/routes/ecosystem.test.ts`
- `./src/lib/bomEngine.test.ts`
- `./src/lib/guardrailEngines.test.ts`
- `./src/lib/logisticsEngine.test.ts`
- `./src/lib/wmsFefoEngine.test.ts`
- `./src/routes/ops.kds.test.ts`
- `./src/routes/ops.paidGate.test.ts`
- `./src/routes/checkout.customizations.test.ts`
- `./src/routes/checkout.doubletap.test.ts`
- `./src/routes/checkout.orderStatus.test.ts`
- `./src/routes/serviceability.test.ts`
- `./src/routes/serviceabilityInterest.test.ts`
- `./src/routes/geo.test.ts`
- `./src/lib/orderChannel.schema.test.ts`
- `./src/lib/wellnessAutoLog.orderKind.test.ts`
- `./src/lib/petpooja.test.ts`
- `./src/lib/menuAssets.bulkHeroes.test.ts`
- `./src/lib/ai/agents/cms.bulkCopy.test.ts`
- `./src/lib/loyaltyEngine.sweep.test.ts`
- `./src/lib/safeSql.schema.test.ts`
- `./src/lib/wbr.channel.test.ts`
- `./src/lib/orderStatus.schema.test.ts`
- `./src/lib/petpooja.moneyInvariant.test.ts`
- `./src/lib/petpooja.transition.test.ts`
- `./src/routes/petpooja.saveorder.test.ts`
- `./src/routes/petpooja.statusMonotonic.test.ts`
- `./src/routes/corporateLeads.test.ts`
- `./src/routes/partnerLeads.test.ts`
- `./src/middlewares/rateLimitMiddleware.webhookExemption.test.ts`
- `./src/middlewares/rateLimitMiddleware.trustProxy.test.ts`
- `./src/lib/b2b/accountHealth.test.ts`
- `./src/lib/ai/aiHardening.test.ts`
- `./src/lib/anomalies.golden.test.ts`
- `./src/lib/menuResolver.cache.test.ts`
- `./src/lib/menuResolver.allergenReview.test.ts`
- `./src/routes/petpooja.cacheInvalidation.test.ts`
- `./src/lib/menuEngineering.sliceCounts.golden.test.ts`
- `./src/lib/menuEngineering.recipeCosts.golden.test.ts`
- `./src/lib/queue.pipelineIdempotency.test.ts`
- `./src/lib/dishReviews.staleness.test.ts`
- `./src/lib/userBrief/cacheSweep.test.ts`
- `./src/routes/legalDocuments.test.ts`
- `./src/routes/petpooja.priceAuthority.test.ts`
- `./src/routes/menuPriceValidation.test.ts`
- `./src/lib/planDraftStateMachine.test.ts`
- `./src/lib/planDraftGenerator.test.ts`
- `./src/lib/planDraftLease.test.ts`
- `./src/routes/planDrafts.test.ts`
- `./src/routes/planDraftLineup.test.ts`
- `./src/routes/planDraftRateLimit.test.ts`
- `./src/routes/planDraftSchedule.test.ts`
- `./src/routes/planDraftQuoteLifecycle.test.ts`
- `./src/routes/deliverySlotOperationalDate.test.ts`
- `./src/routes/planDraftConvert.test.ts`

## Impact highlights

- `petpooja.priceAuthority.test.ts` — the ADM-28 price-fence replay guard — was dead: the
  push-menu price fence had **no enforcing CI test** until M-1 re-homed it (see below).
- All petpooja money invariants (`petpooja.moneyInvariant`, `petpooja.transition`,
  `petpooja.saveorder`, `petpooja.statusMonotonic`, `petpooja.cacheInvalidation`),
  checkout customizations/doubletap/orderStatus, marketplace checkout/payments,
  subscriptions cancel/skip/credit-ledger and the plan-draft lifecycle suites are all in
  the dead set. Any of them may have rotted since they stopped running — the workflow's own
  comments describe exactly this failure mode for `subscriptions.dayplan.test.ts`.

## Interim mitigation (shipped with TNM-MENU-01 M-1)

A separate, properly-formed step — **"Menu fence replay tests (price + curated columns)"**
(`run: |` with backslash continuations, the same shape as the "Petpooja inbound auth
contract" step) — now runs `petpooja.priceAuthority.test.ts` and
`petpooja.menuFence.test.ts` on every build. Nothing else was re-enabled in that PR on
purpose: 85 suites coming back to life at once could surface unrelated rot and would
entangle the fence change with failures it did not cause.

## Recommended repair (its own PR)

1. Restructure the step so comments cannot swallow arguments — e.g. a literal block that
   builds a bash array (comments are legal inside `files=( … )` across lines), then runs
   `node --test --test-force-exit --import tsx "${files[@]}"`. This keeps every comment
   next to the file it explains.
2. Re-enable the dead set **in batches**, expecting rot; fix or explicitly quarantine each
   failure with a dated note (the `subscriptions.changePlan.test.ts` precedent).
3. Teach `scripts/lint-test-reach.ts` to evaluate the post-YAML shell line (strip from the
   first unquoted `#`) so a recurrence fails the build instead of counting as reached.
4. Drop the two fence suites from the big list once it is restructured, or leave the
   dedicated step as the fence's named home — either way, no file should be named twice.
