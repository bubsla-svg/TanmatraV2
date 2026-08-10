# DEFECT-CHANGE-PLAN-PRICING-001 — change-plan reprices from the retired legacy model

| | |
|---|---|
| **Title** | `POST /subscriptions/:id/change-plan` computes the new price with the legacy per-meal helper, not the plan catalog |
| **Severity** | **P1** — it bills a wrong amount, and misclassifies every change as a price increase |
| **Status** | **OPEN — needs a product decision** |
| **Found** | 2026-08-10, while repairing `subscriptions.changePlan.test.ts` |
| **Blast radius** | Every plan-v2 subscription, i.e. every subscription created since `planId` became required |

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
