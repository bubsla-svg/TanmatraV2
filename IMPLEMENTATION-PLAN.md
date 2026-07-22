# Tanmatra 02-series — implementation roadmap

**Date:** 2026-07-22 · **Branch:** `claude/plan-analysis-dependencies-kbj87v` · **Basis:** `PLAN-CROSSCHECK.md` (verified repo reality) + the three product decisions taken 2026-07-22.

## Decisions in force
1. **Replace the live model** — the corpus's 4-plan architecture (desk_fuel/steady/glp1/protein_build + teams, ₹199–249/meal, ₹399 full-creditback trial, 3-screen no-coupon checkout, goal router) supersedes the shipped model (8 RD plans, ₹750/meal cadence, ₹1,499 trial, voucher/slot checkout).
2. **Proceed against existing tokens** — build against the repo's current design tokens and shipped patterns as the substitute for the absent IMPECCABLE.md / Amendment 02 / 02a, and **flag every inferred value** (chip glyphs, copy, final prices) for later reconciliation.
3. **Apply Stage-A now** — as its own money-path PR, after the Ragi Brownie kitchen status is confirmed; CSV byte-exact, with a tamper test and a rollback plan.

## Ground truth (from the cross-check — do not re-derive)
- **Already shipped, reuse:** server price authority (`paymentIntegrity.ts`, `payments.ts`), Razorpay + webhook verify + idempotency, the subscription route surface (quote/create/pause/skip/swap/convert + mandates), macro/allergen verification markers, the `rdReviewState` gate, FSSAI marks, the checkout stepper shell, the PIN serviceability gate.
- **Field translation for pools:** `gi → glycaemicIndex`, `kcal → macros.calories`, corpus-`signed → reviewed`; two macro truths (raw seed vs the DISHES estimated overlay) — pools run against DISHES.
- **Data gaps that gate launches:** veg lean-high-protein pool = 0; high-protein snacks ≈ 0; veg/egg low-GI too small → Steady & GLP-1 veg/egg tracks cannot launch from current SKUs (config narrows them off honestly).
- **Missing inputs still needed from Chandan:** IMPECCABLE.md, Amendment 02/02a (copy system + 12-glyph chip set), the final `catalog-repricing.csv`, the rescue plan, the benchmark framework, HFEP.
- **Hard stop:** Ragi Brownie veg/allergen provenance (blocks Stage-A).

## Sequencing principle
One concern per commit; money-path slices land behind a feature flag first, are verified, then the legacy path is removed. Never delete a working money-path surface before its replacement is green. Each slice ships with tests; CI must run typecheck + the money-path suite before any legacy removal (see S0).

---

## Phase A — foundations (no behavior change; unblock everything)

| # | Slice | Scope | Acceptance | Status |
|---|---|---|---|---|
| **S0** | CI safety net | `.github/workflows/verify.yml`: `typecheck` + `money-unit` (DB-free) + `money-integration` (Postgres, mirrors bulkhead) jobs. | ✅ typecheck + money-unit verified green locally; a PR breaking payment authority now fails CI. | **DONE (this session)** |
| **S1** | Plan-config spine (02e) | Typed `PLAN_CATALOG`, pool predicates (translated fields), launch gates, add-ons, trial-credit math, fixed trios. Pure lib, additive. | ✅ `lib/subscription-rules/planCatalog.ts` + 13 passing tests; `typecheck:libs` green. | **DONE (this session)** |
| **S2** | 02f component primitives | Net-new presentational components against existing tokens: `Chip` (glyph set inferred + flagged), `MacroReadout` (A5 gate), `RdBadge`, `SegmentedControl`, `StepDots`, `Price`, `DishImage`. Reuse `FssaiMark` (=DietMark) and `Sheet`. | ✅ `artifacts/tanmatra/src/components/primitives/` + 6 passing logic tests; tanmatra typecheck + lint:colors/prices green. | **DONE (this session)** |
| **S3** | Missing-input intake | Land IMPECCABLE.md, Amendment 02/02a, final `catalog-repricing.csv` when provided; reconcile every value flagged `INFERRED` in S1/S2. | Flagged inferences resolved or ticketed. | BLOCKED on Chandan |

## Phase B — commercial model (behind `FLAG_PLAN_V2`)

| # | Slice | Scope | Depends |
|---|---|---|---|
| **S4** | Plan quote/create on the new spine | ✅ **DONE (pricing/gates/routes).** `FLAG_PLAN_V2` (`api-server/src/lib/flags.ts`); `computePlanQuote` + launch gates in the spine; `POST /subscriptions/quote` + create take an optional `planId`/`track` and, when the flag is on, price by `PLAN_CATALOG` and refuse blocked/sales-led plans + unserved tracks with a typed `waitlist` 422. Flag-off = byte-identical to today. 21 spine + flag tests; full `typecheck` green. **Follow-up:** DB-backed route integration tests + client sending `planId` (needs a DB / later slice). | S0, S1 |
| **S5** | ₹399 trial + creditback | ✅ **Foundation done.** ₹399 trial pricing lands via S4. Added: the durable `trial_redemptions` table (salted-phone-hash, unique, survives account deletion) + migration `0009`; `trial_creditback` credit reason; pure `trialCreditExpiry`/`trialCreditGrant` (spine) and `normalizeE164`/`hashTrialPhone` (api-server), all tested. No-auto-convert already holds (S4 `generateCount=1` + trial scheduler). **S5b (needs a DB to test safely):** call `issueCredit(trial_creditback)` + write the eligibility row at the trial-**paid** confirmation point (not create — a failed payment must not burn the allowance), and auto-apply the lot via the existing `applyCreditsPaise` path on plan start. | S4 |
| **S6** | RD bump + evening add | ✅ **Foundation done.** Pure `resolveAddOns`/`attachableAddOns` (validate against each plan's allow-list, deduped, priced from `ADD_ONS`) + tests; new `subscription_addons` table (price/cadence snapshotted at attach, soft-detach, cascade) + migration `0010`; the plan-v2 **quote** now accepts `addOns` and bills plan-review add-ons (rd_bump) into the total, surfacing post-purchase ones (evening_add) as available but unbilled, and 422s a not-allowed add-on. **rd_bump-vs-₹999-premium reconciliation:** defaulted to keeping them distinct, flagged in code + PLAN-CROSSCHECK §3.2 H3 for Chandan. **S6b (needs a DB):** attach/detach routes writing `subscription_addons`; include active add-ons in the recurring charge; evening_add one-tap post-purchase that never blocks confirmation. | S4 |
| **S7** | PlanCard / OrderBump / plan surfaces (02f §2) | ✅ **Components done.** `artifacts/tanmatra/src/components/plans/`: `PlanCard` (matched=full/saffron/chips/RD-badge vs alt=condensed/outlined — the 2× recognition mechanic), `OrderBump` (raised card, no decline button, accepted→collapsed+Remove, clinic rate adjacent not struck), `TrialCard` (outlined, never saffron, verbatim credit line), assembled from the S2 primitives with server-quoted prices (no `<Card>` base). `planDisplay` map supplies names + inferred promises/chips (flagged; clinical flag derived from `requiresRdSignoff`). tanmatra typecheck + lint:colors/prices green; 4 display tests. **Follow-up (S8):** wire into the plan page + builder (3 SegmentedControls, 02e §5 defaults) + goal router, fetching the S4 quote. | S2, S4, S5, S6 |
| **S8** | Goal router + CUJ v2 (02d) | "What's lunch for?" router (5 answers → plans/menu), configure-by-exception builder, `cuj_*` funnel events reconciled to the existing analytics dictionary; zero-dead-end waitlist for blocked tracks (Steady/GLP-1 veg/egg). | S7 |
| **S9** | 3-screen checkout (02c) | Identity/Address/Pay; **remove** the coupon/voucher field and slot picker from the consumer flow (keep the corporate-voucher backend for B2B); keep server-quoted totals. | S4, S8 |
| **S10** | Cut over + remove legacy | Flip `FLAG_PLAN_V2` on; delete the 8 RD plans (`rdPlans.ts`), cadence pricing special-cases, and the ₹1,499 trial. | S4–S9 green in staging |

## Phase C — pricing & proof

| # | Slice | Scope | Depends |
|---|---|---|---|
| **S11** | Stage-A repricing | Confirm Ragi Brownie status (contain if unresolved, per brief A4); write `PRICE-FLOW.md`; apply `stageA_paise` byte-exact to the catalog **and** DB atomically; tamper test + rollback + 30-min watch. | Ragi confirmation |
| **S12** | Final prices + dual-channel | Apply the final `catalog-repricing.csv` and the "₹X here · ₹Y on delivery apps" line. | S3 (final CSV), S11 |
| **S13** | Benchmark + budgets | Stand up CLS/perf infra; wire the `cuj_*` funnel to the benchmark scoreboard; enforce 02c/02d tap/field budgets in Playwright. | S8, S9, benchmark doc |

---

## What this session delivered
- **Phase 0 (docs):** `docs/spec/` corpus home + `PLAN-CROSSCHECK.md`.
- **S0:** the CI money-path safety net (`.github/workflows/verify.yml`).
- **S1:** the plan-config spine (`lib/subscription-rules/planCatalog.ts`) — 13 tests.
- **S2:** the 02f component primitives (`artifacts/tanmatra/src/components/primitives/`) — 6 logic tests.
- **This roadmap.**

## Immediate next (in order)
1. **Chandan:** Ragi Brownie status (unblocks S11) + the missing spec inputs — IMPECCABLE.md, Amendment 02/02a, final `catalog-repricing.csv` (unblocks S3, and un-infers S2's glyph set / S5 / S12).
2. **S5b + S6b + a DB** — the DB-write halves deferred for want of a Postgres-capable environment: trial credit grant/eligibility record at trial-paid + redemption on plan start (S5b); subscription add-on attach/detach + recurring-charge inclusion (S6b). Add DB-backed integration tests to the `money-integration` CI job.
3. **S7** — assemble `PlanCard`/`OrderBump` and the plan surfaces from the S2 primitives (consumes the S4 quote + S6 add-ons).
