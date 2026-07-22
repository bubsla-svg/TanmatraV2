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
| **S0** | CI safety net | Add a CI job running `pnpm run typecheck` + the api-server test suite (Postgres service or a DB-less split) before any money-path change. | A PR that breaks payment-amount authority fails CI. | **TODO — do first** |
| **S1** | Plan-config spine (02e) | Typed `PLAN_CATALOG`, pool predicates (translated fields), launch gates, add-ons, trial-credit math, fixed trios. Pure lib, additive. | ✅ `lib/subscription-rules/planCatalog.ts` + 13 passing tests; `typecheck:libs` green. | **DONE (this session)** |
| **S2** | 02f component primitives | Net-new presentational components against existing tokens: `Chip` (glyph set inferred + flagged), `MacroReadout` (reuse `macrosEstimated`/provisional gating), `RdBadge`, `SegmentedControl`, `StepDots`, and formalize `Price`/`DishImage` as components. Reuse existing `FssaiMark` (=DietMark) and `Sheet`. | Storybook/styleguide entries render; a11y (focus/roles) per repo patterns; no raw hex (lint:colors green). | TODO |
| **S3** | Missing-input intake | Land IMPECCABLE.md, Amendment 02/02a, final `catalog-repricing.csv` when provided; reconcile every value flagged `INFERRED` in S1/S2. | Flagged inferences resolved or ticketed. | BLOCKED on Chandan |

## Phase B — commercial model (behind `FLAG_PLAN_V2`)

| # | Slice | Scope | Depends |
|---|---|---|---|
| **S4** | Plan quote/create on the new spine | Re-point `POST /subscriptions/quote` + create to `PLAN_CATALOG` (per-plan/per-meal pricing, mealsPerCycle), gated by flag. Keep cadence model live until S9. | S0, S1 |
| **S5** | ₹399 trial + creditback | Trial priced at `flatPricePaise` 39900; grant a 39900-paise, 7-day `credit_ledger` lot on paid trial (new reason); redeem in `/convert` and first-charge (`applyTrialCreditPaise`); server-enforced **one-per-phone-ever** (durable hashed-phone record surviving account deletion); no auto-convert. | S4 |
| **S6** | RD bump + evening add | `rd_bump` (+₹499/mo) at plan review — reconcile with the existing ₹999/mo premium membership's RD-consult overlap; `evening_add` (+₹599/wk) post-purchase, one-tap, never blocks confirmation. | S4 |
| **S7** | PlanCard / OrderBump / plan surfaces (02f §2) | Build `PlanCard` (matched 2× weight), `OrderBump`, plan page, builder (segmented controls, defaults per 02e §5), trial card. | S2, S4, S5, S6 |
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
- **S1:** the plan-config spine (`lib/subscription-rules/planCatalog.ts`) with 13 passing tests and clean `typecheck:libs`.
- **This roadmap.**

## Immediate next (in order)
1. **S0** — the CI safety net (cheap, unblocks safe money-path work).
2. **Chandan:** Ragi Brownie status (unblocks S11) + the missing spec inputs (unblocks S3, and un-infers S2/S5/S12).
3. **S2** — the component primitives (no money risk, needed by every screen).
