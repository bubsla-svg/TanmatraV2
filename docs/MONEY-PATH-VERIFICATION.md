# Guest money path — post-fix production verification record

> 2026-08-09. **This is not a feature cutover.** `NEXT_PUBLIC_LIVE_CHECKOUT=1`
> has been baked into the production storefront build all along (deploy.yml
> build-arg), Razorpay keys are live on the api-server, and à-la-carte checkout
> is enabled — meaning guest checkout was **enabled and broken** until
> 2026-08-09: the client never sent the `Idempotency-Key` that
> `POST /api/orders` requires, so every guest order create returned 400
> (`idempotency_key_required`). PR #10 fixed the client; PR #11 added the same
> protection to `POST /subscriptions`. This document records the verification
> that the repaired path actually works, and the GO/NO-GO decision.

## 1. Automated verification (completed)

| Check | Result | Evidence |
|---|---|---|
| PR #10 (client sends Idempotency-Key) deployed | ✅ | `https://tanmatra.food/api/build` serves sha `fda3727` = PR #10 merge; deploy run for it concluded success 07:22 UTC |
| PR #11 (server requires the key on /subscriptions) | 🕐 deploy in progress at time of writing (run 31301495025); its CI (incl. money-integration with the 4 new idempotency tests) was fully green | run started 07:35 UTC |
| Firebase authorized domains | ✅ `tanmatra.food` and `www.tanmatra.food` both authorized | public `getProjectConfig` for project `brand-tanmatra-tmg` returns both in `authorizedDomains` — **no console action needed** |
| `/menu` serves dishes | ✅ 71 Add buttons in the SSR HTML | curl probe |
| Guest checkout form renders | ✅ phone / address / PIN / DPDP-consent copy, "server bills the final total (incl. GST)" | curl probe of `/checkout?mode=alacarte` |
| No order was created by verification | ✅ probes were read-only | an unpaid `placed` order would appear on the live kitchen KDS board (no payment filter in `KDS_BOARD_STATUSES`), so automated probes never submit the form |

## 2. The controlled test order (owner action — the moment of truth)

**Before you start:** an order enters the kitchen board (`placed`) the moment
the form is submitted, *before* payment. Either forewarn the kitchen or pay
immediately and treat it as a real (small) order.

1. On a phone or normal browser: `tanmatra.food` → Menu → add ONE low-value
   dish → cart → Checkout.
2. Fill phone + a real serviceable address + PIN, tick the DPDP consent.
3. Submit → the Razorpay sheet must open showing the **server's** total (UPI).
4. Pay. Expect: confirmation screen → `/order/confirmed/...` → Track link.
5. Record: the `orderId` shown, amount paid, timestamp.

If the Razorpay sheet does not open, or shows ₹0/na, or the confirm screen
errors: **stop, capture a screenshot, do not retry more than once** (the
idempotency key makes one retry safe — it replays, it does not double-order).

## 3. Reconciliation checklist (after the test order)

| Record | Where | Must show |
|---|---|---|
| Order row | admin/ops board (KDS) | the order, status `preparing` after payment |
| Payment | Razorpay dashboard | one captured payment, amount == checkout display |
| Customer view | `/track/<orderId>` | live status, same total |
| No duplicates | Razorpay + ops board | exactly one order, one payment |
| Webhook | api-server logs (Cloud Run) | `payment.captured` webhook processed without error |

## 4. Verdicts (owner ruling, 2026-08-09)

```
GUEST MONEY PATH
  PR #10:                       Deployed — missing required header corrected
  PR #11:                       DEPLOYED AND VERIFIED — revision evidence recorded
                                in §9 (rev wellness-foods-00203-nxt, 100% traffic,
                                2026-08-09 07:45:28Z); CI green incl. 4 idempotency
                                integration tests
  Firebase domains:             PASS (tanmatra.food + www.tanmatra.food AUTHORIZED;
                                derived from public config — one non-destructive
                                sign-in smoke test still required)
  Checkout rendering:           PASS
  Order creation:               PASS, but occurs before payment
  Kitchen fulfilment isolation: PR #13 MERGED. All Verify jobs passed, incl.
                                Postgres-backed money-integration. Production
                                deployment revision evidence: see §9 addendum
                                once recorded.
  Settlement trust boundary:    WAS BROKEN, NOW FIXED — see §10. A client-
                                controlled identifier stood in as settlement
                                proof in the reconciliation sweep. Fixed to a
                                real join against server-owned rows; the one
                                reachable route is additionally gated pending
                                an owner decision on whether to keep it.
  Controlled paid order:        BLOCKED pending §6 checklist (now includes §10)
  Guest checkout verdict:       NO-GO FOR PROMOTION (storefront's own checkout,
                                routes/checkout.ts POST /orders, is traced in
                                §10 and is NOT reachable by the settlement-
                                trust-boundary defect — see §10's verdict)

PLAN MONEY PATH
  Add-on billing:               Reported fixed on main (create resolves, 422-guards
                                and bills plan_review add-ons); evidence to be
                                attached in the plan-verification pass
  Production availability:      Was live; GATED by owner decision (PR #12) —
                                GATE CONFIRMED LIVE IN PRODUCTION 2026-08-09
                                (probe evidence in §9)
  Decision:                     Gate new plan purchases pending independent plan
                                verification
  Plan checkout verdict:        NO-GO (gate independently unaffected by §10 —
                                subscriptions.ts's `sub-<id>` externalOrderId is
                                server-generated, never client-suppliable; see
                                §10's trace)

HOLDS
  Real production order:        HOLD until the pre-order checklist below passes
  Wave 2:                       HOLD
```

**The acceptance criterion** (owner, verbatim): *"No order may become
operationally actionable until payment success or verified zero-charge
sponsorship is authoritative on the server."* The tester being able to pay
quickly is not a substitute for that invariant. Restated per the owner's
2026-08-09 review: *"No browser-controlled or unauthenticated field can cause
an unpaid order to acquire the trusted financial status required for
fulfilment."* See §10.

## 5. Containment applied (this change)

- **Plan checkout gated server-side**: `POST /subscriptions` refuses new
  creates with a typed 503 — `{code: "PLAN_CHECKOUT_TEMPORARILY_UNAVAILABLE",
  message: "Plan checkout is temporarily unavailable. Please try again
  shortly."}` — while `PLAN_CHECKOUT_DISABLED=1` is set; that env var is added
  to the api-server's production deploy (deploy.yml). Existing subscriptions
  (skip/swap/cancel/change-plan) are untouched. The gate mounts BEFORE
  `idempotencyMiddleware` so a refusal is never cached against a customer's
  stable retry key (integration-tested: same key succeeds after reopening).
  Staging/dev/tests default OPEN (env unset).
- **Fulfilment isolation (unpaid orders out of actionable kitchen/dispatch
  queues)**: IMPLEMENTED as its own change (the fulfilment-isolation PR).
  Design rule per owner: order records may exist pre-payment for recovery, but
  fulfilment release requires server-authoritative payment success or verified
  zero-charge sponsorship — enforced in write predicates, not board display.
  What shipped, all keyed off `lib/paidGate.ts` (two predicates: ASSIGNABLE =
  preparing/ready for first rider assignment; PAID-LIVE = + rider_assigned/
  out_for_delivery for packing/reassignment):
  - KDS board + ready mutation share one status constant (`preparing` only) —
    the ready UPDATE's WHERE clause is the DB-level invariant, so an unpaid
    `placed` ticket can be neither displayed nor advanced.
  - `dispatchOrder` chokepoint refuses non-assignable statuses twice: at
    pre-flight and again under the FOR UPDATE row lock (race-proof); the
    dispatch sweep no longer scans `placed`, and an unpaid STAT order can no
    longer stamp a permanent `sla_breach`.
  - The BullMQ pipeline ladder strips `placed` from its advance-from set —
    the placed→preparing edge stays exclusively payment's write
    (payments.ts verify/webhooks, the reconciliation sweep, the verified
    zero-charge finalize).
  - Petpooja's three status webhooks acknowledge-without-applying any advance
    on an unpaid own_app order (they resolve by id, so a replayed or
    misdirected event could otherwise promote an abandoned checkout).
  - Ops surfaces gated: delivery auto-assign, ops-agent assign_rider /
    update_order_status, WMS route-fulfillment and BOM explosion (both deduct
    real inventory) — 409 on non-paid-live.
  - Verified zero-charge settlement promotes in-transaction at finalize
    (credits/subsidy settled in the same tx), and a reconciliation-sweep
    promoter heals pre-invariant rows — settlement EVIDENCE required, and as
    of the §10 fix that evidence is always a join against a server-owned row
    (a subscription-delivery linkage, a subsidy reservation, or a credit
    claim), never a property of the client-supplied `externalOrderId` string;
    a discount-minted ₹0 is never promoted (that is priced-free food nobody
    settled).
- **Settlement trust boundary (2026-08-09, owner review of the fulfilment-
  isolation PR)**: the reconciliation sweep's zero-charge promoter treated
  `externalOrderId.startsWith("sub-")` as proof of subscription settlement.
  `externalOrderId` is client-supplied on the one reachable route
  (`POST /orders/finalize`, 1-64 chars, zero format constraint) — the prefix
  proved nothing. Fixed to a real join against `subscription_deliveries` +
  `subscriptions`, scoped by the order's own serial id and userId (neither
  client-suppliable); the credit-claim branch gained the same userId scoping
  it was silently missing. `ORDER_FINALIZE_DISABLED` closes the one reachable
  route pending an owner decision on whether to keep or retire it (no live
  first-party UI calls it). Full trace: §10.

## 6. Pre-order checklist (all must pass BEFORE the controlled guest order)

```
[x] PR #11 API revision serves 100% traffic (revision evidence recorded — §9)
[x] PR #13 API revision serves 100% traffic (revision evidence recorded — §9 addendum)
[x] Unpaid orders excluded from actionable kitchen fulfilment (PR #13, merged + CI-green)
[x] Abandoned-payment test passes (order stays awaiting payment, kitchen sees 0)
[x] Failed-payment test passes (fulfilment blocked, entitlements released)
[x] Unresolved-payment test passes (blocked; status recheck restores attempt)
[x] Successful payment releases fulfilment exactly once
[x] Repeated callback: one order, one release, one ticket, one notification
[x] Sponsored zero-charge: one confirmed order, one release, one ticket (evidence
    rewritten to a real join, §10 — CI green on commit 5e72c6c, run 31307405210;
    merged as df9c2a8, deployed as revision wellness-foods-00206-j7l, deploy run
    31307909903 — §9 PR #15 addendum)
[ ] Firebase sign-in smoke test (no OTP capture; returnTo + cart + quote intact)
[x] Browser-controlled identifiers cannot prove financial settlement (fix + tests
    CI-verified on commit 5e72c6c, run 31307405210, §10; merged as df9c2a8,
    deployed as revision wellness-foods-00206-j7l, deploy run 31307909903, and
    confirmed live by a production probe of ORDER_FINALIZE_DISABLED — §9 PR #15
    addendum)
```

PR #15's CI history, for the record: Verify run [31306304884](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31306304884)
on commit `e8912a8` (the original fix) FAILED — a real Postgres unique-constraint
violation in a test fixture, not the production code (see §10's "test-fixture bug"
note). Fixed in commit `9a5a2dd`; run [31306524106](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31306524106)
passed, including the money-integration job's real-Postgres execution of every
forged-prefix / cross-customer / partial-settlement test — the "run it against
real Postgres" bar the acceptance criterion requires, actually cleared, not
merely proposed. Commit `9a5a2dd`'s green run did not yet include the
`finalizeOrder` ownership/re-link fix (§10) an adversarial audit surfaced
afterward; that landed in commit `5e72c6c`, and run
[31307405210](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31307405210)
— the PR's HEAD at merge — passed too, including the two new
`loyaltyEngine.checkout.test.ts` regression tests for that fix. PR #15 merged as
`df9c2a8` and deployed as Cloud Run revision `wellness-foods-00206-j7l` (deploy
run 31307909903, §9 addendum) — CI-green on a branch is verification, not
deployment, so both boxes above stayed unchecked until that deploy evidence,
plus a live probe of the `ORDER_FINALIZE_DISABLED` gate, was recorded.

Automated coverage now pinning rows 2–8 (each box flips to `[x]` when the
fulfilment-isolation PR is merged, CI-green, and its deploy revision evidence
is recorded here):

| Scenario | Test |
|---|---|
| Unpaid excluded from kitchen | `ops.kds.test.ts` (board absence + ready-refusal on `placed`) |
| Abandoned / failed / unresolved payment | `dispatch.paidGate.test.ts` (dispatch refusal, sweep exclusion, no SLA stamp); `reconciliationScheduler.test.ts` (authorized-only and wrong-amount stay `placed`) |
| Success releases exactly once | `payments.webhook.test.ts` + `reconciliationScheduler.test.ts` (guarded CAS — one of webhook/sweep wins) |
| Repeated callback duplicates nothing | `payments.webhook.test.ts` (event dedup + CAS) |
| Sponsored zero-charge | `reconciliationScheduler.test.ts` promoter suite (settled promotes via real join; discount-minted ₹0 refused; forged/cross-customer references refused, §10) |
| POS cannot promote unpaid | `petpooja.statusMonotonic.test.ts` paid-fulfilment section |
| Inventory deduction gated | `ops.paidGate.test.ts` (WMS route-fulfillment + BOM explosion 409 on non-paid-live) |

Then run the §2 controlled order and reconcile §3 — the procedure no longer
depends on paying quickly; correctness must hold if the customer waits,
closes the gateway, loses connectivity, or abandons checkout.

## 7. Plan checkout — reopening criteria

Before the gate reopens, an independent plan verification must prove: base
plan quote equals charge; recurring add-ons appear in initial AND renewal
totals; one-time add-ons do not recur; exactly one order, one subscription,
one schedule per purchase; fulfilment blocked until payment confirmation;
repeated callback duplicates nothing.

**Added 2026-08-09 (§10 audit):** `isTrialSubscription()`'s client-controlled
`.includes()` substring check on `subscriptions.notes` — currently inert only
because `PLAN_CHECKOUT_DISABLED=1` gates the whole route — must be fixed to a
structured, server-owned trial marker (not a substring of free client text)
before this gate is ever lifted. A full-price plan-v2 subscriber can otherwise
forge trial-creditback eligibility and collect an unearned ₹399 store credit.
See §10 "Two more issues surfaced by the same audit."

## 8. Wave 2 gate

Wave 2 begins only after §4's guest verdict is revised to GO with the §6
checklist complete and documented.

## 9. Deploy revision evidence (recorded 2026-08-09)

Service `wellness-foods`, project `brand-tanmatra-tmg`, region `asia-south2`.
Image identity is the sha-tagged Artifact Registry ref the deploy pinned —
`asia-south2-docker.pkg.dev/brand-tanmatra-tmg/wellness/wellness-foods:<merge SHA>`
— which is one-to-one with the commit and is what the revision actually runs.

| | PR #11 (idempotency enforcement) | PR #12 (plan-checkout gate) |
|---|---|---|
| Merge SHA | `11753a2ce3689e83b1a068ee9ca7076975a69575` | `0fd06a46cd30baad13522145cca2580e86684f1b` |
| Deploy run | [31301495025](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31301495025) — success | [31302584683](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31302584683) — success |
| Cloud Build ID | `9de2d4c6-c6d8-40d4-839b-6b1c9f6b4d40` (SUCCESS) | `cff57b46-6670-4a7a-bf65-0ecb72a2060a` (SUCCESS) |
| Image tag | `…/wellness-foods:11753a2c…` | `…/wellness-foods:0fd06a46…` |
| Cloud Run revision | `wellness-foods-00203-nxt` | `wellness-foods-00204-952` |
| Previous stable (rollback target) | `wellness-foods-00202-wzw` | `wellness-foods-00203-nxt` |
| Traffic | 100% LATEST at 07:45:22Z | 100% LATEST at 08:13:34Z |
| `/api/livez` smoke | OK 07:45:26Z | OK 08:13:36Z |
| Deploy completed | 07:45:28Z | 08:16:57Z (incl. frontend + storefront jobs) |
| `PLAN_CHECKOUT_DISABLED` in deploy env | absent (expected — added by #12) | `=1` present |

Rollback for either is `gcloud run services update-traffic wellness-foods
--region asia-south2 --to-revisions <previous stable>=100`.

### Production gate probe (2026-08-09, read-only)

`POST /api/subscriptions` with `{}` and no credentials — the gate mounts before
auth and before `idempotencyMiddleware`, so an ungated build would answer 401 or
400 instead:

```
https://tanmatra.food/api/subscriptions                    → HTTP 503
https://wellness-foods-yftxztp3xq-em.a.run.app/api/subscriptions → HTTP 503
{"code":"PLAN_CHECKOUT_TEMPORARILY_UNAVAILABLE",
 "message":"Plan checkout is temporarily unavailable. Please try again shortly.",
 "error":"Plan checkout is temporarily unavailable. Please try again shortly."}
```

Same body from the domain and from the Cloud Run service URL, so the gate is
the API's own and not an edge artefact. Controls proving the 503 is the gate
rather than a sick service: `/api/livez` and `/api/healthz` 200; `/api/build`
reports sha `0fd06a46…` (the #12 merge commit); `POST /api/orders {}` answers
`400 idempotency_key_required` — i.e. non-plan POSTs still reach their normal
middleware, and PR #11's header enforcement is live in production.

No order was created and no checkout form was submitted by this probe.

### PR #13 (fulfilment isolation) deploy revision evidence (recorded 2026-08-09)

| | PR #13 (paid-fulfilment invariant) |
|---|---|
| Merge SHA | `f8aacceb4775e448ce900eb8e20eed98cc39eeeb` |
| Deploy run | [31304649117](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31304649117) — success |
| Verify (pre-merge, on the PR head) | [31304493412](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31304493412) — success (typecheck, money-unit, money-integration all green) |
| Deploy's own `gate` job (re-verifies on the merge commit) | job [93222960606](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31304649117/job/93222960606) — success, including "Money-path integration tests (verify.yml's full list)" against real Postgres |
| Cloud Build ID | `b644a090-b121-4b23-8fba-d83254d0e579` (SUCCESS) |
| Image tag | `…/wellness-foods:f8aacceb…` |
| Cloud Run revision | `wellness-foods-00205-mv8` |
| Previous stable (rollback target) | `wellness-foods-00204-952` |
| Traffic | 100% LATEST at 09:04:20Z |
| `/api/livez` smoke | OK 09:04:22Z |
| Deploy completed | 09:04:25Z (frontend/storefront jobs correctly SKIPPED — this PR touched only `artifacts/api-server`, `.github`, `docs`) |
| `PLAN_CHECKOUT_DISABLED` in deploy env | `=1` present (unchanged from #12) |
| `ORDER_FINALIZE_DISABLED` in deploy env | absent at this revision — added by the settlement-trust-boundary fix (§10), takes effect on the NEXT deploy |

This confirms the ops.kds/dispatch.paidGate/ops.paidGate/petpooja.statusMonotonic
suites underpinning §6 rows 3–7 ran green against real Postgres on the exact
commit now serving 100% of production traffic — not merely on a feature
branch. Row 8 (sponsored zero-charge) and the new browser-controlled-identifier
row are pinned by tests rewritten in the §10 fix, not yet included in any
green CI run — see §10's own status note.

### PR #15 (settlement trust boundary) deploy revision evidence (recorded 2026-08-09)

PR #15 merged (commit `df9c2a8`) and deployed automatically via `deploy.yml`'s
push-to-main trigger, closing out the "pending merge + production deploy
revision evidence" note the two §6 rows below carried while the PR was open.

| | PR #15 (settlement trust boundary) |
|---|---|
| Merge SHA | `df9c2a850901afcf1986069b877e5d5a49be1853` |
| Deploy run | [31307909903](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31307909903) — success (gate, migrate-db, cloud-run, frontend-cloud-run, storefront-cloud-run all green) |
| Deploy's own `gate` job (re-verifies on the merge commit) | job [93231091007](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31307909903/job/93231091007) — success, including "Money-path integration tests (verify.yml's full list)" against real Postgres — this is what actually ran the §10 forged-prefix / cross-customer / partial-settlement suite and the `finalizeOrder` ownership tests against real Postgres for the first time on the commit that ships them |
| Cloud Build ID | `d6418a82-802e-4bdc-b91e-16e43af11cb7` (SUCCESS) |
| Image tag | `…/wellness-foods:df9c2a85…` |
| Cloud Run revision | `wellness-foods-00206-j7l` |
| Previous stable (rollback target) | `wellness-foods-00205-mv8` (PR #13's revision — confirms an unbroken chain) |
| Traffic | 100% LATEST at 10:26:28Z |
| `/api/livez` smoke | OK 10:26:30Z |
| `PLAN_CHECKOUT_DISABLED` in deploy env | `=1` present (unchanged) |
| `ORDER_FINALIZE_DISABLED` in deploy env | `=1` present — first revision to carry it |

**Post-deploy production probe (2026-08-09, read-only, no order created):**

```
POST https://wellness-foods-yftxztp3xq-em.a.run.app/api/orders/finalize  {}
→ HTTP 503
{"code":"CHECKOUT_TEMPORARILY_UNAVAILABLE",
 "message":"Checkout is temporarily unavailable. Please try again shortly.",
 "error":"Checkout is temporarily unavailable. Please try again shortly."}
```

This is the `orderFinalizeGate` middleware answering, mounted before
`idempotencyMiddleware` exactly as designed — confirms `ORDER_FINALIZE_DISABLED`
is not just present in the deploy command but actually enforced by the running
revision. Both §6 rows below (Sponsored zero-charge; Browser-controlled
identifiers cannot prove financial settlement) now have every piece the
checklist asked for: real-Postgres CI evidence (run 31307405210, commit
`5e72c6c`), a production deploy of that commit (run 31307909903, revision
`wellness-foods-00206-j7l`), and a live probe confirming the containment gate
that makes the fix's *reachable* surface a non-issue either way. Flipped to
`[x]` in §6.

## 10. Settlement Trust Boundary (2026-08-09, owner review)

The owner's review of the fulfilment-isolation PR (§5/§9) flagged a specific
concern before accepting the paid-fulfilment invariant: the reconciliation
sweep's zero-charge promoter treated `orders.externalOrderId.startsWith("sub-")`
as proof a subscription had settled the order. `externalOrderId` is
client-supplied on the one route that reaches this check. The owner's
directive: prove or refute reachability with a concrete trust-boundary trace,
fix the evidence source to be server-owned, add adversarial tests, and hold
the real order and both checkouts until resolved.

### Identifier trace

| Field | Table | Type | Set by | Client-suppliable? | Mutable after write? | Uniqueness | Consumers |
|---|---|---|---|---|---|---|---|
| `externalOrderId` (à-la-carte, guest) | `orders` | varchar(64) | `routes/checkout.ts` `POST /orders` (`placeOrderSchema.externalOrderId`) | **Yes** — any 1-64 char string, no format constraint | No | unique per `(userId, externalOrderId)`, `userId` nullable for guests | idempotency key for the create; order lookup by `GET /orders/:externalOrderId/status` |
| `externalOrderId` (à-la-carte, `/orders/finalize`) | `orders` | varchar(64) | `routes/loyalty.ts` `POST /orders/finalize` (`finalizeOrderSchema.orderId` → `lib/loyaltyEngine.ts finalizeOrder` `args.orderId`) | **Yes** — identical shape to above | No | unique per `(userId, externalOrderId)` | idempotency key; referral/first-order eligibility; **was** read as settlement evidence by the sweep |
| `externalOrderId` (subscription first cycle) | `orders` | varchar(64) | `routes/subscriptions.ts` `createOrderForNewSubscription`, hardcoded `` `sub-${sub.id}` `` | **No** — `sub.id` is the subscription's own serial primary key, generated by Postgres inside the same create transaction | No | unique per `(userId, externalOrderId)` | display only after this fix; no longer parsed for meaning |
| `subscriptionDeliveries.orderId` | `subscription_deliveries` | integer, nullable | `createOrderForNewSubscription` (subscription create) and `finalizeOrder` (à-la-carte, via client-suppliable `subscriptionId` — see below), both `UPDATE ... WHERE id = <delivery>` | **No** — no route accepts this column itself from a request body | Guarded to write-once: both writers now require `orderId IS NULL` in the UPDATE's own WHERE clause (CAS) | not declared unique, but write-once-enforced by the CAS guard, not just convention | **new** settlement evidence (§ below); `payments.ts registerAutopayMandate`; `chargeMandate.ts` |
| `subscriptions.userId` | `subscriptions` | varchar, FK → `users.id`, not null | subscription create, from `req.user.id` (authenticated session) | No | No | — | the cross-customer scope on the new join |
| `orders.userId` | `orders` | varchar, nullable, FK → `users.id` | every order-creating route, from the authenticated session (`req.user.id`) or `null` for an anonymous guest (`routes/checkout.ts` only) | No — no route accepts a caller-chosen `userId` in the request body | No | — | the cross-customer scope on both the subscription-cycle and credit-claim evidence joins. Load-bearing and, unlike every other identifier in this table, not itself protected by a DB constraint — its trustworthiness rests entirely on every own_app order writer deriving it from the session, which is independently verified true today (checkout.ts, loyaltyEngine.ts, subscriptions.ts, chargeMandate.ts, marketplace.ts all confirmed) but is not asserted as its own regression test. A future admin "place order on behalf of a customer" feature must preserve this or the join's cross-customer guarantee breaks silently. |
| `subscriptionId` (`/orders/finalize` input) | request body only, not a table | number, optional | `routes/loyalty.ts finalizeOrderSchema.subscriptionId` | **Yes** — any positive integer, no ownership check in the original code | n/a | n/a | selects which subscription's earliest "upcoming" delivery gets linked to the new order — **the writer behind the `subscriptionDeliveries.orderId` row above**. Found unguarded during this same audit; fixed in this change (§ below) |
| `orderClaims.orderId` | `loyalty_order_claims` | varchar(64) | `lib/loyaltyEngine.ts` `finalizeOrder`, set to the SAME `args.orderId`/`externalOrderId` the order itself was created with | Indirectly (mirrors the client string) but `redeemedPaise` on the row is 100% server-computed and capped by the real ledger balance | `redeemedPaise`/`finalPaise` updated once, same transaction | unique per `(userId, orderId)` | credit-claim settlement evidence |
| `orderClaims.userId` | `loyalty_order_claims` | varchar, FK → `users.id` | same insert, from `args.userId` | No | No | — | **was missing from the sweep's WHERE clause** — fixed in this change (§ below) |
| `companySubsidyCharges.orderId` | `company_subsidy_charges` | integer | `lib/corporateSubsidy.ts` reservation flow, the order's own **serial** id (not `externalOrderId`) | No — the serial id is Postgres-generated at insert | status transitions (reserved→settled) | one row per order (design intent) | subsidy settlement evidence — unaffected, already safe |
| `idempotencyKey` (header) | `idempotency_cache` (middleware-owned) | text | client, `Idempotency-Key` header | Yes | No (24h cache) | primary key with request-body hash | replay detection only; never read as settlement evidence anywhere |
| `chargePaise` | `orders` | integer, nullable | `finalizeOrder`/`createOrderForNewSubscription` (server pricing math) or left `NULL` by `checkout.ts` | No — never accepted from a request body anywhere in the api-server (grepped exhaustively) | Written by payment capture / finalize only | — | the sweep's own candidate filter (`= 0`); payment verification's authoritative amount |
| `razorpayPaymentId` / `razorpayOrderId` | `orders` | varchar | `routes/payments.ts`, from Razorpay API responses / verified webhook signature | No | Written once on capture | — | capture-gated fulfilment release (unaffected by this defect) |

### Critical question, answered

*"Can a browser submit `{"externalOrderId": "sub-forged-value"}` and cause the
order to become operationally actionable?"*

**Before this fix: yes, narrowly.** Two conditions had to hold together:

1. The order's `chargePaise` resolves to exactly `0` through the caller's own
   legitimate discount/credit stack (item pricing is always server-resolved
   from the catalog — never client-supplied — so this is the pre-existing,
   already-anticipated "discount-minted zero" case, not a separate pricing
   bug).
2. The reconciliation sweep runs and reaches the row (every 5 minutes by
   default) after the order has sat 2+ minutes past its in-transaction
   finalize, which correctly refuses to promote a bare discount-zero.

Given both, `promoteSettledZeroChargeOrders` read `externalOrderId`, saw a
`"sub-"` prefix, and promoted the order to `preparing` — pushing it to the
kitchen board, the Petpooja POS, and emitting `payment_succeeded` — **without
ever checking that a subscription with that shape existed, let alone belonged
to this order or this customer.** No cross-customer forgery was even required:
a customer forging their own order was sufficient.

**Reachable surface, precisely:** `POST /api/orders/finalize`
(`routes/loyalty.ts` → `lib/loyaltyEngine.ts`), which requires authentication
(any signed-in customer) but has **no live first-party UI caller** — the
legacy SPA's `artifacts/tanmatra/src/tanmatra-v2/Checkout.tsx` still calls it
but is not wired into `routes.ts` (customer routes were removed from that app
2026-07-26, CLAUDE.md), and the storefront does not call it at all. It remains
a live, callable HTTP route regardless of UI wiring, so it is fixed and gated,
not left alone because "nothing calls it."

**The storefront's actual guest checkout, `POST /orders`
(`routes/checkout.ts`), is NOT reachable by this defect.** That route never
writes `chargePaise` at all — the column is left SQL `NULL` — and the
promoter's candidate query requires `chargePaise = 0` by literal equality,
which SQL `NULL` never satisfies. A repo-wide grep for every writer of
`chargePaise` confirms only `finalizeOrder` and the subscription-cycle insert
ever set it. This is traced, not assumed: `routes/checkout.ts:239-257`'s
insert has no `chargePaise` key.

**Also traced: the reconciliation sweep is currently DORMANT in production.**
`lib/reconciliationScheduler.ts`'s `startReconciliationScheduler()` is called
only inside `index.ts`'s `if (!schedulersDisabled)` block, and the production
deploy env sets `DISABLE_SCHEDULERS=true` (visible in both the #11 and #12
deploy logs, §9). No route, queue job, or workflow triggers the sweep on
demand — grepped exhaustively. **The defect could not have promoted a real
order in production today**; it was live in shipped code, reachable the
moment schedulers are re-armed (required infrastructure for the dropped-
webhook backstop once real orders resume), which is why it is fixed now
rather than deferred.

### A second gap found while re-deriving the fix

The credit-claim evidence branch matched `loyalty_order_claims.orderId`
against `externalOrderId` **without also scoping by `userId`**. Because
`externalOrderId` is unique only *per user* (not globally — two different
customers may legitimately choose the identical string), a forged order could
in principle match a *different* customer's real credit-claim row. Fixed in
the same commit by adding `eq(orderClaimsTable.userId, order.userId)` to that
query. Regression test: "cross-customer claim reference" in
`reconciliationScheduler.test.ts`.

### The fix

`lib/reconciliationScheduler.ts`'s `promoteSettledZeroChargeOrders` no longer
reads `externalOrderId`'s content for the subscription branch at all. It runs
an `INNER JOIN` from `subscription_deliveries` to `subscriptions`, filtered to
`subscription_deliveries.order_id = <this order's own serial id>` AND
`subscriptions.user_id = <this order's own userId>`. `subscription_deliveries
.order_id` is written exactly once, inside the same transaction that creates
the subscription and the order — no route ever accepts it from a client — so
satisfying the join proves a real subscription cycle was created **for this
specific order and its owner**, independent of what string the order's
`externalOrderId` happens to hold. The credit-claim branch gained the missing
`userId` scope described above. The company-subsidy branch was already safe
(keyed by the order's own serial id, never client-suppliable) and is
unchanged.

`ORDER_FINALIZE_DISABLED` (mirrors `PLAN_CHECKOUT_DISABLED` exactly — typed
503 `{code: "CHECKOUT_TEMPORARILY_UNAVAILABLE"}`, mounted before
`idempotencyMiddleware`, default open, closed in the production deploy env)
takes the one reachable route offline pending an owner decision on whether to
keep or retire it, since no live client uses it. The storefront's real guest
checkout (`POST /orders`) is deliberately **not** gated by this change — it is
not reachable by the defect this fix closes, and gating it would take real
orders offline for zero security benefit. It remains `NO-GO FOR PROMOTION` for
the pre-existing, unrelated reasons already on record in §4.

### The writer behind the evidence was itself unguarded — found and fixed in the same pass

An adversarial verification workflow run against this fix (before it merged)
independently re-derived every claim above rather than trusting it, and found
a real gap the fix's first draft left open: `finalizeOrder`'s optional
`subscriptionId` argument (`routes/loyalty.ts finalizeOrderSchema.subscriptionId`,
a bare client-supplied integer) was used with **no check that the subscription
belongs to the caller**, and no guard against re-linking a delivery that
already belongs to a different order. Concretely, before this fix:

- A caller could name **any other customer's** subscription id and have
  `finalizeOrder` silently steal that stranger's earliest upcoming delivery,
  overwriting its `orderId` to point at the caller's own, unrelated order —
  corrupting the victim's subscription data even though the join's `userId`
  scope (above) happens to stop that stolen link from being read back as
  *this* caller's settlement evidence.
- A caller could repeatedly name **their own** real subscription across
  several `finalizeOrder` calls and mint a fresh subscription-cycle evidence
  link for each one, one per real-but-unbilled upcoming delivery — turning a
  single legitimate subscription into an unbounded source of zero-charge
  "evidence."

Fixed in `lib/loyaltyEngine.ts`: before linking a delivery, `finalizeOrder` now
requires a `subscriptions` row matching `(id = subscriptionId, userId =
args.userId)`; the delivery lookup and the linking `UPDATE` both additionally
require `orderId IS NULL`, with the `UPDATE`'s own `WHERE` clause repeating
that check as a compare-and-swap (closing the same race two concurrent calls
could otherwise hit). Tests: `lib/loyaltyEngine.checkout.test.ts` — "finalizeOrder
refuses to link a delivery from a subscription the caller does not own" and
"finalizeOrder never re-links a delivery that already belongs to another
order."

This was already unreachable in production as a side effect of
`ORDER_FINALIZE_DISABLED` gating the whole route — but the docs already
described that gate as temporary, pending an owner decision, not a structural
fix. **This must stay fixed regardless of whether `ORDER_FINALIZE_DISABLED` is
ever lifted.**

**`ORDER_FINALIZE_DISABLED` reopening criteria** (mirrors §7's shape): before
this gate is lifted, confirm (a) the ownership + re-link guard above is
deployed and its two tests are green in production CI, (b) an owner decision
on whether `/orders/finalize` is retained at all — it has no live first-party
caller today — or formally retired, and (c) if retained, that whatever new
client is meant to call it sends a real `Idempotency-Key` per the route's
existing requirement.

### Two more issues surfaced by the same audit, tracked but out of scope here

The adversarial pass looked beyond this diff for the same class of bug and
found two more. Neither is touched by this PR; both are recorded here so they
are not lost.

1. **`isTrialSubscription()` (`routes/subscriptions.ts`) trusts a client-controlled
   substring as proof of a paid 3-Day Taste Test.** It checks
   `sub.notes?.includes(PLAN_V2_TRIAL_TAG)` — `notes` starts as free client text
   (`createSubscriptionSchema.notes`, up to 512 chars) that the server merely
   prepends its own real tag to and stores verbatim; the client's substring
   survives. A caller can buy a full-price, non-trial plan-v2 subscription while
   embedding the trial tag text anywhere in `notes`, and on payment confirmation
   `maybeGrantTrialCreditback` (`routes/payments.ts`) re-checks the same
   `.includes()` against the DB row and grants a genuine, spendable ₹399 store
   credit via `recordAndGrantTrialCredit` — gated only by a one-per-phone-ever
   unique index, not by whether the plan was actually trial_3day. Currently inert
   only because `POST /subscriptions` is separately gated by the pre-existing
   `PLAN_CHECKOUT_DISABLED=1` (unrelated to this fix). **Added to §7's plan-checkout
   reopening criteria below — must be fixed before that gate is ever lifted.**
2. **`docs/test-plan.md`** still names `/orders/finalize` as the canonical
   endpoint for P0 release-gate money-total assertions. Those specs live in an
   excluded `specs-archive/` directory that no workflow runs — the doc predates
   the 2026-07-26 customer-route removal and is stale, not exploitable. Worth a
   cleanup pass so it doesn't create false confidence later; not addressed here.

### Adversarial tests added (`lib/reconciliationScheduler.test.ts`, `routes/loyalty.checkout.test.ts`, `lib/loyaltyEngine.checkout.test.ts`)

| Owner's required scenario | Test |
|---|---|
| Forged subscription prefix | "P0 regression: a FORGED sub- prefix with NO real subscription_deliveries row is NOT promoted" |
| Valid subscription cycle | "a genuine subscription first-cycle order (real subscription_deliveries linkage) is promoted" |
| Cross-customer reference attack (subscription) | "cross-customer reference attack: forging another customer's real subscription id does not promote" — asserts the forger stays unpromoted AND the genuine owner's order still promotes |
| Cross-customer reference attack (credit claim) | "cross-customer claim reference: reusing another customer's externalOrderId string does not inherit their claim" |
| Valid credit redemption | "a zero-charge order with a credit redemption on its claim is promoted" (pre-existing, unaffected by this fix, still exercised) |
| Discount-created zero total | "a discount-minted zero with NO settlement evidence is NOT promoted" (pre-existing) |
| Partial settlement | "partial settlement never reaches the promoter: a non-zero remaining charge stays placed" |
| Replay | Structurally prevented by existing Postgres unique constraints (`uniq_loyalty_order_claims (userId, orderId)`; `subscription_deliveries.order_id` written exactly once) rather than by new application logic — no new test needed beyond the existing idempotency suites |
| Route-level containment gate | `loyalty.checkout.test.ts`: "ORDER_FINALIZE_DISABLED: typed 503, nothing created, idempotency key not poisoned" + its control |
| Subscription-delivery writer: cross-customer theft | `loyaltyEngine.checkout.test.ts`: "finalizeOrder refuses to link a delivery from a subscription the caller does not own" |
| Subscription-delivery writer: re-link / evidence-minting | `loyaltyEngine.checkout.test.ts`: "finalizeOrder never re-links a delivery that already belongs to another order" |

### Invariant

No order becomes operationally actionable based solely on an identifier
prefix, client-provided total, client-provided channel, or zero payable
amount. Settlement evidence for fulfilment release must be a join against a
row the client cannot have written: a verified payment-provider event, a
server-created subscription-cycle linkage, an atomic credit-ledger redemption
scoped to the redeeming customer, or a verified sponsor entitlement reserved
in the same transaction as the charge it covers.

Untrusted fields (never sufficient as proof of settlement, on any route):
`externalOrderId`, the `Idempotency-Key` header, client-declared cart/item
totals (pricing is always server-resolved from the catalog), client-declared
discount amounts, client-declared channel labels.

## 11. Paid-fulfilment invariant — five more findings, fixed (2026-08-09)

An adversarial audit of the entire paid-fulfilment invariant as shipped in
PR #13 — broader than §10's settlement-evidence defect, launched before PR #15
merged and completing after it — returned five independently-verified
findings. Three are gaps in code this project's own PR #13 shipped (a
premature customer notification, a documented-but-never-implemented
paid-liveness gate, and an insufficiently-strict status check); the other two
are a critical-but-currently-contained order-hijacking bug and a
lower-priority chokepoint gap in the delivery pipeline. All five are fixed
here, in the branch restarted from `origin/main` at PR #15's merge commit
(`df9c2a8`) per this repo's rule that a merged PR cannot be reused.

### P0 — premature order-confirmation notification before payment (`routes/checkout.ts`)

The guest/legacy `POST /orders` handler called `sendOrderConfirmation(row.id)`
immediately after inserting the order row — while its status is still
`"placed"` (unpaid). The WhatsApp/email template it sends says "is
confirmed... we are preparing your meal now," which is false at that point:
the payment-capture writers (`routes/payments.ts` verify/webhooks,
`lib/reconciliationScheduler.ts`, the verified zero-charge finalize) already
call the same function on the placed→preparing edge, so every legitimately
paid order gets exactly one accurate confirmation from there. Calling it a
second time, earlier and unconditionally, meant every abandoned or failed
checkout still left the customer holding a "confirmed, being prepared"
message for food nobody was cooking.

Fixed by removing the call site; the payment-capture writers remain the sole
senders. No dedicated regression test: this call shape has no DB- or
mock-observable side effect to assert on (no `dedupe` option was passed to
`sendWhatsappMessage`, so no `message_dispatches` row; `sendMail` no-ops
without `SMTP_URL`, unset in CI) — the audit itself notes zero pre-existing
test coverage for `orderNotification`, and inventing an unverifiable mock
carried more risk of a silently-broken CI job than the gap it would close.
Verified by direct code review and a clean `pnpm --filter @workspace/api-server
run typecheck`.

### P1 — `overrideAssignment` had no paid-liveness gate (`lib/dispatch.ts`)

`lib/paidGate.ts`'s own doc comment already claimed "dispatch's
`overrideAssignment` is the status-free human escape hatch... gated on
paid-liveness, never on assignability" — but the function never actually
checked `isPaidLive`. An operator (or the ops AI agent's tooling acting on a
misread instruction) could hand a real rider to an order via the manual
override path regardless of whether it had ever been paid for, bypassing
every gate `dispatchOrder`'s chokepoint enforces for the automated path.

Fixed with two checks, mirroring the existing channel check's shape: an
unlocked pre-flight `isPaidLive(order.status)` refusal in `overrideAssignment`
itself, and an authoritative re-check under the row's `FOR UPDATE` lock inside
`runOverrideTx` (the pre-flight read is unlocked, so a concurrent
cancel/payment-failed webhook can land between peek and claim). `runOverrideTx`
now returns a typed `{ok: true, decisionId} | {ok: false, reason}` union
instead of `number | null`, matching this codebase's house idiom for normal
business refusals (`dispatchOrderInner`'s existing shape). Deliberately
**not** collapsed into `isFulfilmentAssignable`: paid-live also covers
`rider_assigned`/`out_for_delivery`, because a legitimate reassignment of an
in-flight rider happens after first assignment — `paidGate.ts`'s own comment
calls out that collapsing the two predicates was a previously reviewed-out
bug, and a regression test now pins that this fix didn't resurrect it.

Tests (`lib/dispatch.channel.test.ts`): "overrideAssignment refuses an unpaid
('placed') own_app order" and "overrideAssignment still allows reassigning an
already-dispatched, paid-live order" (the positive control for the
paragraph above).

### P2 — `update_order_status` blocked only the literal string `"placed"` (`lib/ai/agents/ops.ts`)

The ops AI agent's `update_order_status` tool refused only when
`order.status === "placed" && status !== "cancelled"` — a negative check
that excludes exactly one string. Every other current status, including the
**terminal** `"delivered"` and `"cancelled"`, fell through to an unconditional
status `UPDATE`. An operator (or the LLM driving this tool from a misread
chat message) could walk an already-delivered or already-cancelled order back
into `"preparing"`, re-entering the kitchen/dispatch pipeline for an order
payment considers closed.

Fixed by replacing it with a positive `isPaidLive(order.status)` check, plus
the one deliberate carve-out (`placed→cancelled`, so ops can still kill unpaid
junk). Also added defense in depth: the status `UPDATE` is now a
compare-and-swap keyed on the status this handler actually read
(`WHERE id = orderId AND status = <status read above>`), using `.returning()`
to detect and refuse a concurrent change instead of silently overwriting it —
the same class of race P1's under-lock re-check closes for `overrideAssignment`.

This also **retires the false claim in §5** above ("Ops surfaces gated: ...
ops-agent assign_rider / update_order_status ... — 409 on non-paid-live") —
that line was written when only `assign_rider` actually enforced it;
`update_order_status` now does too, so the claim is accurate as of this fix
and needs no further correction.

Tests (new file `lib/ai/agents/ops.updateOrderStatus.test.ts`, resolving the
tool via `getAgent("ops")` the same way `ops.refundCap.test.ts` does): refuses
to advance a `"placed"` order; still allows `placed→cancelled`; refuses to
revive a `"delivered"` order; refuses to revive a `"cancelled"` order; and a
positive control that a genuinely paid-live order still advances.

### P3 — `finalizeOrder` could adopt and reprice a pre-existing order it did not create (`lib/loyaltyEngine.ts`)

The order `INSERT` in `finalizeOrder` is idempotent on `(userId,
externalOrderId)` via `onConflictDoNothing`. On conflict, the pre-§10-fix code
looked up the existing row and continued unconditionally — with no check on
that row's provenance. `createOrderForNewSubscription`
(`routes/subscriptions.ts`) and `chargeMandate.ts` both mint real orders under
exactly this `externalOrderId` shape (`sub-<id>`, `sub-<id>-mandate-<id>-<date>`).
Nothing stopped a caller from naming one of their own subscription-cycle order
ids as `orderId` in a `/orders/finalize` call: the flow would adopt that
order, run its own pricing against the caller's cart, and reach an
**unconditional `chargePaise` UPDATE**, silently overwriting the pre-existing
order's real settled price — potentially down to a credit/subsidy-covered
zero, which is exactly the shape of "trusted financial status" §10 and the
owner's restated invariant are about.

Fixed by requiring, on conflict, that a claim this flow itself would have
written (`orderClaimsTable` row keyed on `(userId, orderId)`) already exists
before treating the conflict as a legitimate idempotent retry — that insert
happens nowhere else, so its presence is proof this exact flow created the
row. Absent that claim, `finalizeOrder` now throws `order_id_conflict: ...`
instead of continuing; `routes/loyalty.ts` maps it to `409 {code:
"order_id_conflict"}`, alongside the pre-existing `delivery slot full` 409.
Considered and rejected as the fix: a denylist on `orderId` matching
`/^sub-/i` — it would miss `chargeMandate.ts`'s different prefix shape and
could false-positive on an unrelated client's naming choice; the claim check
closes the hole at the root regardless of naming convention.

Test (`lib/loyaltyEngine.checkout.test.ts`): "finalizeOrder refuses to adopt
and reprice a pre-existing order it did not create" — seeds an order directly
(simulating `createOrderForNewSubscription`'s output) with a real
`chargePaise`, calls `finalizeOrder` with the same owner and externalOrderId,
asserts the call rejects with `order_id_conflict:` and the pre-existing row's
`chargePaise` is untouched. The pre-existing legitimate-retry tests (e.g.
"first-order offer:... retry-safe") are unaffected: their first call creates
both the order and its own claim, so the retry's ownClaim lookup finds it and
proceeds exactly as before.

### Follow-up — pipeline side effects ran before the paid check (`lib/queue.ts`, `routes/delivery.ts`)

`orderPipelineProcessor`'s status `UPDATE` already refused to advance a
`"placed"` row (its `WHERE` excludes it), but every *other* side effect ran
unconditionally: the `delivery_events` insert-if-absent would fake a
progression history, the `"ready"` step's auto-dispatch call would hand a real
rider to the order (it keys only on `riderId == null`, never on status), and
the `"delivered"` step would write a clinical nutrition log — all reachable
for an order nobody has paid for yet via a delayed `scheduleOrderAdvance` job
queued before a payment-failed webhook lands, or a cancellation that arrives
mid-flight.

Fixed with an `isPaidLive` read at the very top of the processor, before any
side effect, refusing (logged, no-op) when the order is not paid-live. The
route that queues these jobs, `POST /delivery/schedule-advance`, got the same
gate mirrored from its sibling `/delivery/auto-assign` — necessary because
that route's no-Redis fallback calls `autoLogDeliveredOrder` directly,
bypassing the queue (and therefore the processor's own gate) entirely when
`REDIS_URL` is unset.

Tests: `lib/queue.pipelineIdempotency.test.ts` gained "an unpaid ('placed')
order's pipeline step is a full no-op (paid-liveness gate)" (zero
`delivery_events` rows, no rider assigned, status untouched); its pre-existing
"re-running the same pipeline step does not duplicate its delivery_events row"
test was re-pointed from a `"placed"` seed to `"preparing"` (the old seed now
legitimately no-ops under the new gate, so it stopped exercising the
retry-idempotency property it was written to pin).

### What is still open

- `isTrialSubscription()`'s client-controlled substring check (§10, "Two more
  issues surfaced by the same audit") — unchanged, still tracked under §7's
  `PLAN_CHECKOUT_DISABLED` reopening criteria.
- `docs/test-plan.md`'s stale `/orders/finalize` reference (§10) — unchanged,
  cosmetic.
- `lib/dispatch.ts`'s `setOrderPriority` has no status gate of its own, but
  stays defanged because both the SLA scan and the sweep scans it feeds are
  already restricted to `FULFILMENT_ASSIGNABLE_STATUSES`. Not fixed here;
  low-priority defense-in-depth if touched again.
- Route-level regression coverage for the P3 409 mapping and the
  `/delivery/schedule-advance` paid-liveness check was judged adequately
  covered by the engine/processor-level tests above (same underlying
  predicates, no additional branching at the route layer) and was not
  duplicated here to keep this change proportionate.

## 12. PR #16 Production Deployment (recorded 2026-08-09)

CI proves the merged code passed the repository's tests; it does not by
itself prove the production API is serving that code. This section is that
separate proof, for PR #16 specifically — the §11 audit fixes (premature
notification, `overrideAssignment` paid-gate, `update_order_status`
paid-gate, `finalizeOrder` order-hijack fix, pipeline-processor paid-gate).

**GitHub merged PR #16 with a real merge commit, not a fast-forward.** The
PR branch's head (`2d0404f`) is not what deployed — the merge commit
`96bd810` is, and that is the SHA the deploy evidence below is keyed to.

| | PR #16 (paid-fulfilment audit fixes) |
|---|---|
| PR branch head | `2d0404f83aeb698e80fd5e87edfb5f6ecc41aeb0` (CI-verified here, but not itself deployed) |
| **Merge SHA (deployed)** | `96bd810ec9220e3e432b96bcc2a8468d6b5e6848` |
| Deploy run | [31312543381](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31312543381) — success |
| Deploy's own `gate` job (re-verifies on the merge commit) | job [93242477000](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31312543381/job/93242477000) — success, including "Money-path integration tests (verify.yml's full list)" against real Postgres, run a second time on the actual merge commit (not just the PR head) |
| Cloud Build ID | `0222599a-f090-4b8d-8449-31a07ef4bdc7` (SUCCESS) |
| Artifact Registry image | `asia-south2-docker.pkg.dev/brand-tanmatra-tmg/wellness/wellness-foods:96bd810ec9220e3e432b96bcc2a8468d6b5e6848` |
| Immutable image digest | not independently queryable from this session (no direct Artifact Registry API access outside the GitHub Actions runner's credentials) — the SHA-tagged reference above is the identity actually used: Cloud Build mints exactly one image per unique commit SHA and the deploy step references that tag by name, so it is immutable-by-construction even without the raw `sha256:` manifest digest in hand |
| Cloud Run service / region | `wellness-foods` / `asia-south2`, project `brand-tanmatra-tmg` (confirmed from the deploy job's own `gcloud run deploy` invocation) |
| Cloud Run revision | `wellness-foods-00207-69p` |
| Previous stable (rollback target) | `wellness-foods-00206-j7l` — PR #15's revision, confirming an unbroken chain |
| Traffic allocation | 100% LATEST at 12:17:18Z (`currently wellness-foods-00207-69p`) |
| Deployment completion time | 12:17:24Z (`storefront-cloud-run`/`frontend-cloud-run` correctly SKIPPED — this PR touched only `artifacts/api-server`, `.github`, `docs`) |
| `/api/livez` smoke (deploy job's own check) | OK 12:17:20Z |
| `PLAN_CHECKOUT_DISABLED` in deploy env | `=1` present (unchanged) |
| `ORDER_FINALIZE_DISABLED` in deploy env | `=1` present (unchanged, now on its second revision) |

Rollback: `gcloud run services update-traffic wellness-foods --region asia-south2
--to-revisions wellness-foods-00206-j7l=100`.

### Post-deploy production probes (2026-08-09, read-only, no order created)

```
GET  https://tanmatra.food/api/livez                        → HTTP 200 {"status":"ok"}
GET  https://tanmatra.food/api/healthz                      → HTTP 200 {"status":"ok"}
POST https://tanmatra.food/api/subscriptions        {}      → HTTP 503 PLAN_CHECKOUT_TEMPORARILY_UNAVAILABLE
POST https://tanmatra.food/api/orders               {}      → HTTP 400 idempotency_key_required
POST https://tanmatra.food/api/orders/finalize      {}      → HTTP 503 CHECKOUT_TEMPORARILY_UNAVAILABLE
```

All five match the expected shape exactly: health is green, both containment
gates (`PLAN_CHECKOUT_DISABLED`, `ORDER_FINALIZE_DISABLED`) are enforced by
the live revision, and the storefront's real guest-checkout route
(`POST /api/orders`) answers with its normal idempotency-key requirement —
unaffected by either gate, exactly as designed. No order, payment attempt,
subscription, or entitlement was created by any of these probes.

### Paid-liveness invariant checklist — production-confirmed

Every item below is backed by a specific fix + test, and the deploy above is
the evidence that the fix is the code actually running:

```
[x] Client-controlled externalOrderId cannot prove settlement (§10 — real join, not string content)
[x] Identifier prefixes cannot promote order status (§10 — sub- prefix defect closed)
[x] Subscription settlement requires a server-owned cycle record (§10 — subscription_deliveries join scoped by userId)
[x] Credit settlement requires an atomic ledger record (orderClaims + credit ledger, userId-scoped since §10)
[x] Zero total without settlement evidence remains blocked (§10 — discount-minted ₹0 refused)
[x] Cross-customer settlement references are rejected (§10 — subscription and credit-claim branches both tested)
[x] Settlement references cannot be replayed across orders (unique constraints + §10's isNull(orderId) CAS)
[x] Partial settlement cannot release fulfilment (§10 test: non-zero remaining charge stays placed)
[x] Unpaid order cannot generate confirmation notification (§11 P0 — routes/checkout.ts)
[x] Unpaid order cannot deduct inventory (pre-existing WMS/BOM gates, §5; §11 follow-up closes the pipeline-processor side door)
[x] Unpaid order cannot reach POS preparation (placed excluded from the delivery ladder, §5)
[x] Unpaid order cannot receive a rider (dispatchOrder gate, §5; §11 P1 closes overrideAssignment's gap)
[x] Repeated callback releases fulfilment exactly once (payments.webhook.test.ts CAS, §6 row 8)
```

Two invariants this checklist does not cover, because they are enforced
structurally rather than by a paid-liveness check, and PR #16 did not touch
them: `update_order_status` cannot walk a terminal order backward (§11 P2 —
covered above under "identifier/status" fixes generally, not restated as a
separate row) and `finalizeOrder`'s order-hijack fix (§11 P3, `order_id_conflict`)
— both fixed, tested, and shipped in the revision above; listed in full in §11
rather than duplicated here.

### PR #16 vs. deployment vs. guest money-path — kept distinct

- **PR #16 CI**: PASS (verify run on branch head `2d0404f`, and independently
  re-verified by deploy.yml's own `gate` job on merge commit `96bd810`).
- **PR #16 production deployment**: PASS — revision `wellness-foods-00207-69p`
  confirmed serving 100% of traffic, health green, both containment gates
  live, per this section's evidence.
- **Guest money-path verification**: PENDING — the code path and its
  deployment are now both verified; the controlled guest order itself
  (§2, owner action) has not yet been executed. This session has no payment
  credentials and no way to complete Razorpay's OTP/2FA step, so it cannot
  place the order itself. See §2 for the procedure and §3 for the
  reconciliation checklist to run once it is placed.

**Guest à-la-carte checkout: GO on the code path, PENDING on execution.**
**Plan checkout: NO-GO — gated pending its own separate controlled
verification (§7).**
**Wave 2: HOLD pending the controlled guest order's reconciliation (§8).**
