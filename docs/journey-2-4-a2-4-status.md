# PR A2.4 status — PLAN_CATALOG subscription origination

**Filed against:** the owner's A2.4 authorization, conditional on the
`slot_date` invariant being enforced (`docs/DEFECT-PLAN-SLOT-DATE-001.md`,
merged in #35). Continues the ledger in `docs/journey-2-4-a2-3a-status.md`.

**Scope:** `PLAN_CATALOG` origination only. **Generated custom-plan pricing is
deliberately absent** — see DEFECT-CUSTOM-PRICING-001. Plan checkout stays
gated. No frontend work.

---

## 1. Two findings that reshaped the slice

### 1.1 Most of the lifecycle already existed

The A2.4 brief reads as though Order → Subscription → first cycle → deliveries
must be built from nothing. They already are: `POST /subscriptions` runs the
whole set in **one transaction**, behind `planCheckoutGate` and a mandatory
`Idempotency-Key`, and has done since before this series.

A2.4 is therefore a **binding** problem, not a construction problem: take a
frozen QuoteSnapshot and turn it into that same set of rows, spending the quote
exactly once. Recording this because the brief's framing would have led to a
second implementation of the money path sitting beside the first.

Per the owner's decision, the money-critical parts are now **shared**
(`lib/subscriptionOrigination.ts`) rather than duplicated. Delivery generation
is deliberately *not* shared: the legacy path derives dates from a cadence, the
plan path must reproduce the exact dates a customer was quoted. One function
doing both would need a cadence-shaped parameter set the plan path fills with
lies.

### 1.2 There is no `subscription_cycles` table

The brief names a "First SubscriptionCycle" as an entity. The codebase has never
had one — a cycle is the batch of `subscription_deliveries` generated for it,
plus `nextDeliveryAt` / `generate-next`. Per the owner's decision A2.4 **does
not introduce the table**; the invariant is expressed as *the created deliveries
are exactly the schedule the quote sold*, which is what the tests assert.

## 2. Pay-then-create, deliberately inverted from the legacy path

`POST /subscriptions` creates the subscription first and lets `lib/paidGate.ts`
withhold fulfilment until capture. That works, but a failed payment leaves a
subscription row behind — incompatible with the brief's *"Failed payment: No
Subscription"*.

Origination from a quote can do better, and only because A2.3a exists: the
QuoteSnapshot already holds the customer's capacity for 30 minutes, so
**nothing needs to exist during payment except the quote**. `POST
/plan-drafts/:id/convert` therefore creates nothing until settlement verifies.

## 3. Exactly-once, held from two sides

| Guard | Mechanism |
|---|---|
| Quote claim | `consumeQuoteTx` — `status='active' AND expires_at >= now` evaluated **inside** the UPDATE |
| Conversion record | `plan_draft_conversions.plan_draft_quote_id` is **UNIQUE** |
| Retry replay | `(user_id, idempotency_key)` unique, scoped to the owner |

Neither is load-bearing alone. A repeated callback, a double-clicked button and
a retried webhook all lose one race or the other and are answered with the
conversion that already exists.

`consumeQuoteTx` is new: `consumeQuote` opened its own transaction, which cannot
work here — claiming the quote and creating the subscription must commit or roll
back together, or a crash between them leaves a customer who has paid, still
holds capacity, and has nothing to show for it.

## 4. The money comes from the quote

The request names a quote; the amount is that quote's frozen `totalPaise`. A
client cannot state a price on this route, and there is no field in which to try.

**`zero_charge` is verified, not believed.** The brief's sharpest rule —
*"discount-only ₹0 without settlement evidence cannot convert"* — is enforced by
re-deriving the payable amount from the frozen quote and refusing `402` if it is
non-zero. A caller asserting it owes nothing proves nothing.

## 5. Coverage against the brief's test matrix

| Area | State |
|---|---|
| Active catalog quote converts | ✅ |
| Expired / superseded / stale-version quote cannot convert | ✅ |
| Another customer's quote — non-disclosing 404, not 403 | ✅ |
| Concurrent settlements → one order, one subscription | ✅ |
| Repeated callback → replay, no second subscription | ✅ |
| Capacity reservation consumed exactly once | ✅ |
| Quoted amount = order amount = subscription price | ✅ |
| One quoted day → exactly one delivery, on the quoted IST date/window | ✅ |
| No two plan days collapse into one delivery | ✅ |
| Zero-charge without evidence refused | ✅ |
| Forged signature converts nothing | ✅ |
| `PLAN_CHECKOUT_DISABLED` refuses and does not spend the quote | ✅ |
| Pricing-unavailable draft cannot convert | ✅ *(structurally — a custom draft never obtains a quote)* |
| **Renewal amount = subscription renewal amount** | ❌ **deferred** — renewal pricing is not modelled on a QuoteSnapshot yet |
| **Recurring vs one-time add-ons** | ❌ **deferred** — add-ons are not carried on a quote yet |
| **Razorpay order creation bound to a quote** | ❌ **deferred** — see §6 |
| **Mid-transaction failure rollback** | ⚠️ **partial** — atomicity is structural (one transaction; the concurrency test proves the losing writer leaves nothing), but no fault-injection test forces a failure between steps |

## 6. What A2.4 does NOT do, explicitly

- **Creating the Razorpay order bound to a quote.** The conversion route
  *verifies* a settlement; nothing yet *initiates* one against a quote. That
  wiring cannot be exercised while checkout is gated and no real plan payment
  may run, so it is deferred rather than written blind.
- **Custom-plan (Journey 4) origination.** Structurally impossible today: a
  non-catalog draft never obtains a quote, so it cannot reach this route. That
  is the correct behaviour until DEFECT-CUSTOM-PRICING-001 is decided.
- **A `subscription_cycles` table** — §1.2.
- **Address/member propagation from the draft.** The subscription is created
  with null address fields; the draft's delivery address is on its schedule and
  the deliveries are correct, but the subscription header does not carry it yet.
  Flagged rather than guessed at.

## 7. Verification

Real Postgres 16, schema built the way CI builds it.

| Check | Result |
|---|---|
| `planDraftConvert.test.ts` (new) | **13/13** |
| Full PlanDraft suite (10 files) | **140/140** |
| Extraction is behaviour-neutral | Same 9 legacy subscription suites, identical results before and after the refactor (8 pre-existing cross-suite failures on both sides, all passing individually) |
| `pnpm run typecheck` | clean |
| `lint:test-reach` | pass — new file wired into `verify.yml` |
| Migration `0032` | applied through the real runner on a fresh chain (33 migrations) |

> **Pre-existing, unrelated:** running `subscriptions.dayplan`,
> `subscriptions.planV2Trial` and `subscriptions.planV2AddOns` together with
> other suites produces 8 failures that do not occur when each file runs alone,
> on `main` as well as here. A test-isolation problem in those suites, not a
> product defect, and not introduced by this PR.

## 8. Ledger

| Defect | Status |
|---|---|
| DEFECT-PLAN-CONVERT-001 | **Closed for `PLAN_CATALOG`.** A quote now creates the order/subscription/first-cycle lifecycle idempotently. Still open for Journey 4, which has no price. |
| DEFECT-PLAN-ORIGIN-001 | **Closed for `PLAN_CATALOG`** — an end-to-end purchasable subscription lifecycle exists behind the gate. Journey 4 remains blocked on pricing. |
| DEFECT-CUSTOM-PRICING-001 | Open — BLOCKED ON PRODUCT DECISION. |

**`PLAN_CHECKOUT_DISABLED=1` stays set** until the controlled plan-verification
sequence passes. No real plan payment has been run.
