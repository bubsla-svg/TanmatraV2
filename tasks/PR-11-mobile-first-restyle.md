# PR-11 · Mobile-first restyle (delivered-revision wardrobe) — a PR series, not one PR

**Blast radius: Medium per PR, Max in aggregate.** Presentation only. Zero product-shape diffs. Brief: `docs/MOBILE-FIRST-CX-BRIEF.md` (v3.1, validated against `156fea9`).

## Objective
Replicate the delivered storefront revision's visual system across every customer-facing route of `artifacts/storefront`, 393px first, without changing any route, step, question, action, data field, API call or business rule.

## Context
- Read the brief's **v3.1 repo-alignment note** and its ten-laws table first: every authority is repo-resident (`docs/ASTRYX-ADOPTION-RUNBOOK.md`, `tasks/PR-03-tokens-and-a11y.md`, `.github/workflows/storefront.yml`, `lib/subscription-rules/src/*`, `lib/planDecisionFacts.ts`). The delivered revision is exported at `docs/design-reference/storefront-revision-2026-09/` — its `README.md` carries the token table, the contrast audit (green primary passes; amber accent fails at 53 % and is decorative-only unless darkened to ≤ 37 %), and the reference traits the brief overrides (40 px targets, three fonts, `/cart` route, no macros, mock copy).
- Live checkout ≠ `CheckoutFlow`. See brief CUJ 5 §1: a-la-carte is `AlacarteCheckout` → `AlacarteDetails`; plan is `PlanCheckout`. `CheckoutFlow`/`StepDots` is the flag-off fallback.
- `artifacts/storefront/quarantine/**` is out of bounds.
- Colour gates are `lint:tokens`, `lint:css-vars`, `lint:dark-forks`, `lint:unregistered-color-utility`, `lint:component-drift` — not `lint:colors`/`lint:prices`.

## Steps (one PR each, in this order)
1. **11a Tokens** — brief "Foundations 0", values from the design-reference README. Contrast gate ≥ 4.5:1 (fix the two failing pairs as the README states). Re-baseline `layout-vrt` in its own commit.
2. **11b Primitives** — `Rail`, `Disclosure`, `QuantityStepper`, `StickyAction`; migrate call sites in the same PR; flipbook proves zero state loss.
3. **11c CUJ 1+2** — home, menu, dish sheet/PDP, cart drawer.
4. **11d CUJ 5** — `AlacarteDetails`, `PlanDetails`, pay bars, `UnresolvedPaymentPanel`, confirmation. `git diff --stat` must be empty under `lib/moneyPath*`, `lib/verifyRetry*`, `lib/razorpayAdapter*`, `lib/api.ts`, `lib/cartStore.ts`, `lib/checkout.ts`, `app/**/route.ts`, `middleware.ts`.
5. **11e CUJ 3+6**, **11f CUJ 4**, **11g onboarding + account**, **11h remainder**, **11i analytics** (guard test in same PR).

## Gates
Brief "Quality gates" + "Final definition of done". No e2e locator edits. `pnpm-lock.yaml` untouched. `python3 .kg/kg.py code docs/MOBILE-FIRST-CX-BRIEF.md` resolves every path before each PR.

## Do not combine with
`PLAN_CHECKOUT_DISABLED` lift; idempotency key / `paidFactsRef` persistence (`AlacarteCheckout.tsx`, `plan/PlanCheckout.tsx`); `/recipes/[slug]` (`app/(global)/recipes/page.tsx:23`); plan-change billing (`docs/audit/P0-2-PLAN-CHANGE-CONTRACT-TRACE.md`); any behaviour change.

## Session opener (paste into Claude Code, one per sub-PR)

```
git fetch origin && git checkout docs/mobile-first-cx-brief-v3.1 && git checkout -b restyle/11a-tokens
python3 .kg/kg_extract.py . .kg/graph.json

Read, in order: CLAUDE.md §"Storefront internals"; docs/MOBILE-FIRST-CX-BRIEF.md (the v3.1
alignment note and the ten-laws table first, then "Non-negotiable scope rules", then the
section for this sub-PR); docs/design-reference/storefront-revision-2026-09/README.md;
tasks/PR-11-mobile-first-restyle.md.

This is PR-11a (tokens) of a presentation-only series. Product shape is frozen: no route,
step, question, action, data field, API call or business rule changes. Do not touch
artifacts/storefront/quarantine/**, artifacts/tanmatra, artifacts/api-server, lib/moneyPath*,
lib/verifyRetry*, lib/razorpayAdapter*, lib/api.ts, lib/cartStore.ts, lib/checkout.ts,
app/**/route.ts, middleware.ts, pnpm-lock.yaml.

Before editing:
1. python3 .kg/kg.py code docs/MOBILE-FIRST-CX-BRIEF.md — every path must resolve; report drift.
2. pnpm --filter @workspace/storefront run dev, then capture the 393px "before" flipbook for
   /, /menu, /dish/[slug], /plans, the cart drawer, /checkout?mode=alacarte, /start using the
   e2e/specs/stitch-runtime/*-flipbook.spec.ts pattern.
3. python3 .kg/kg.py blast artifacts/storefront/lib/themes/tanmatra.css --depth 2.
4. Restate the plan as a checklist with the exact files you will touch and wait for my go.

Definition of done for this sub-PR: brief "Quality gates"; the README's two failing
contrast pairs fixed as stated; lint:tokens, lint:css-vars, lint:dark-forks,
lint:unregistered-color-utility, lint:component-drift, typecheck, storefront test (968) and
the mobile e2e project green with no locator edits; layout-vrt re-baselined in its own
commit; "after" flipbook attached; git diff --stat shows nothing outside the allowed paths.
```

For 11b onward, swap the branch name and the sub-PR reference; keep the "restate and wait" step for 11d (checkout surfaces) and drop it for the rest.
