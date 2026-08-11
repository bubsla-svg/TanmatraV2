# P0-3 — Scheduled orders show their confirmed date/window, not a fake countdown

## The bug

`GET /orders/:externalOrderId/status` (`artifacts/api-server/src/routes/checkout.ts`)
computed `etaMinutes = max(0, 25 - minutes since order.createdAt)` for **every**
order, unconditionally. This powers both `/track/[orderId]` (`TrackStatus.tsx`)
and the post-payment confirmation screen (`/order/confirmed/[orderId]`) via the
shared client `lib/orderStatus.ts`.

For an on-demand order this is correct — it's the live-kitchen SLA. For a
scheduled subscription delivery it's nonsense: a meal scheduled for three days
from now would show "0 min" the moment the SLA window elapses, or a
steadily-counting-down number that has nothing to do with when the meal
actually arrives.

## What schedule/delivery data already existed

- `orders.scheduledFor` (`lib/db/src/schema/orders.ts`) — a nullable timestamp
  column that **looks** like the obvious signal to branch on. It is not: grep
  confirms **neither order-creation path ever writes it**.
  `createFirstCycleOrder` (`artifacts/api-server/src/lib/subscriptionOrigination.ts`)
  and the cycle-2+ writer in `artifacts/api-server/src/lib/chargeMandate.ts`
  both insert into `ordersTable` without a `scheduledFor` field. A fix that
  branched on `orders.scheduledFor IS NULL` would have silently done nothing —
  every subscription order has it null too, same as a true on-demand order.
- `subscription_deliveries.scheduled_for` and `.delivery_window`
  (`lib/db/src/schema/subscriptions.ts`) — both `NOT NULL`, and this is where
  the real schedule actually lives. The link back to the order is
  `subscription_deliveries.order_id`, set by **both** writers above in the
  same transaction that creates the order (`createFirstCycleOrder`:
  `tx.update(subscriptionDeliveriesTable).set({ orderId: order.id })`;
  `chargeMandate.ts`: same pattern for the cycle-2+ mandate charge).

So the correct signal is a `LEFT JOIN subscription_deliveries ON
subscription_deliveries.order_id = orders.id`, not a column on `orders`
itself.

## A side note on scope: cycle-2+ orders don't reach this code today anyway

`chargeMandate.ts`'s recurring-charge order is created with
`status: "billed"` — deliberately off the delivery ladder
(`orderStatusLadderRank.billed = null`) and outside `TRACKABLE_STATUSES`
(`lib/orderStatus.ts`). The ETA/schedule section on both the tracker and the
confirmation screen is gated on `trackable`, so it never rendered for a
cycle-2+ order regardless of this fix — that's a separate, pre-existing gap
(should those be trackable at all?) that this PR does not touch. The
concretely-reachable bug this fixes is the **first-cycle** subscription order
(`createFirstCycleOrder`, status `placed`/`preparing` — both trackable), which
is exactly the one a customer sees immediately after starting a plan.

## The fix

`GET /orders/:externalOrderId/status` now returns a `timing` discriminator:

| `timing` | When | `etaMinutes` | `scheduledFor` / `deliveryWindow` |
|---|---|---|---|
| `"on_demand"` | No linked subscription delivery | the existing 25-min countdown, unchanged | `null` |
| `"scheduled"` | A linked `subscription_deliveries` row exists | `null` | the delivery's confirmed date + window |
| `"pending"` | `externalOrderId` starts with `sub-` (the convention both writers use) but no delivery is linked yet | `null` | `null` |

`"pending"` is a defensive branch, not a currently-reachable one — both
writers link the delivery in the same DB transaction that creates the order,
so there's no real window for an unlinked `sub-*` order to exist. It's there
so a future writer that breaks that invariant fails honestly (a "confirming
your delivery time" state) instead of this endpoint falling through to a
countdown that would be just as wrong as the bug being fixed here.

**Scope decision**: the only currently-existing "scheduled, non-on-demand"
order type in this codebase is a subscription delivery. If a future feature
adds another kind of scheduled order (e.g. a directly-scheduled à-la-carte
order using `orders.scheduledFor` for real), it will need its own signal —
this fix does not speculatively handle that.

## Changed

- **Server** (`checkout.ts`): the status query now left-joins
  `subscription_deliveries`; response gains `timing` (and `scheduledFor`/
  `deliveryWindow` are populated only when `timing === "scheduled"`).
- **Client** (`lib/orderStatus.ts`): `OrderStatus` gains `timing: "on_demand" |
  "scheduled" | "pending"`; `etaMinutes` is now `number | null`. An
  unrecognised/missing `timing` falls back to `"on_demand"` with whatever
  `etaMinutes` came through (or 0) — the well-understood case, never a guessed
  schedule.
- **UI** (`components/track/TrackStatus.tsx`, `app/(focus)/order/confirmed/[orderId]/page.tsx`):
  both render three states now — the existing countdown, a "Scheduled for
  \<date> · \<window>" block, or a "Confirming your delivery time" notice —
  gated the same way the countdown always was (`trackable`, i.e. the order
  hasn't settled).

## Verification

- `pnpm run typecheck:libs` then `pnpm --filter @workspace/api-server run typecheck`
  and `pnpm --filter @workspace/storefront run typecheck` — all clean.
- `lint:tokens` — passes.
- Full storefront unit suite (`node --test --import tsx "./lib/**/*.test.ts"`
  from `artifacts/storefront`) — 635/635 pass, including four new/updated
  `orderStatus.test.ts` cases covering `scheduled`, `pending`, the
  on-demand-default fallback, and an unrecognised `timing` value.
- New `artifacts/api-server/src/routes/checkout.orderStatus.test.ts` covers
  all three `timing` branches against a real Postgres (on-demand order,
  scheduled subscription delivery 3 days out, an unlinked `sub-*` order, and
  the pre-existing 404 case). **Needs a live Postgres — not run in this
  sandbox** (no `DATABASE_URL`); verify before merge:
  `DATABASE_URL=... node --test --import tsx ./src/routes/checkout.orderStatus.test.ts`
  (from `artifacts/api-server`).
