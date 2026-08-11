# Service and authority map

Where each authoritative decision (pricing, tax, allergen safety, payment, capacity,
entitlement) is actually computed, and whether the frontend stays inside that
boundary. Verified against source, not inferred from naming.

## Money path (à-la-carte and plan)

**Boundary holds for the happy path.** `lib/moneyPath.ts` never sends a price —
`runCheckout`/`runAlacarteCheckout` create the order/subscription server-side first,
then request a Razorpay order **by id only** (`createRazorpayOrder({orderId,
subscriptionId})` / `createRazorpayOrder({orderId})`), and the server
(`artifacts/api-server/src/routes/payments.ts:221-386`) re-derives the amount from
`ordersTable.chargePaise ?? ordersTable.totalPaise` — a client-supplied
`amountPaise`, if sent, is logged as a mismatch and ignored, never trusted.

**Boundary breaks at zero-payable.** The server explicitly guards
`POST /payments/razorpay/order` against non-positive amounts:

```
if (!Number.isInteger(authoritativePaise) || authoritativePaise <= 0) {
  res.status(409).json({ error: "order has no payable amount" });
}
```

...and separately computes `settled: chargePaise === 0` when a subscription's first
cycle is fully covered by bridge/ledger credit
(`artifacts/api-server/src/routes/subscriptions.ts:508-517` —
`createOrderForNewSubscription`). **The client never reads this.**
`finishPlanPayment`/`finishAlacartePayment` (`lib/moneyPath.ts:142`, `:240`) call
`createRazorpayOrder` unconditionally after order/subscription creation — there is
no branch on the created order's payable amount. `CreateSubscriptionResponse`
exposes `bridgeCreditPaise` and `creditAppliedPaise` (from which the client *could*
derive zero-payable) but no `chargePaise`/`settled` field, and no caller does that
arithmetic (correctly, per CLAUDE.md's "server owns every amount" — client
arithmetic on price is the wrong fix here regardless).

**Net effect**: a customer whose subscription is fully covered by credit hits the
server's 409 the moment `PlanCheckout.tsx`'s `handlePay` reaches
`finishPlanPayment`, and the generic catch-all (`"Something went wrong. Please try
again."`) is the only thing they see — even though their subscription was already
created successfully. See `defects.md` DEF-RECON-ZEROPAYABLE-001 (CRITICAL — revenue
path, §12 of the sweep spec).

Authority for a **positive** payable amount is intact end to end: create →
Razorpay order → modal → `verifyWithRetry` (bounded retries) →
`UnresolvedPaymentPanel` as the terminal state if verify is exhausted after capture
— confirmed in `moneyPath.ts` and `PlanCheckout.tsx`.

## Marketplace payment

**Both ends of the contract exist; nothing connects them.**

- Server: `POST /marketplace/checkout` (`artifacts/api-server/src/routes/marketplace.ts:252`,
  behind `idempotencyMiddleware`).
- Client: `lib/marketplaceApi.ts` exports `checkout()` and `payForMarketplace()` —
  the latter runs the identical create-order → Razorpay-order → modal → verify
  sequence as the main money path, and is covered by
  `lib/marketplaceApi.test.ts` (`"payForMarketplace: checkout → razorpay order →
  open → verify, in order"`).
- **Caller: none.** No active component imports `checkout` or `payForMarketplace`.
  `components/checkout/AlacarteCheckout.tsx:71` carries a comment — `"items ship
  through their own product-page checkout (payForMarketplace)"` — confirming this
  was the intended design (marketplace items were meant to bypass the main cart
  checkout via their own PDP flow), but no marketplace PDP or cart surface actually
  calls it. Marketplace items **do** add to the shared cart
  (`cartStore.ts`'s `kind: "dish" | "marketplace"`), so a customer can add a
  marketplace item to cart today — what happens to that line at `/checkout` was not
  traced further in this pass (§9's "marketplace and dish item types must not be
  silently mixed and then filtered out at checkout" needs a follow-up read of
  `AlacarteDetails.tsx`'s order-building step before this can be marked verified
  either way).

Per §9: since a live server caller does exist (`payForMarketplace` is a real,
tested function, not vaporware), the correct fix is **wire the existing caller**,
not remove the marketplace add-to-cart entry point. See `defects.md`
DEF-RECON-MARKETPLACE-001.

## Group orders

**Full lifecycle exists on both ends; the entry-point screen is a placeholder.**

- Server: `POST /group-orders` (create), `GET /group-orders/:code` (read),
  `POST /group-orders/:code/items` (add item), a third `POST` at line 209 (not
  read — likely remove-item), `POST /group-orders/:code/close` (host closes and
  presumably triggers pay) — 5 endpoints,
  `artifacts/api-server/src/routes/groupOrders.ts`.
- Client: `lib/groupOrdersApi.ts` — `getGroup`, `addItem`, `removeLine`,
  `closeGroup`, `groupSubtotalPaise` — tested in `groupOrdersApi.test.ts`.
- **Route: `/group/[code]/page.tsx` is `PlaceholderPage`** (see
  `route-reconciliation.md`). `addItem` is the only function with a confirmed
  active caller (`components/cart/AddToCart.tsx`) — meaning a customer can join a
  group and add an item from some other surface, but has nowhere to view the
  group's shared cart, see other participants, or — critically — for the host to
  close the group and pay. **This is a partial, exposed revenue journey**: intent
  can be captured (add-to-group) with no way to complete it. Per §9 ("if only
  fragments exist, do not expose a partial revenue journey"), the `AddToCart.tsx`
  join path should be reassessed once `/group/[code]` is built or gated, not left
  live on its own. See `defects.md` DEF-RECON-GROUPORDER-001.

## Allergen and dietary safety

Server-side strict gate confirmed at subscription creation
(`artifacts/api-server/src/routes/subscriptions.ts`,
`validateDishForSubscription` → `evaluateDishForPreferences(dish, prefsRow, {
strict: true })`, decrypt-on-read against KMS-encrypted clinical fields) — not
re-derived client-side. `artifacts/storefront/lib/menuFilters.ts` (the 5.3 filter
sheet) explicitly documents itself as display-only and not a safety gate (see its
top-of-file comment, confirmed in the prior session's work). Consistent with §2.4.

## Care-condition content authority

**No allowlist gate on the live route — confirmed, not assumed.**
`app/(global)/care/[condition]/page.tsx` resolves display copy via
`conditionDisplayName()` (`lib/conditionDisplay.ts`), a **pure display-casing
function with no allowlist check** — any slug title-cases and renders. A real,
separate allowlist (`lib/careConditions.ts`'s `CARE_CONDITIONS`, 6 entries) exists
and is used **only** by `/care`'s `ConditionRail` (the directory/index page), not by
the `/care/[condition]` detail route itself. There is no `notFound()` call, no
allowlist check, and no test file for invalid/arbitrary/offensive slugs at this
route (checked: no `care-condition`-named spec exercises an invalid slug on
`/care/[condition]` itself — the existing specs cover `/care` index and the
assessment-entry component).

**This is a documented, deliberate product ruling, not an oversight** —
`lib/careConditions.ts`'s own comment states: "/care/[condition] is a free-text
catch-all with no fixed list, and the ruling forbids a new fetch surface here." But
that ruling directly conflicts with §13 of this sweep's own operating rules
("Unknown or unapproved condition → controlled not found... Condition routes must
not synthesize therapeutic copy from arbitrary URL slugs... Do not generate
clinical claims dynamically from route text") — the live route renders "RD-crafted
therapeutic meal plan designed specifically for {name} management" and a fixed
"Clinical Objectives" list for **any** input, e.g. `/care/asdfqwerty` renders
"Asdfqwerty Protocol" with the same clinical-sounding boilerplate. Recorded as a
governance conflict rather than silently picking a side — see `defects.md`
DEF-RECON-CARECONDITION-001 (CRITICAL per this sweep's clinical-safety rule; the
prior product ruling is real and must be resolved by product/clinical ownership,
not overridden unilaterally by this sweep).

## Trial CTA / cart-fallback dependency

`components/trial/TrialStart.tsx`'s only purchase CTA is gated
`{cart.lines.length === 0 && (...)}`, with an explicit comment: "once a line
exists, MiniCartBar owns the bottom edge." `/trial` lives under
`app/(focus)/trial/page.tsx` → `FocusLayout`, which — confirmed by reading the full
layout file — renders **no** `MiniCartBar`, by design ("Each flow owns its full
canvas and bottom edge"). **Net effect**: a customer who arrives at `/trial` with
one or more items already in cart (e.g. added a dish from `/menu` first) sees no
purchase CTA on the page at all — not the trial button (suppressed by the cart
check) and not `MiniCartBar` (never mounted in this layout). Confirmed dead end.
See `defects.md` DEF-RECON-TRIALCTA-001 (CRITICAL — §15 "revenue CTA terminates
without a valid outcome").

## Pantry scan → subscription

`components/wellness/PantryVisionScanner.tsx` (active, wired into
`/account/wellness` via `WellnessHub.tsx`) has a real scan pipeline
(`scanPantryVision` in `lib/wellnessApi.ts`) that renders detected ingredients and
AI-suggested add-ons. Each suggested add-on's **"Add to Subscription" button has no
`onClick` handler at all** (line 104-107 — a bare `<button>`, no event binding,
no mutation call). Confirmed inert, not merely unstyled. See `defects.md`
DEF-RECON-PANTRY-001.

## Custom-plan pricing (Journey 4)

The active `/custom-build` route is titled "Order Customization & Macro Build Hub"
and its `CustomBuildHub.tsx` is a **per-dish customization/add-to-cart builder**
(bread/sauce/portion-size options, `previewCustomizations` display-priced only,
re-priced server-side at `POST /orders` — correct authority posture for what it
actually does) — not the required 12-stage custom-**subscription-plan** wizard
(goal → routine → ... → generated-plan → pre-checkout-questions). No fabricated
custom-plan total exists because **no custom-plan pricing surface exists at all** —
the whole Journey 4 wizard is `MISSING_IMPLEMENTATION` (§11), not a
pricing-authority violation. See `stitch-code-matrix.md` (7.2–7.10) and
`defects.md` DEF-RECON-JOURNEY4-001.

## Plan-checkout gate

`/plan/[planId]/page.tsx` routes a blocked plan (`!planIsSelfServiceLaunchable(id)`)
or an explicit `?waitlist=1` to `<Waitlist>`, and only a launchable plan to
`<PlanBuilder>` — the zero-dead-end branch lives server-side in the route, not the
client, per the required posture. `PLAN_CHECKOUT_DISABLED` was confirmed in the
prior audit (Addendum, Correction 2) to be a deliberate, documented gate, not an
accidental block. This sweep did not re-derive the gate's acceptance-criteria
checklist (active quote / capacity reservation / idempotent conversion / etc.) from
scratch — it inherits the prior audit's verified conclusion that the gate is real
and should stay closed until proven, and adds one new fact: Journey 2's actual
configuration UI (6.2–6.7) does not exist yet, so the gate is currently
correct-by-necessity regardless of the money-path proof separately from it.
