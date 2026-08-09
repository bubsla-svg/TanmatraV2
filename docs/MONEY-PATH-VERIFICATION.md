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
  Kitchen fulfilment isolation: FAIL — unpaid "placed" order reaches the live
                                kitchen board (no payment filter in
                                KDS_BOARD_STATUSES) and dispatch queries also
                                include "placed"
  Controlled paid order:        BLOCKED pending fulfilment isolation
  Guest checkout verdict:       NO-GO FOR PROMOTION

PLAN MONEY PATH
  Add-on billing:               Reported fixed on main (create resolves, 422-guards
                                and bills plan_review add-ons); evidence to be
                                attached in the plan-verification pass
  Production availability:      Was live; GATED by owner decision (PR #12) —
                                GATE CONFIRMED LIVE IN PRODUCTION 2026-08-09
                                (probe evidence in §9)
  Decision:                     Gate new plan purchases pending independent plan
                                verification
  Plan checkout verdict:        NO-GO

HOLDS
  Real production order:        HOLD until the pre-order checklist below passes
  Wave 2:                       HOLD
```

**The acceptance criterion** (owner, verbatim): *"No order may become
operationally actionable until payment success or verified zero-charge
sponsorship is authoritative on the server."* The tester being able to pay
quickly is not a substitute for that invariant.

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
    promoter heals pre-invariant rows — settlement EVIDENCE required
    (redemption, subsidy row, or `sub-` first-cycle); a discount-minted ₹0 is
    never promoted (that is priced-free food nobody settled).

## 6. Pre-order checklist (all must pass BEFORE the controlled guest order)

```
[x] PR #11 API revision serves 100% traffic (revision evidence recorded — §9)
[ ] Unpaid orders excluded from actionable kitchen fulfilment
[ ] Abandoned-payment test passes (order stays awaiting payment, kitchen sees 0)
[ ] Failed-payment test passes (fulfilment blocked, entitlements released)
[ ] Unresolved-payment test passes (blocked; status recheck restores attempt)
[ ] Successful payment releases fulfilment exactly once
[ ] Repeated callback: one order, one release, one ticket, one notification
[ ] Sponsored zero-charge: one confirmed order, one release, one ticket
[ ] Firebase sign-in smoke test (no OTP capture; returnTo + cart + quote intact)
```

Automated coverage now pinning rows 2–8 (each box flips to `[x]` when the
fulfilment-isolation PR is merged, CI-green, and its deploy revision evidence
is recorded here):

| Scenario | Test |
|---|---|
| Unpaid excluded from kitchen | `ops.kds.test.ts` (board absence + ready-refusal on `placed`) |
| Abandoned / failed / unresolved payment | `dispatch.paidGate.test.ts` (dispatch refusal, sweep exclusion, no SLA stamp); `reconciliationScheduler.test.ts` (authorized-only and wrong-amount stay `placed`) |
| Success releases exactly once | `payments.webhook.test.ts` + `reconciliationScheduler.test.ts` (guarded CAS — one of webhook/sweep wins) |
| Repeated callback duplicates nothing | `payments.webhook.test.ts` (event dedup + CAS) |
| Sponsored zero-charge | `reconciliationScheduler.test.ts` promoter suite (settled promotes; discount-minted ₹0 refused) |
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
