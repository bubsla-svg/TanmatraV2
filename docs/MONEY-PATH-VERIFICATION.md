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

## 4. GO / NO-GO — guest à-la-carte checkout

**Status: PENDING the §2 test order.** Criteria:

- **GO** = order placed, paid, confirmed, tracked; reconciliation table all ✅.
- **NO-GO** = any step fails → capture evidence, checkout stays as-is (it is
  already live; a NO-GO means prioritized fixing, not un-launching — the
  path was broken for every customer before today either way).

Decision recorded: ______________________ (date, by owner)

## 5. Subscription (plan) checkout — status correction

Two findings that supersede older docs:

1. **It is NOT blocked in production.** `/checkout?plan=desk_fuel` renders the
   live PlanCheckout flow ("Start your Desk Fuel plan…") because the same
   `NEXT_PUBLIC_LIVE_CHECKOUT=1` arms it and `FLAG_PLAN_V2=true` is set on the
   api-server. The instruction "keep subscription checkout blocked" describes
   a state that does not exist; blocking it would be a new code change.
2. **The add-on billing gap cited against it is already fixed.**
   `LIVE-CUTOVER.md` §5.2 ("create accepts addOns but never bills them") is
   stale: current `routes/subscriptions.ts` resolves add-ons at create, 422s
   disallowed ones, and bills them (`pricePerDeliveryPaise = q.cycleTotalPaise
   + planReviewAddOnPaise`). Display equals charge, as CLAUDE.md states.

With PRs #9 (unresolved-payment terminal state), #10/#11 (create idempotency
both legs) deployed, the plan leg's money-safety posture now equals the guest
leg's. Remaining known gaps are UX/scope (no zero-payable activation — clear
409 by owner decision; evening-add attach endpoint absent — offer is
confirmation-screen only). **Owner decision required:** leave plan checkout
live as-is, or gate it pending its own controlled test purchase. Engineering
recommendation: leave it live and run a controlled plan purchase as the next
verification, same protocol as §2.

## 6. Wave 2 gate

Per owner direction, Wave 2 (Manage-Delivery client: swap / reschedule /
window / add-item sheets over the already-shipped server endpoints) begins
only after §4 is filled in.
