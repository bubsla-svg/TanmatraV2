# DEFECT-CHANGE-PLAN-PRICING-001 — change-plan reprices from the retired legacy model

| | |
|---|---|
| **Title** | `POST /subscriptions/:id/change-plan` computes the new price with the legacy per-meal helper, not the plan catalog |
| **Severity** | **P1** — it bills a wrong amount, and misclassifies every change as a price increase |
| **Status** | **RESOLVED (2026-08-18)** — pricing now comes from the catalog. One deliberate carve-out and one open data question, both below. |
| **Found** | 2026-08-10, while repairing `subscriptions.changePlan.test.ts` |
| **Blast radius** | Every plan-v2 subscription, i.e. every subscription created since `planId` became required |

---

## RESOLUTION (2026-08-18)

The product decision this document asked for, made and implemented.

**Price comes from the catalog.** `change-plan` now calls
`computePlanQuote(planId, track, cadence)` — the same function `POST
/subscriptions` prices with. One pricing model, one source. This removes the
3.7x divergence at its root.

**Meal count is no longer customer-settable.** Under catalog pricing a plan's
meal count is a property *of the plan* — create already ignores the client's
`mealsPerDelivery` and takes `q.mealsPerCycle`. "Change my meal count" is
therefore not a coherent operation; the coherent equivalent is switching plan.
Sending it is now **refused** (`meals_not_independently_changeable`) rather
than silently ignored, so a client cannot believe it did something.

**Only same-or-cheaper changes are served.** A price *increase* needs the
mandate re-authorised, and that flow was built around the broken quote — so
rather than re-enable machinery whose inputs were wrong, an increase is refused
with `change_plan_price_increase_unsupported`, quoting the catalog figure. A
decrease needs no re-authorisation: the existing mandate is already authorised
for a larger amount. This is the half that cannot overcharge anyone.

**An unexplainable current price is refused, not guessed.** `track` is not
persisted, so `resolveBilledTrack()` identifies it from what the customer is
actually charged. When no catalog price matches — a legacy row, an
add-on-bearing price, a hand-adjusted amount — the row is not repriceable and
says so (`current_price_unexplained`). Refusing costs one unavailable plan
change; guessing costs a wrong bill.

**A second instance of the same bug, also fixed.**
`applyPendingPlanChangeIfReady()` fell back to `computeDeliveryPricePaise`
whenever a pending row carried no explicit price — the same overcharge, at the
moment the cycle rolls. It now prices from the catalog when the plan is
knowable and otherwise keeps the *current* price rather than inventing one.

**Proration:** unchanged and therefore not opened. A change still applies at
the next cycle boundary, never mid-cycle.

### Still open

- [ ] **Price increases are unavailable.** Customers wanting a dearer cadence
      must go through support. Re-enabling self-service requires designing the
      re-authorisation flow against the corrected quote — a separate piece of
      work, not a bug.
- [ ] **Existing rows have not been audited in production.**
      `scripts/src/audit-subscription-pricing.ts` answers it and is READ-ONLY;
      it has only been run against an empty local database here, which proves
      the tooling and nothing about live data. Run it against production:

      ```
      pnpm --filter @workspace/scripts run audit-subscription-pricing
      ```

      A `LEGACY_FORMULA` hit is the defect's fingerprint and means a real
      customer was billed the wrong amount.

### Covered by

`src/routes/subscriptions.changePlan.test.ts`, now on CI (verify.yml,
"Subscription lifecycle and remaining integration tests"). It asserts prices
against `computePlanQuote`'s own output rather than literals, so a legitimate
reprice does not break it while a return to formula-based pricing does. It
covers both directions — the refusal path *and* the staging path that writes to
the database, which required seeding a monthly subscription because
weekly→monthly is an increase for every plan and would only ever exercise the
refusal branch.

---

## Original report (2026-08-10)

## The two halves disagree

| Path | Prices with |
|---|---|
| `POST /subscriptions` | `computePlanQuote(planId, track, cadence).cycleTotalPaise` — **the plan catalog** |
| `POST /subscriptions/:id/change-plan` | `computeDeliveryPricePaise(newCadence, newMeals)` — **the retired per-meal helper** |

A subscription is therefore created at one pricing model and re-priced at another.

## What it does in practice

Measured for `desk_fuel` / veg / weekly, changing **nothing** — same cadence, same meal count:

```
created:      pricePerDeliveryPaise = 119900   (₹1,199, mealsPerDelivery = 6)
change-plan:  newPricePerDeliveryPaise = 448875 (₹4,488, same cadence, same meals)
isIncrease?   true   → 3.7x
```

Two consequences, both bad:

1. **Every change-plan on a plan-v2 subscription is classified as a price
   increase**, because the legacy figure is always far above the catalog figure.
   That drags every change — including a *decrease* — through the Razorpay
   reauthorisation flow it was designed to skip.
2. **If applied, it overwrites `pricePerDeliveryPaise` with the legacy number.**
   The mandate then charges roughly 3.7x what the customer agreed to.

The route's own comment says *"Money-path authority: the new price is ALWAYS
computed server-side"* — which is true, and not the problem. The problem is that
the server computes it from a model the rest of the system has retired.

## Why nobody noticed

`subscriptions.changePlan.test.ts` **asserts the correct behaviour and fails**.
Its four failing tests are the same-price, price-decrease, price-increase and
guardrail cases — precisely the ones that detect this. It was on
`scripts/test-reach-baseline.txt`, i.e. executed by no workflow, so it has been
reporting a real billing defect into an empty room.

That suite is deliberately **left off CI and left on the baseline** until this is
resolved. Wiring it in green would require rewriting the assertions to match the
buggy behaviour, which would convert the last remaining evidence of this defect
into a test that certifies it.

## The product decision required

Under catalog pricing, a plan's price is a property of the **plan**, not of
cadence × meal count. But `change-plan` only accepts `cadence` and
`mealsPerDelivery` — it cannot name a new `planId`, so there is no catalog entry
to price against. That is the gap, and it is a product question, not a mechanical
fix:

- [ ] **Does change-plan still make sense?** If a plan's price and meal count both
      come from the catalog, "change my meal count" may no longer be a coherent
      operation — the equivalent is *switch to a different plan*.
- [ ] **If it stays:** should it take a `planId` and reprice via
      `computePlanQuote`, making it a plan-switch endpoint?
- [ ] **If it goes:** what replaces it for customers on a live mandate, and what
      happens to the pending-change / reauth machinery built around it?
- [ ] **Proration:** the current model swaps the price at the next cycle
      boundary. A catalog switch mid-cycle may need explicit proration rules.
- [ ] **Existing rows:** are there subscriptions whose `pricePerDeliveryPaise`
      was already overwritten by a change-plan? If so they are being billed the
      legacy figure and need reconciliation.

## Suggested first step

Audit `subscriptions` for rows whose `pricePerDeliveryPaise` does not match the
catalog price implied by their `plan_v2` notes tag. That distinguishes "latent
defect" from "customers are already being overcharged", and the answer changes
the urgency.
