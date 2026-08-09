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
[ ] Sponsored zero-charge: one confirmed order, one release, one ticket (evidence
    rewritten to a real join, §10 — CI green on PR #15 branch commit 9a5a2dd, run
    31306524106; pending merge + production deploy revision evidence)
[ ] Firebase sign-in smoke test (no OTP capture; returnTo + cart + quote intact)
[ ] Browser-controlled identifiers cannot prove financial settlement (fix + tests
    written and CI-verified on PR #15, §10; pending merge + production deploy)
```

PR #15's CI history, for the record: Verify run [31306304884](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31306304884)
on commit `e8912a8` (the original fix) FAILED — a real Postgres unique-constraint
violation in a test fixture, not the production code (see §10's "test-fixture bug"
note). Fixed in commit `9a5a2dd`; run [31306524106](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31306524106)
passed, including the money-integration job's real-Postgres execution of every
forged-prefix / cross-customer / partial-settlement test. This is exactly the
"run it against real Postgres" bar the acceptance criterion requires — not
merely proposed, actually cleared, on that commit. A further commit on the same
PR adds an additional fix an adversarial audit surfaced afterward (§10); the
final commit's own CI run is the one whose evidence belongs in the checklist
above once it passes.

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
