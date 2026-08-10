# DEFECT-CUSTOM-PRICING-001 — no approved pricing model for generated custom plans

| | |
|---|---|
| **Title** | No approved pricing model for generated custom plans |
| **Severity** | **P1** for Journey 4 checkout completion · **P2** for configuration and save-draft UX |
| **Owner** | Product + Finance + Nutrition Operations |
| **Status** | **BLOCKED ON PRODUCT DECISION** |
| **Filed** | 2026-08-10, by the A2.3 review |
| **Blocks** | Journey 4 quote + checkout · extending A2.4 beyond `PLAN_CATALOG` |
| **Does not block** | Journey 4 generation, lineup review, meal changes, delivery scheduling, save-draft |

## What is missing

`PLAN_CATALOG` prices a **recommended** plan. There is no pricing model anywhere
in this repository for a **freely-generated custom plan**, and the corpus does
not define one. This is a product gap, not an engineering gap: no amount of code
can decide what a custom plan costs.

## Current behaviour (correct, and deliberate)

`GET /plan-drafts/:id/quote-readiness` returns a typed blocker for any
non-catalog draft, and `POST /plan-drafts/:id/quote` refuses it:

```json
{
  "ready": false,
  "issues": [
    {
      "code": "pricing_unavailable",
      "message": "Custom plans don't have pricing yet, so they can't be quoted.",
      "detail": { "journey": "custom" }
    }
  ]
}
```

The alternatives were all worse, and each is a way of fabricating money:

- hardcoding a plan price;
- summing dish-card display prices in the browser;
- reusing a recommended plan's price for a plan that is not that plan;
- applying an undocumented discount;
- letting the customer reach payment with an unapproved amount.

**The invariant:** *no plan becomes quote-ready until the server has a defined,
approved pricing model for that exact plan configuration.*

Refusing to price is a successful enforcement of the financial-authority
boundary. It should not be "fixed" in engineering.

## What the frontend must render

Journey 4 is unblocked through generation, lineup review, meal changes and
delivery scheduling. At quote readiness it must render an honest state:

> **Pricing isn't available for this custom plan yet.**
> · Save this plan · Choose a recommended plan · Return to plan options

Recovery actions the API advertises: `choose_recommended_plan`, `save_draft`.

**Must not render:** a fabricated total · a disabled payment button with no
explanation · a price borrowed from another plan · any successful checkout
state.

## Recommended pricing model — catalog-priced custom-plan products

Not a free-form sum of generated dishes. The customer picks a **commercial plan
format first**, and generation then chooses meals *within that purchased
envelope*:

- Custom Essential
- Custom Performance
- Custom Clinical Support

Each catalog entry defines: eligible duration · meal count · base price ·
renewal price · included dish price bands · included customisation allowance ·
recurring add-ons · one-time add-ons · delivery treatment · tax treatment.

**Why this over line-item pricing:** predictable customer pricing, predictable
food cost and margin, stable renewal values, clear add-on treatment, fewer quote
changes after lineup generation, easier support and refund handling, and no
pressure to expose dish-level price arithmetic to the browser.

**The alternative — line-item pricing** (sum of configured meal-slot prices +
add-ons + delivery − discounts) is more flexible but brings price volatility
after every Shuffle, complex renewal behaviour, harder margin control, more
frequent quote invalidation, and confusing plan comparisons. It should not be
selected unless business leadership explicitly wants a variable-price custom
subscription.

## Decision record required before A2.4 can price a custom plan

A short document covering, at minimum:

- [ ] Commercial custom-plan SKUs
- [ ] Base pricing per SKU
- [ ] Duration discounts
- [ ] Included dish price bands
- [ ] Price-changing substitutions (what a customer may swap without repricing)
- [ ] Recurring vs one-time add-ons
- [ ] Delivery fee treatment
- [ ] Taxes (the platform currently prices GST-inclusive, all-in, per planCatalog 02c)
- [ ] Renewal price
- [ ] Refund and credit behaviour
- [ ] Price-honour period (A2.3a honours an issued quote for its 30-minute TTL — see `docs/journey-2-4-a2-3a-status.md` §3.5)

## Until the decision is approved

| Surface | State |
|---|---|
| Journey 4 generation and review | **May proceed** |
| Journey 4 delivery scheduling | **May proceed** |
| Journey 4 quote and checkout | **Blocked**, with `pricing_unavailable` |
| A2.4 scope | `PLAN_CATALOG` subscription origination **only** |

## Engineering readiness once approved

The seam already exists. `assessReadiness()` in
`artifacts/api-server/src/routes/planDraftSchedule.ts` gates on
`draft.journey !== "recommended" || !PLAN_CATALOG[planId]`. A custom-plan SKU
added to the catalog with an approved price makes those drafts quote-ready
through the same path a recommended plan already takes — no new pricing code,
which is the point of recommending the catalog-priced model.
