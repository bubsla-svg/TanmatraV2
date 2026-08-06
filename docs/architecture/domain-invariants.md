# Domain Invariants

> P0 §24 deliverable. Baseline SHA `3aea38dc` (`main`, 2026-08-06).
> Machine-readable companion: [`domain-invariants.json`](./domain-invariants.json).

**Contract status: FAIL.** `docs/stitch/phase-13a-final-acceptance.md` §3
marks all 20 non-negotiable domain invariants "✅ Automated." Re-run against
this SHA, that claim does not hold uniformly.

## 1. Method

Each of the 20 invariants was checked two ways: does the enforcement
mechanism named in Phase 13A exist as a real file, and does an *executable
test import and exercise the shipped implementation* (not a test-local
restatement of the rule). `pnpm --filter @workspace/storefront run test`
passes 531/531 on this SHA — that number is real, but it measures "the test
suite is internally consistent," not "the product enforces these 20 rules."

## 2. Result

| Grade | Count | Meaning |
|---|---:|---|
| **automated** | 9 | A test imports and exercises the shipped code path |
| **self-contained** | 5 | The test re-declares the rule's logic inline; the shipped code, if any, is never imported |
| **implemented-untested** | 3 | The behaviour exists in source; no test covers it |
| **not-locatable** | 3 | The named enforcement mechanism ("Entitlement Service", "Checkout Service", "Subscription Service") does not resolve to a path in this repo |

Full per-invariant detail, evidence, and file references are in
[`domain-invariants.json`](./domain-invariants.json).

## 3. The `domainInvariants.test.ts` pattern

Five of the twenty (14, 16, 18, 19*, 20) are claimed against
`domainInvariants.test.ts`. Four of those five declare their fixtures and
logic *inside the test file itself* — `SubscriptionAction` interfaces,
`ANALYTICS_KEY_ALLOWLIST`, rationale objects, an inventory predicate — and
import nothing from the shipped app to exercise. A test built this way
cannot fail from a production regression, because production is never in its
call stack. This is not a coverage gap in the ordinary sense (missing test);
it's a test that looks like coverage but isn't.

*Invariant 19 (Zero Config at Checkout) is the one exception in this cluster
— it happens to be *independently and genuinely* covered by
`lib/checkout.test.ts`, which does import the real checkout step model. The
`domainInvariants.test.ts` copy of the same claim is redundant, not wrong.

The clearest single example is invariant 16 (Health Data Privacy) — detailed
separately in [`privacy-analytics-contract.md`](./privacy-analytics-contract.md)
because it's the one with a live production consequence: the allowlist
exists only in the test, and the app's one real analytics call site
(`PostHogProvider.tsx`) does not use it.

## 4. What genuinely holds

Nine invariants are real: 1 (allergen survival, `preferences-match`), 5 and
15 (authoritative checkout / client-authoring ban — both covered by
`moneyPath.alacarte.test.ts`, `planCheckout.test.ts`, and reinforced by the
tree-wide `pricingInvariants.test.ts` scan), and 19 (zero-config checkout, via
`checkout.test.ts`'s genuine coverage). These are the invariants closest to
the money path, which tracks — that boundary has the most scrutiny in the
codebase generally (see [`domain-boundaries.md`](./domain-boundaries.md) §1).

## 5. What needs to happen to close this gap

For each `self-contained` and `implemented-untested` invariant:

1. Locate (or write) the shipped function/component the invariant actually
   describes.
2. Rewrite the test to import and exercise it — not to restate the rule.
3. For the three `not-locatable` invariants (7, 9, 12), either name the real
   file that enforces them or acknowledge the enforcement doesn't exist yet
   and file it as a gap, rather than leaving a service name that never
   resolves.

This is materially more work than the current single-file test suggests, and
should be sized as its own follow-up rather than folded into this
verification pass.
