# P0-9 — Trial lifecycle audit: the ₹399 one-time purchase guarantee

## Product decision being audited against

> The ₹399 three-day trial is a one-time, non-renewing purchase. It must not
> create a monthly subscription or recurring mandate. Starting a regular plan
> is a separate, explicit transaction, at which point eligible ₹399 credit
> may be applied server-side.

This is an audit, not a rewrite: check whether the live code already matches
this model before changing anything. **Conclusion up front: it does.** No
checkout, pricing, or mandate-registration behavior changes in this PR. What
changed is a regression test that pins down a gate that already existed but
was previously only exercised incidentally, and a code comment that
mis-described that same gate. Trial checkout remains live and ungated
(`PLAN_CATALOG.trial_3day.status === "live"` →
`planIsSelfServiceLaunchable("trial_3day")` is `true`) — there was never a
reason found to block it.

## 1. The trial is priced once, server-side, from the catalog

`POST /subscriptions` (`artifacts/api-server/src/routes/subscriptions.ts`) is
the single creation endpoint for every subscription, trial or regular. For
`planId: "trial_3day"`:

- Price comes from `computePlanQuote("trial_3day", track, cadence)` — the
  catalog-authoritative spine (`PLAN_CATALOG.trial_3day.flatPricePaise =
  39900`, i.e. ₹399) — never a client-supplied amount.
- `generateCount = 1` and the code comment states it plainly: "one-off
  sampler — does not recur." Exactly one subscription row and one cycle of
  deliveries (3 meals) are created; nothing schedules a second cycle.
- A phone-hash uniqueness check (`hasRedeemedTrialPhone`) refuses a second
  trial purchase per phone number with `409 trial_already_redeemed`, checked
  **before** the creation transaction opens.
- `trialState: "trial_purchased"` is persisted at creation — the first of
  the "live trial" states (see §2).

The storefront has its own standing regression test for exactly this,
independent of this audit:
`artifacts/storefront/lib/pricingInvariants.test.ts` — *"the 3-Day Taste Test
has exactly one price, everywhere it appears"* — asserts that every pricing
surface for `trial_3day` (`TRIAL_PRICE_PAISE`, the catalog's own
`flatPricePaise`, `planQuoteView`, `checkoutTotalWithAddOns`,
`computePlanQuote` for every diet track, the plan-builder quotes) resolves to
the identical value, and a companion test bans any plan/trial/checkout
surface from importing the legacy cadence-based pricing constructs at all
(`computeDeliveryPricePaise`, `computeTrialPricePaise`, `PER_MEAL_PAISE`,
etc. — see §4 for why those still exist).

## 2. Two independent gates keep a live trial from ever getting a recurring mandate

`TrialState` (`lib/db/src/schema/subscriptions.ts`) is one of
`"trial_purchased" | "trial_active" | "trial_bridge_eligible" |
"trial_ended_undecided" | "converted" | "ended_abandoned"`, and:

```ts
export function isLiveTrialState(state: TrialState | null | undefined): boolean {
  return state != null && state !== "converted" && state !== "ended_abandoned";
}
```

Every pre-decision stage is "live." Both places that could put a recurring
Razorpay mandate on a subscription check it independently:

- **Order creation** (`POST /payments/razorpay/order`, `routes/payments.ts`):
  the `isRecurring` branch is gated
  `!isLiveTrialState(sub.trialState) && (cadence === "weekly" ||
  "fortnightly")`. A live trial's cadence is "weekly" too (reused purely for
  delivery-window scheduling — it does not mean "bills weekly"), so the
  `isLiveTrialState` clause is the only thing standing between a trial order
  and a minted recurring token. It is present and correct in the code today.
- **Post-payment mandate registration** (`registerAutopayMandate`,
  `routes/payments.ts`, shared by both the `/verify` route and the payment
  webhook handler — confirmed both call sites): independently re-checks
  `isLiveTrialState(subDelivery.trialState)` and, if true, skips mandate
  registration entirely **and grants the ₹399 creditback right there**
  instead (see §3) — explicitly commented as "defense in depth with the
  order-create guard above."

A subscription can only ever acquire a `subscription_mandates` row through
one of these two paths, and both exclude live trials. A new regression test,
`artifacts/api-server/src/routes/payments.subscriptionOrder.test.ts` ("a live
trial (weekly cadence) never mints a recurring token, and verify writes no
mandate"), now pins this directly — creating a real trial subscription via
the actual route, then exercising the real order-create + verify calls and
asserting no Razorpay customer/token is minted and no mandate row is written.
Previously this exact scenario (live trial **and** a recurring-shaped
cadence, the case the gate exists for) had no dedicated test; the file's
existing coverage only varied cadence on non-trial subscriptions.

**Downstream, the recurring-charge sweep can't reach a trial either way.**
`runDueMandateChargesSweep` (`lib/chargeMandateScheduler.ts`) selects rows by
`INNER JOIN subscriptionMandatesTable` — a subscription with no mandate row
is structurally absent from that join, not merely excluded by a state check
that could regress. Since a live trial never gets a mandate row (above),
it is invisible to the recurring-billing driver by construction.

## 3. The stale comment this PR fixes

`artifacts/api-server/src/lib/trialLifecycleScheduler.ts`'s `abandonTrial`
docblock previously asserted the **opposite** of §2: that the
create-order `isRecurring` gate had "no trialState exclusion" and that a
trial "can, in an edge case, end up with a live mandate row." That was
contradicted by reading the current `routes/payments.ts` directly. The
practical conclusion the old comment drew — call `cancelAutopayMandate`
unconditionally in `abandonTrial`, since it's documented idempotent/safe on a
subscription with zero mandate rows — was already correct and is unchanged;
only the reasoning was wrong. Fixed to state the real gates (§2) and reframe
the unconditional call as defense-in-depth against a *future* regression in
either gate, not a description of a live gap. No behavior change — this
function's actual code (flip `trialState`/`status`, cancel upcoming
deliveries, revoke autopay unconditionally) was never affected by which
version of the comment sat above it.

## 4. "Starting a regular plan" is already a separate, explicit transaction with automatic credit redemption

Nothing in the trial's lifecycle (payment, the 3 deliveries, the
bridge-eligible/undecided/abandoned sweep in `trialLifecycleScheduler.ts`)
calls `POST /subscriptions` again or otherwise starts a second subscription.
The only way to start a regular plan is the customer explicitly doing so —
the storefront's own checkout flow for any non-trial `planId`, which is the
exact same `POST /subscriptions` route, just with a different `planId` and
no trial-specific branch taken.

Credit redemption at that point is automatic and server-side, inside the
same creation transaction (`routes/subscriptions.ts`, `POST /subscriptions`):
after any trial→à-la-carte "bridge" credit is applied, whatever remains of
the account's general credit-ledger balance — which is where the trial's
own ₹399 paid-time creditback lives once granted (§2, `maybeGrantTrialCreditback`,
issued via `issueCredit` with `reason: "checkout_redemption"`) — is redeemed
against the new plan's bill automatically, under an advisory lock (no
double-redemption race). The storefront checkout page's own comment
confirms this is intentional, current behavior: *"once signed in,
PlanCheckout reads the account's real credit-ledger balance ... and shows
the net total; subscriptions.ts redeems the same balance automatically at
create time."* This already matches "eligible ₹399 credit may be applied
server-side" at the point of starting a regular plan — nothing to change.

## 5. Flagged, not fixed: a dead-but-armed `/convert` route shares the P0-2 pricing defect

`POST /subscriptions/:id/convert` (`routes/subscriptions.ts`) is a real,
auth-checked, fully wired server route — not disabled, not behind a feature
flag. It flips `trialState` to `"converted"` and prices the now-regular
subscription with `computeDeliveryPricePaise(sub.cadence,
sub.mealsPerDelivery)` — **the same retired, non-catalog pricing function**
that PR #69 (P0-2, `DEFECT-CHANGE-PLAN-PRICING-001`) contained on the
change-plan routes for pricing correctness reasons. If this route were
reachable, converting a trial would very likely bill a wrong (drifted, non
catalog) price.

**It is not reachable.** Verified across every client surface in this repo:

- `artifacts/storefront` — zero references to `/convert` anywhere.
- `artifacts/tanmatra-mobile` — zero references to "convert" anywhere.
- `lib/api-spec/openapi.yaml` — does not declare this path, so
  `lib/api-client-react`'s generated hooks have no function for it either;
  nothing generated can call it.
- `artifacts/tanmatra` (now internal-only Admin ERP + RD console, see
  `CLAUDE.md` — customer routes removed 2026-07-26) has exactly one caller:
  `tanmatra-v2/Subscribe.tsx`'s `subscriptionsApi.convert(s.id)`, reached
  through `pages/Subscriptions.tsx`. That page is **not present in
  `src/routes.ts`** — the current route table is admin/RD-console routes
  only (`AdminAuthLayout`/`RdAuthLayout` children, `admin/login`,
  `legacy-login-alias`, a catch-all). The only caller of this route in the
  entire codebase is orphaned code with no path a real request could take to
  reach it.

This PR does not touch `/convert` — wiring it up, deleting it, or fixing its
pricing would all be speculative work outside this audit's scope (mirrors
how P0-2 flagged `applyPendingPlanChangeIfReady`'s residual risk without
fixing it). Flagged here so a future change that re-exposes conversion
through any client does not silently inherit this pricing defect.

## 6. Historical note: `docs/illogical-instances-register.md` §A3 is not a live bug

That register (dated **2026-07-20**, explicitly scoped to "entire
customer-facing surface (web `artifacts/tanmatra` + mobile
`artifacts/tanmatra-mobile`)") documents the 3-Day Trial being priced three
different ways — ₹1,499 / ₹5,316 / ₹3,458 — across `tanmatra`'s customer
pages (`SubscriptionPlansLanding.tsx`, `HomeDualFunnel.tsx`,
`MetabolicLandingView.tsx`, `GoalPlanChooser.tsx`, all reading
`computeTrialPricePaise`/`rdPlans.ts`'s legacy cadence-model constructs). It
predates the 2026-07-26 domain cutover (`docs/DOMAIN-CUTOVER.md`) by six
days: at the time it was written, `tanmatra` **was** the live customer app,
so this was a real, live billing defect. Today those pages are unreachable
for the same reason §5's `/convert` caller is — `tanmatra`'s customer routes
were removed and `tanmatra.food` is served by the storefront, which prices
the trial exactly once (§1). Noted here only so nobody re-reads that
register and mistakes a pre-cutover finding for a live gap in today's
storefront; the register itself is a historical record and this PR does not
edit it.

## Conclusion

The one-time-purchase guarantee already holds, defended by two independent
server-side checks with a shared, single-source-of-truth `isLiveTrialState`
predicate, backed by a catalog-authoritative price with its own standing
regression test, with the recurring-billing sweep structurally unable to
reach a trial regardless. Trial checkout does not need to be gated. This PR
adds the one missing regression test for the exact "live trial on a
recurring-shaped cadence" scenario, corrects a comment that had the gate's
existence backwards, and documents two out-of-scope risks (§5, §6) for
future readers instead of speculatively touching either.
