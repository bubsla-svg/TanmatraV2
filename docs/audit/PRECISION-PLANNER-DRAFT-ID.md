# Precision Planner — authoritative draft identifier, no silent bounce

## The bug

`POST /wellness/precision-planner/generate` (`artifacts/api-server/src/routes/wellness.ts`)
computed a 7-day thali plan and returned it inline: `res.json({ plan })`. The
plan never left the caller's React state
(`artifacts/storefront/components/wellness/PrecisionMealPlanner.tsx`) — no id,
no persistence, nothing the server could look up again.

The results screen's checkout CTA
(`artifacts/storefront/components/wellness/PrecisionPlanResults.tsx`) linked
to `/checkout?plan=7day_precision&price=<client-computed total>`. Two
independent problems followed from that:

- **Silent middleware bounce.** `7day_precision` is not, and has never been,
  a key in `PLAN_CATALOG` (`lib/subscription-rules`). Checkout's own guard —
  `const id = plan && plan in PLAN_CATALOG ? (plan as PlanId) : null; if (!id)
  redirect("/plans")` (`artifacts/storefront/app/(focus)/checkout/page.tsx`)
  — silently discarded the entire generated plan and dropped the customer on
  the generic `/plans` page with no explanation of what just happened. This
  is the "silent middleware bounce" referenced in the task: a real code path
  that looked wired up but was structurally unreachable.
- **Client-supplied price.** Even if `7day_precision` had been a real plan
  id, the link carried `price=<value computed in the browser>` as a query
  param. Nothing server-side ever priced a "precision plan" — there was no
  contract to bill from, so this would have been a second, independent money-
  path defect on top of the routing dead end.

Neither problem is a "wire it up wrong" bug — there was never an authoritative
server-side concept of "a generated precision plan" for anything downstream
to reference. The plan was a value in memory and nothing else.

## What existed already

The codebase already has one system for exactly this shape of problem: opaque
guest-ownable server-side drafts. `lib/planDraftAuth.ts` +
`plan_drafts` (subscription builder drafts) establish the pattern — random
opaque id, httpOnly guest-ownership cookie while unauthenticated, claim-on-
sign-in, 404 (never 403) on any access that doesn't check out so ownership is
never leaked through status code.

That existing table doesn't fit here: `plan_drafts` rows are a builder's
in-progress *configuration* (diet track, cycle, add-ons) that a customer
edits step by step before checkout ever prices it. A precision-planner result
is the opposite shape — computed once, atomically, from a BMR/TDEE
questionnaire, and never edited in place. Force-fitting the planner into the
builder-draft schema would have meant adding planner-only nullable columns to
a table another feature owns, or a second interpretation of what a "plan
draft" is. Instead this PR adds a small parallel table with the same security
shape, not a shared one:

- `precisionPlanDraftsTable` (`lib/db/src/schema/wellness.ts`) — `id` (opaque,
  32 random bytes hex), `userId` (nullable, set on claim), `input`/`result`
  (jsonb, typed), `createdAt`, `expiresAt`.
- `artifacts/api-server/src/lib/precisionPlanDraftAuth.ts` — a standalone
  mirror of `planDraftAuth.ts`'s cookie/ownership helpers: own cookie name
  (`precision_plan_draft_id`), own 14-day TTL
  (`PRECISION_PLAN_DRAFT_TTL_MS`), same `resolvePrecisionPlanDraftAccess`
  shape (`{ok:true}` / `{ok:false, status:404}`, matching by `userId` once
  claimed, else by cookie).

## The fix

`POST /wellness/precision-planner/generate` now persists the computed plan as
a draft row (guest cookie set when unauthenticated) and returns
`{ plan, draftId }` instead of `{ plan }`. Two new routes make the draft an
addressable, ownership-checked resource instead of a one-shot response:

- `GET /wellness/precision-planner/drafts/:id` — resolve a previously
  generated draft (reload, or after a sign-in redirect) instead of forcing
  the customer to redo the BMR/TDEE quiz. 404 on expired/unknown/foreign,
  same as the existing plan-draft pattern.
- `POST /wellness/precision-planner/drafts/:id/claim` — auth required,
  CAS-guarded (`isNull(precisionPlanDraftsTable.userId)` in the `WHERE`)
  claim of an unclaimed guest draft. 409 if it raced and got claimed
  elsewhere, 404 if it belongs to someone else.

The storefront mirrors the id into the URL (`?draft=<id>`) on generate, so a
reload resolves the same draft via `GET .../drafts/:id` rather than losing it
(`PrecisionMealPlanner.tsx`).

**The checkout hand-off no longer references a plan id that doesn't exist.**
`PrecisionPlanResults.tsx`'s CTA now adds the plan's real dishes — the same
dish ids, prices, and macros the menu itself serves — to the existing cart
(`addOrUpdateQty` from `lib/cartStore.ts`, deduplicated and summed across all
7 days) and routes to `/checkout?mode=alacarte`. That is the existing,
already-server-priced à-la-carte checkout: no new money path, no new plan
concept, no redirect that silently eats the customer's answers. The `draftId`
is not itself sent anywhere in this PR (there is no server-side "precision
plan order" to link it to) — its only job here is proving the round trip
survived; see Residual risk below.

## Residual risk / explicitly out of scope

- **No migration file generated.** `drizzle-kit generate` requires
  `DATABASE_URL`, which is unset in this sandbox — the command fails
  immediately on load. CI's `money-integration` job provisions a throwaway
  Postgres and runs `pnpm --filter @workspace/db run push-force` (schema-diff
  push, not versioned migrations), so `precisionPlanDraftsTable` should be
  picked up automatically for any DB-backed test run. A real migration still
  needs to be generated against a live `DATABASE_URL` before this ships to an
  environment that runs versioned migrations instead of `push-force`.
- **The draft is not linked to any order.** Adding the plan's dishes to the
  cart is a snapshot at add-to-cart time — if menu prices change between
  "Checkout 7-Day Plan" and actual payment, the customer pays the cart's
  (current, correct) price, not the `totalPlanPricePaise` shown on the
  results screen. That's the same behavior as adding any other dish to the
  cart from anywhere else in the storefront, not a new inconsistency this PR
  introduces — flagged here only because the precision-planner screen is the
  first place that number is shown as a plan total rather than a per-dish
  price.
- **No route currently reads `getPrecisionPlanDraft`'s persisted `draftId`
  after checkout** (e.g. for attribution/analytics tying an order back to the
  quiz that produced it). Out of scope for this fix, which is specifically
  "stop discarding the plan and stop bouncing the customer silently" — not
  "build plan-to-order attribution."
