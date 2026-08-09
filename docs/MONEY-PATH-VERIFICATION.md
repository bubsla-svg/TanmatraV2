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
  PR #11:                       Deployment verification pending revision evidence
                                (merge SHA 11753a2; CI green incl. 4 idempotency
                                integration tests; record Cloud Build ID, image
                                digest, Cloud Run revision, traffic allocation,
                                completion time when the deploy run finishes)
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
  Production availability:      Was live; GATED by owner decision (this change)
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
  queues)**: scoped as its own change; seam research in progress. Design rule
  per owner: order records may exist pre-payment for recovery, but fulfilment
  release requires server-authoritative payment success or verified
  zero-charge sponsorship — enforced in the ready-transition/dispatch
  predicates, not merely board display.

## 6. Pre-order checklist (all must pass BEFORE the controlled guest order)

```
[ ] PR #11 API revision serves 100% traffic (revision evidence recorded)
[ ] Unpaid orders excluded from actionable kitchen fulfilment
[ ] Abandoned-payment test passes (order stays awaiting payment, kitchen sees 0)
[ ] Failed-payment test passes (fulfilment blocked, entitlements released)
[ ] Unresolved-payment test passes (blocked; status recheck restores attempt)
[ ] Successful payment releases fulfilment exactly once
[ ] Repeated callback: one order, one release, one ticket, one notification
[ ] Sponsored zero-charge: one confirmed order, one release, one ticket
[ ] Firebase sign-in smoke test (no OTP capture; returnTo + cart + quote intact)
```

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
