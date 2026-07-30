# Batch 7 Grounding — RD Booking & Clinical Consult (G3)

> Reconciliation input for Route Briefs 40–43. Establishes, per route, the real
> backend contract and the logic that must survive wiring — written **before**
> any Stitch generation, following the pattern `BATCH-3-GROUNDING.md`,
> `BATCH-4-GROUNDING.md`, `BATCH-5-GROUNDING.md`, and `BATCH-6-GROUNDING.md` set.
>
> Per `BATCH-4-5-SCOPE.md`: the consult funnel that `/care/[condition]`
> (brief 20) and every "book a free RD consult" CTA point into. Batch 3
> polished the promise; this batch is the fulfilment. Clinical sensitivity
> here is the highest outside `/account/symptoms`.

## Route → real path map

| Route | Page | Main component(s) | Notes |
|---|---|---|---|
| `rd` | `app/rd/page.tsx` (38) | `RdCard` (54, ×N) | Server-rendered directory grid, ISR (1h) |
| `rd/[slug]` | `app/rd/[slug]/page.tsx` (~112) | `RdBooking` (135) | Profile + the one real money path in this batch |
| `clinical` | `app/clinical/page.tsx` (33) | `ProtocolView` (101) → `ProtocolDishRail`, `BenefitGrid`, `PlanCard`, `RdCard` | Shared template also used by `/performance` (not in this batch) |
| `coach` | `app/coach/page.tsx` (26) | `CoachChat` (114) → `CoachActionCard` (39) | Session-gated AI chat, `noindex` |

Every component is well under the 400-line `.tsx` cap.

## Contracts that must survive wiring

### `rd` — public directory, server-rendered, ISR

`lib/rdApi.ts`: `getRds()` → `GET /api/rd/directory`, public. Two render
branches only: empty/unavailable text, or the `RdCard` grid — no loading
state (server-rendered). `RdCard` is the one reusable directory-card shape,
also reused by `/clinical`'s "Talk to a specialist" section — any brief for
this route should treat it as fixed vocabulary, not invent a new card shape.

### `rd/[slug]` — profile + the batch's real money path

`RdBooking` (`components/rd/RdBooking.tsx`) is genuinely money-bearing:
session-kind pills → slot picker → book → (paid kinds) Razorpay checkout →
verify. The client never authors a price — every figure is server-quoted.
Distinct states: `needsAuth` (inline `PhoneAuth`, correct island pattern),
confirmed-booking, and the live form (three sub-states on the slot list:
loading / empty / populated). Error branches are handled explicitly per
cause (401, Razorpay-dismissed, 409-slot-taken, generic).

**Known limitation, not fixed in this batch**: `rdBookingApi.ts`'s own
header comment states the paid 30-/45-minute flow (checkout + verify) ships
on a not-yet-confirmed api-server branch (`583df88` / `rd-appointment-order`)
— only the free 15-minute intro is confirmed working on `main`. A brief
must not assume the full three-tier paid flow is live in production; the
UI already degrades gracefully (a real 4xx/5xx from an undeployed endpoint
surfaces through the existing generic-error branch), so no code change was
needed here, only documentation.

### `clinical` — shared protocol template, `PlanCard` money vocabulary

`ProtocolView` (`components/protocol/ProtocolView.tsx`) is a **shared
template** also driving `/performance` (out of scope). Structure: hero with
a live qualifying-dish/RD-count stat line, `BenefitGrid` (science pillars),
`ProtocolDishRail` (featured dishes), a `PlanCard` "program" section
(`id="steady"`), a conditional "Talk to a specialist" `RdCard` grid, a
conditional safety-disclaimer block, and a closing CTA section. `PlanCard` is
the one common money-card vocabulary this route shares with `/metabolic` and
`/care` (all three already shipped) — a brief for this route's "program"
section should stay visually consistent with that, not invent a new
pricing-card shape.

**Confirmed via the grounding pass**: every inbound "book a free RD consult"
CTA from already-shipped Batch 3 work (`/care/[condition]`'s `CONSULT_HREF`,
`/clinical`'s own `consultCta`) lands on plain `/rd` — unfiltered, no
condition/specialty query param. `CareRdRoster` (shipped on `/care`) is the
one place that deep-links a specific `/rd/[slug]`. **No route passes a
filter param into `/rd`** — a brief must not invent a "arrived from clinical
protocol, pre-filtered" state on the directory; it doesn't exist.

### `coach` — session-gated AI chat, streaming

`CoachChat` streams NDJSON via `streamCoachChat` (`lib/coachApi.ts`).
Three top-level states: loading (`user === undefined`), sign-in gate
(`user === null`, inline `PhoneAuth`), and the chat itself (empty-state
hint, message bubbles, inline `CoachActionCard`s per agent turn, composer).
`CoachAction` is a real discriminated union (`book_rd` / `add_to_cart`) —
`add_to_cart` deliberately routes to the dish PDP rather than fabricating a
cart line, since the server card carries a slug but not the numeric dish id
the cart needs (documented in the component's own comment; a brief should
preserve this "honest, no fabricated cart line" framing rather than design
a direct add-to-cart affordance from the chat).

## Defects fixed before design wiring

1. **`RdProfile.bookable` was declared, server-guaranteed, and never
   checked anywhere.** An RD marked not-bookable still rendered a full,
   functional "View profile" card on `/rd` and a live booking form on their
   own profile page — no "not accepting bookings" state existed at all.
   Fixed: `RdCard` now shows "Not currently accepting bookings" in place of
   the price/free-intro line when `!rd.bookable`; `RdBooking` now takes
   `bookable` as part of its `rd` prop and renders a dedicated "not
   currently accepting bookings" card instead of the interactive
   slot-picker/booking form.
2. **`/rd/[slug]` conflated a transient API outage with a genuinely
   nonexistent slug**, both collapsing to a hard Next.js 404 via
   `getRd()` → `null` → `notFound()`. A real dietitian's indexed profile
   page would 404 during an outage — worse than the directory's own soft
   "briefly unavailable" fallback. Fixed: added `getRdOrReason()` to
   `lib/rdApi.ts`, which distinguishes `"not_found"` (real 404, unchanged
   behavior) from `"unavailable"` (renders a "this profile is briefly
   unavailable" message with a 200, no 404). `getRd`/`getRds` are untouched
   — every other caller (`CareRdRoster`, `ProtocolView`,
   `generateStaticParams`) keeps its existing, lower-stakes behavior; only
   `/rd/[slug]`'s page and `generateMetadata` were switched to the new
   function, since that route is the one place the conflation produced a
   genuinely bad outcome (a hard 404 on a real, indexed URL).
3. **`CoachChat` silently dropped a mid-session 401.** On session expiry,
   the catch block set `user` back to `null` (correctly re-showing the
   sign-in gate) but `return`ed before ever calling `setError` — the user's
   just-sent message and an empty, unexplained agent bubble stayed in state
   with zero indication of what happened. Fixed: the 401 branch now also
   sets a clear error message, and the sign-in-gate render branch now
   displays it.
4. **`CoachActionCard` treated `premiumConsultsRemaining === 0` identically
   to `null`/`undefined`** via a bare truthy check (`consults ? ... : ""`),
   silently dropping the meaningful "you have zero free consults left"
   signal the type explicitly models as distinct from "unknown/inapplicable".
   Fixed: the check is now `consults != null`, so `0` renders its own
   sentence and only a genuine `null`/`undefined` omits it.

## Known limitations, deliberately not fixed (product decisions, not bugs)

- Paid RD consult flow (30-/45-minute) gated behind an unconfirmed
  api-server branch deploy — see `rd/[slug]` above.
- `RdProfile.hours?: unknown` is declared but has zero consumers anywhere
  in the storefront (repo-wide grep) — do not design an "office hours" UI
  element assuming it's populated.
- `BookRdAction.appointmentsHref` / `.reason` and `AddToCartAction.image` /
  `.quantity` / `.replaceSlug` / `.pricePaise` are all real, typed fields on
  the wire that `CoachActionCard` doesn't currently render — available for
  a brief to use, not assumed absent from the API, but not a defect that
  the current card omits them.
- `PhoneAuth` renders nothing (`return null`) when Firebase isn't
  configured for a given build — a pre-existing, deployment-dependent edge
  case shared by every route that embeds it across the whole storefront,
  not something introduced by or specific to this batch's four routes.
