# PR-11 · Mobile-first restyle (delivered-revision wardrobe) — a PR series, not one PR

**Blast radius: Medium per PR, Max in aggregate.** Presentation only. Zero product-shape diffs. Brief: `docs/MOBILE-FIRST-CX-BRIEF.md` (v3.1, validated against `156fea9`).

## Objective
Replicate the delivered storefront revision's visual system across every customer-facing route of `artifacts/storefront`, 393px first, without changing any route, step, question, action, data field, API call or business rule.

## Context
- Read the brief's **v3.1 repo-alignment note** and its ten-laws table first: every authority is repo-resident (`docs/ASTRYX-ADOPTION-RUNBOOK.md`, `tasks/PR-03-tokens-and-a11y.md`, `.github/workflows/storefront.yml`, `lib/subscription-rules/src/*`, `lib/planDecisionFacts.ts`). The only external input is the delivered revision; PR-11a starts by exporting it into `docs/design-reference/storefront-revision-2026-09/`.
- Live checkout ≠ `CheckoutFlow`. See brief CUJ 5 §1: a-la-carte is `AlacarteCheckout` → `AlacarteDetails`; plan is `PlanCheckout`. `CheckoutFlow`/`StepDots` is the flag-off fallback.
- `artifacts/storefront/quarantine/**` is out of bounds.
- Colour gates are `lint:tokens`, `lint:css-vars`, `lint:dark-forks`, `lint:unregistered-color-utility`, `lint:component-drift` — not `lint:colors`/`lint:prices`.

## Steps (one PR each, in this order)
1. **11a Tokens** — brief "Foundations 0". Contrast gate ≥ 4.5:1. Re-baseline `layout-vrt` in its own commit.
2. **11b Primitives** — `Rail`, `Disclosure`, `QuantityStepper`, `StickyAction`; migrate call sites in the same PR; flipbook proves zero state loss.
3. **11c CUJ 1+2** — home, menu, dish sheet/PDP, cart drawer.
4. **11d CUJ 5** — `AlacarteDetails`, `PlanDetails`, pay bars, `UnresolvedPaymentPanel`, confirmation. `git diff --stat` must be empty under `lib/moneyPath*`, `lib/verifyRetry*`, `lib/razorpayAdapter*`, `lib/api.ts`, `lib/cartStore.ts`, `lib/checkout.ts`, `app/**/route.ts`, `middleware.ts`.
5. **11e CUJ 3+6**, **11f CUJ 4**, **11g onboarding + account**, **11h remainder**, **11i analytics** (guard test in same PR).

## Gates
Brief "Quality gates" + "Final definition of done". No e2e locator edits. `pnpm-lock.yaml` untouched. `python3 .kg/kg.py code docs/MOBILE-FIRST-CX-BRIEF.md` resolves every path before each PR.

## Do not combine with
`PLAN_CHECKOUT_DISABLED` lift; idempotency key / `paidFactsRef` persistence (`AlacarteCheckout.tsx`, `plan/PlanCheckout.tsx`); `/recipes/[slug]` (`app/(global)/recipes/page.tsx:23`); plan-change billing (`docs/audit/P0-2-PLAN-CHANGE-CONTRACT-TRACE.md`); any behaviour change.
