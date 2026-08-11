# P0-2 — Plan-change contract trace, cohort analysis, and containment

> Repository-wide trace requested before any new plan-change/pricing endpoint is
> designed. Conclusion: **no safe, server-authoritative contract exists today**
> for changing an existing subscription's plan. `POST /subscriptions/:id/change-plan`
> and its two re-authorisation follow-ups are disabled server-side as immediate
> containment (this PR). No replacement endpoint is designed here — that is a
> separate, product-reviewed piece of work; see "Open questions" below.

## 1. The authoritative plan spine

`lib/subscription-rules/src/planCatalog.ts` is the single source of truth for
plan pricing. Its own header says so explicitly:

> "This layer supersedes the legacy cadence model (`pricing.ts`) and the 8
> condition-named RD plans... per the 'replace the live model' decision
> (2026-07-22)."

The relevant exports:

- `PLAN_CATALOG` / `PLAN_PRICE_TABLE` — per-plan, per-track, per-cycle prices
  in paise (GST-inclusive).
- `computePlanQuote(planId, track, cycle)` — **the server-authoritative quote**.
  `POST /subscriptions` (creation) prices every plan-v2 subscription through
  this function.
- `computeDeliveryPricePaise(cadence, mealsPerDelivery)` — the **retired**
  per-meal helper from the pre-corpus cadence model. Still exported from
  `@workspace/subscription-rules` (as `computeDeliveryPricePaise` in
  `subscriptionPricing.ts`) for the v1 (pre-plan-catalog) subscriptions that
  still exist, and is exactly what a v1 `POST /subscriptions` still prices
  from when `planId` is omitted.

Two live pricing models, not one. That is the entire root cause below.

## 2. Subscription commercial version

There is no explicit `commercialVersion` column. The generation a subscription
belongs to is inferred entirely from `subscriptions.notes`:

- **plan-v2**: `notes` contains the tag `plan_v2:<planId>` (e.g.
  `plan_v2:desk_fuel`), written by `POST /subscriptions` when a `planId` is
  supplied. Priced via `computePlanQuote`. This has been required for new
  signups since "legacy pricing is disabled" (P-1) — confirmed by
  `subscriptions.changePlan.test.ts`'s own comment on the fixture, and by
  `subscriptions.planV2Trial.test.ts`'s "flag OFF" test, which shows legacy
  pricing paths now 410 `legacy_trial_retired` / reject outright.
- **v1 (legacy)**: no `plan_v2:` tag. Priced via `computeDeliveryPricePaise`
  at creation. Whether any such rows still exist in a live database is
  unknown from this sandbox (no `DATABASE_URL` — see §6).

`scripts/src/audit-subscription-pricing.ts`'s `planIdFromNotes()` is the
canonical parser for this tag and is reused verbatim in the cohort analysis
below.

## 3. The change-quote / proration contract that exists — and its defect

`POST /subscriptions/:id/change-plan` (`artifacts/api-server/src/routes/subscriptions.ts`,
pre-containment ~line 2232) is the only change-quote/proration contract in the
repo for an *existing* subscription. It does not take a `planId` — only
`cadence` and/or `mealsPerDelivery` — and reprices with
**`computeDeliveryPricePaise`, the retired v1 helper**, then compares that
against the subscription's *current* `pricePerDeliveryPaise` to decide
`isIncrease`.

For a plan-v2 subscription (created via `computePlanQuote`), that comparison
is apples-to-oranges. Measured example from
`docs/DEFECT-CHANGE-PLAN-PRICING-001.md` (desk_fuel / veg / weekly, changing
**nothing** — same cadence, same meal count):

```
created:      pricePerDeliveryPaise = 119900   (₹1,199, catalog)
change-plan:  newPricePerDeliveryPaise = 448875 (₹4,488, legacy formula)
isIncrease?   true → 3.7x
```

Consequences, both bad:

1. Every change-plan on a plan-v2 subscription is misclassified as a price
   *increase* (the legacy figure is structurally far above the catalog
   figure), forcing it through the Razorpay re-authorisation flow regardless
   of what the customer actually asked for.
2. If applied, `pricePerDeliveryPaise` is overwritten with the legacy figure
   — the live autopay mandate then charges ~3.7x what the customer agreed to
   at signup.

This is not a new finding — it is fully documented in
`docs/DEFECT-CHANGE-PLAN-PRICING-001.md` (status: OPEN, needs a product
decision) and reproduced by `subscriptions.changePlan.test.ts`, which was
deliberately kept **off CI** (`scripts/test-reach-baseline.txt`) so its
failures wouldn't be silently normalised. This trace confirms that analysis
against the current tree and turns the containment into code.

### The unsafe client-side preview

`artifacts/storefront/components/account/ChangePlanPanel.tsx` — live (not
quarantined) and reachable from any `status: "active"` subscription via
`SubscriptionCard.tsx`'s "Change plan" button — computed and displayed
`previewPrice = computeDeliveryPricePaise(cadence, meals)` as "New price:
X/delivery", captioned "Preview only — the SAME pure fn the server bills
from, so this can never drift from what change-plan actually charges." That
comment was true (client and server used the same wrong function) but the
number itself was never the catalog price the subscription was actually sold
at. A customer confirming against this preview would be confirming a bill the
plan catalog does not justify.

## 4. The Razorpay re-authorisation path

`artifacts/api-server/src/lib/razorpayRecurring.ts` — extracted so the
token-creation/mandate-registration logic used at subscription creation
(`POST /payments/razorpay/order`'s `isRecurring` branch) is reused, not
reimplemented, by change-plan's re-auth follow-ups:

- `POST /subscriptions/:id/change-plan/reauth-order` — creates a Razorpay
  order + OTP-auth recurring token, priced from `pendingPricePerDeliveryPaise`
  (i.e. from the same wrong figure change-plan set).
- `POST /subscriptions/:id/change-plan/confirm` — verifies the HMAC
  signature, binds it to the exact order id, then calls
  `upsertActiveMandate()` to **replace** the subscription's existing mandate
  token with the newly-authorised one.

Both follow-ups are downstream of the same defect: they authorise and
register a mandate for an amount computed by the retired formula. Disabling
change-plan alone does not stop them — a subscription that already has
`pendingChangeReauthRequired: true` from *before* this fix shipped could still
walk through reauth-order → confirm and register a mandate for the wrong
amount. Both are therefore disabled in this PR as well (§7).

## 5. Unused / quarantined implementation found

- `artifacts/storefront/quarantine/components/account/ChangePlanPanel.tsx` and
  `.../SubscriptionCard.tsx` — quarantined copies, excluded from the build
  (`tsconfig.json`'s quarantine exclusion). Diff-inspected: same
  `computeDeliveryPricePaise`-based preview as the live version. Not a safe
  alternative to fall back to.
- **`POST /subscriptions/:id/convert`** (`subscriptions.ts`, ~line 2722) — a
  *second*, distinct route that also reprices with `computeDeliveryPricePaise`
  (`const pricePerDeliveryPaise = computeDeliveryPricePaise(sub.cadence, sub.mealsPerDelivery);`).
  This is the trial→standard "conversion" mechanism: it flips
  `trialState` to `"converted"` on the *same* subscription row and reprices
  it, without accepting a `planId` — it simply continues whatever
  cadence/mealsPerDelivery the trial happened to have. It carries the
  identical DEFECT-CHANGE-PLAN-PRICING-001 fingerprint.
  **Grep-confirmed zero live storefront callers**
  (`grep -rn "convert" artifacts/storefront/lib artifacts/storefront/components artifacts/storefront/app`
  finds nothing referencing this route or a `convertTrial`-shaped client
  function) — the live storefront's actual post-trial upgrade path is the
  ordinary `PlanCheckout` → `POST /subscriptions` create flow (catalog-priced,
  credit-ledger auto-redeemed server-side; see the P0-9 audit for detail).
  `/convert` is therefore **dead but armed**: not a live risk today, but a
  landmine for whoever next wires a "continue to a full plan" CTA to it
  without noticing it shares this defect. Left untouched in this PR (out of
  scope for "immediate containment" of the *live* risk) but flagged here so
  whoever resolves DEFECT-CHANGE-PLAN-PRICING-001 fixes this route in the same
  pass — see "Open questions."

## 6. Cohort analysis

`scripts/src/audit-subscription-pricing.ts` (already in the repo, read-only,
writes nothing) is the correct tool for this: for every subscription carrying
a `plan_v2:` tag, it derives the *set* of prices the catalog would allow
(across all three diet tracks, plus any `plan_review` add-on the row
carries) and classifies rows whose `pricePerDeliveryPaise` matches none of
them:

- `LEGACY_FORMULA` — price exactly equals `computeDeliveryPricePaise(cadence, meals)`
  — the change-plan defect's fingerprint, near-certain evidence a row was
  already overcharged by this defect.
- `UNEXPLAINED` — matches neither the catalog nor the legacy formula; needs a
  human look.
- `OK` — matches a catalog track.

**This sandbox has no `DATABASE_URL`** (`echo $DATABASE_URL` → empty), so the
script could not be executed against live or staging data as part of this
trace. Run before deciding remediation for any existing rows:

```
DATABASE_URL=<staging or prod, read-only role preferred> \
  pnpm --filter @workspace/scripts run audit-subscription-pricing
```

A `LEGACY_FORMULA` count > 0 means real customers are already being
overcharged and need reconciliation (refund or price correction) — a
decision this trace deliberately does not make, per the defect doc's own
framing ("the right correction for an overcharged row depends on whether the
customer was already billed, which this cannot know").

### Residual risk this containment does *not* close

Blocking the three change-plan route entry points stops any *new* mispriced
pending change from being created or completed. It does **not** retroactively
cancel a pending change that was already computed and stored (in
`pendingCadence` / `pendingPricePerDeliveryPaise`) by a pre-containment call.
`applyPendingPlanChangeIfReady()` — invoked from `POST /subscriptions/:id/generate-next`
at every cycle rollover — will still silently apply such a pending change,
**including one with `pendingChangeReauthRequired: false`** (the "increase but
no active mandate to protect" case from the change-plan test suite), the
moment that subscription's cycle rolls over. The cohort script above only
scans the *live* `pricePerDeliveryPaise`, not `pendingPricePerDeliveryPaise`,
so it would not surface this ahead of time.

**Recommendation, not actioned in this PR** (deliberately — this needs its own
review, not a scope-creeping fix bundled into containment): extend the audit
script to also flag rows with a non-null `pendingPricePerDeliveryPaise` that
matches the `LEGACY_FORMULA` fingerprint, and/or add a guard to
`applyPendingPlanChangeIfReady` refusing to apply a pending change that
matches it. Until then, anyone running `generate-next` broadly (e.g. a batch
job) should run the extended cohort check first.

## 7. Containment applied in this PR

Per "if no safe server-authoritative contract exists, disable plan-change
submission and remove the unsafe preview" — since §3-§5 show no safe contract
exists today:

**Server** (`artifacts/api-server/src/routes/subscriptions.ts`) — all three
route entry points now return `503 { code: "change_plan_temporarily_disabled" }`
immediately after auth + basic param validation, before any pricing
computation or DB mutation:
- `POST /subscriptions/:id/change-plan`
- `POST /subscriptions/:id/change-plan/reauth-order`
- `POST /subscriptions/:id/change-plan/confirm`

This is a server-side block, not a client-only hide — it holds regardless of
which client calls it. The dead handler bodies (and their now-unused imports:
`razorpayCredentials`, `razorpayBasicAuth`, `getOrCreateRazorpayCustomer`,
`fetchRazorpayPayment`, `upsertActiveMandate`, `crypto`) were removed rather
than left unreachable.

**Client** (`artifacts/storefront/components/account/ChangePlanPanel.tsx`) —
replaced the form + unsafe preview + Razorpay reauth flow with a static,
honest notice: "Plan changes are temporarily unavailable while we fix a
pricing issue. Your current plan and billing are unaffected." `SubscriptionCard.tsx`
is unchanged — its "Change plan" button and "Complete authorisation" link
still work, they just now reveal this notice instead of a broken form. No
dead CTA, no silent no-op, consistent with this repo's ghost-ui standard.

**Tests** — `subscriptions.changePlan.test.ts` previously asserted the
pre-defect *intended* behaviour and failed (that's why it was kept off CI).
It now asserts the containment itself: all three endpoints 503 regardless of
payload, auth is still enforced first, and the live plan is left completely
untouched. `lib/pricingInvariants.test.ts`'s legacy-import ban no longer needs
a `ChangePlanPanel.tsx` allowlist entry, since the panel no longer imports
`computeDeliveryPricePaise` at all — removed. Verified: `pnpm run typecheck:libs`
then `pnpm --filter @workspace/api-server run typecheck` and
`pnpm --filter @workspace/storefront run typecheck` both clean;
`lint:tokens` passes; the full storefront suite (632 tests) passes. The new
change-plan test suite needs a live Postgres to execute
(`node --test --import tsx ./src/routes/subscriptions.changePlan.test.ts` from
`artifacts/api-server`) — **not run in this sandbox** (no `DATABASE_URL`);
verify before merge.

**Explicitly not done**, per instruction: no new pricing/plan-change endpoint
was designed. §8 below is the starting point for that separate work.

## 8. Open questions for the replacement contract (product decision required)

Unchanged from `docs/DEFECT-CHANGE-PLAN-PRICING-001.md`, restated here since
this trace is the natural jumping-off point:

- Does change-plan still make sense at all under catalog pricing, where a
  plan's price is a property of the *plan*, not of cadence × meal count? The
  coherent equivalent may simply be "switch to a different `planId`."
- If it stays as a plan-switch: take a `planId`, reprice via
  `computePlanQuote`, and decide proration rules for a mid-cycle switch.
- If it goes: what (if anything) replaces it for a customer on a live
  mandate who wants a different cadence/meal count within the *same* plan?
- `/convert` (§5) shares this defect and has zero live callers — fix it in
  the same pass as whatever replaces change-plan, or delete it if the
  credit-ledger-based create flow fully supersedes it (see the P0-9 trial
  lifecycle audit).
- Existing rows: run the cohort script (§6) against real data before deciding
  remediation for any `LEGACY_FORMULA` hits.
