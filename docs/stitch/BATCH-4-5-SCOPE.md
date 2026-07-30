# Stitch Batches 4–5 — scope, and where the design system actually stands

Batches 1–3 were briefed in writing before they were built. Batches 4 and 5 were
not: until this document they existed only as two one-line entries in a task
list ("internal ops / admin ERP", "auxiliary & stubs"), which is why "how far
from done?" had no answer for most of the surface. This is the missing artefact.

**No design work here.** No Stitch generation, no code. This is an inventory, a
correction of the recorded status, and the decisions an owner has to make before
Batch 4 can be briefed at all.

## Method, and what is trustworthy

Route count comes from `find app -name page.tsx` — **68 routes**. Per-route
weight is the page plus every `@/components/*` module it imports directly,
counted in lines; it is a proxy for how much surface a redesign touches, not a
promise.

Adoption status comes from the repo's own convention: a component restyled
against a brief cites it in its docstring (`Stitch brief 14`, `route-05`, …).
39 files carry such a citation.

> **A rejected method, recorded so nobody repeats it.** The first pass measured
> adoption by counting design-system marker classes (`rounded-3xl`,
> `rounded-full bg-gold`, `tabular`). It is invalid: those markers are Batch 3's
> landing-kit vocabulary, so the heuristic scored `/account/orders` — verified
> Batch 2 work — at **zero**. Marker density distinguishes *which* batch touched
> a file, not *whether* one did.

## Corrected status of briefs 01–20

Two entries were recorded wrongly and are fixed here.

| Brief | Route(s) | Status | Evidence |
|---|---|---|---|
| 01 | `/` | adopted | `Section01ClinicalHero` cites brief 01 |
| 02 | `/menu` | adopted | `DishCard` cites "Route Brief 02 v3, owner-confirmed" |
| 03 | `/dish/[slug]` | **brief unused** | no citation anywhere; the PDP was built by the separate "PDP depth" track (P1–P3) instead |
| 04 | `/checkout` | **not adopted** | no citation; `CheckoutAddress` only references "found during the Stitch restyle" (a bug note) |
| 05 | `/plans`, `/plan/[planId]` | adopted, both screens | `PlanCardStitch` + `PlanBuilder` both cite route-05 |
| 06 | `/meal-planner` | **not adopted** | zero citations under `components/mealplan` |
| 07 | cart drawer | adopted | `CartDrawer` + `MiniCartBar` carry the "Stitch dark scope" treatment |
| 08–13 | the six `/account` routes | adopted | all six cite route-08 … route-13 |
| 14–20 | 10 acquisition surfaces | adopted | all cite briefs 14–20 |

**Corrections:** brief 05 was recorded as "designed only" — it is fully wired,
both screens. Brief 03 was recorded as "live" — the *route* is built and good,
but its brief was never used, so `/dish` is not design-system-consistent by the
same standard as the others.

**So: 20 briefs exist, 17 are adopted. The real gap in Batches 1–3 is three
routes — `/checkout`, `/meal-planner`, and reconciling `/dish` with brief 03.**

## The 45 routes that have never been briefed

Grouped by the coherent design problem they share, with total weight in lines.

### G1 · Account depth (7 routes, ~1,100 lines)
`account/addresses` 201 · `account/subscriptions` 192 · `account/symptoms` 172 ·
`account/appointments` 152 · `account/billing` 143 · `account/loyalty` 112 ·
`account/history` 110

Batch 2 designed six `/account` routes and stopped; these seven are the rest of
the same hub, reachable from the tiles Batch 2 restyled. **The most visible
inconsistency in the product today** — a customer moving from `/account/orders`
to `/account/billing` crosses a design boundary mid-hub. Batch 2's vocabulary
already fits; this is application, not invention.

### G2 · Corporate / group commerce (6 routes, ~840 lines)
`corporate` 356 · `corporate/[slug]/lunch-planner` 115 · `office-lunch/[id]` 108 ·
`corporate/[slug]` 105 · `group/[code]` 137 · `corporate/invite/[token]` 85

Multi-actor flows (host, invitee, HR admin) with real money paths. `/corporate`
at 356 lines is the largest unbriefed route. Batch 3 already built the B2B
acquisition front door (`/corporate-wellness`); this is what happens after a
company signs, so it inherits that vocabulary but needs its own briefs.

### G3 · RD booking & clinical consult (4 routes, ~600 lines)
`rd/[slug]` 228 · `clinical` 136 · `coach` 138 · `rd` 94

The consult funnel that `/care/[condition]` (brief 20) and every "book a free
RD consult" CTA point into. Batch 3 polished the promise; the fulfilment is
unbriefed. Clinical sensitivity here is the highest outside `/account/symptoms`.

### G4 · Community & content (9 routes, ~1,150 lines)
`challenges/[slug]` 217 · `meal-guides/[dishSlug]` 154 · `qa` 131 ·
`team/[slug]` 125 · `recipes` 119 · `recipes/[slug]` 119 ·
`challenges/tracker` 113 · `challenges` 92 · `team` 83

Editorial and UGC surfaces. Lower commercial risk, high volume, and a natural
place to define the content/article vocabulary the kit currently lacks.

### G5 · Conversion & onboarding (6 routes, ~880 lines)
`order/confirmed/[orderId]` 228 · `trial` 185 · `quick-setup` 181 ·
`custom-build` 152 · `track/[orderId]` 116 · `login` 115

Money- and identity-adjacent. `order/confirmed` and `track` are post-purchase
surfaces every paying customer sees. Should be briefed **with** `/checkout`
(brief 04) as one coherent pass — splitting the purchase funnel across batches
is how it drifted in the first place.

### G6 · Secondary marketing & standing pages (11 routes, ~1,260 lines)
`marketplace/[slug]` 163 · `wellness` 144 · `premium` 137 · `performance` 135 ·
`vouchers` 132 · `marketplace` 123 · `faq` 117 · `about` 108 ·
`subscription/bridge` 87 · `legal/[slug]` 85 · `legal` 33

Mostly static or near-static; `legal` and `legal/[slug]` are close to trivial.
The genuine work here is `marketplace` (a second commerce surface with its own
checkout integration) and `subscription/bridge`.

### G7 · Ops (1 route, 110 lines)
`kitchen`

The storefront's **only** internal surface. Audited separately: the boundary is
a router-wide `router.use` ops gate in `routes/ops.ts`, regression-tested by
`routes/ops.gate.test.ts` (which asserts every route on the router refuses an
unauthenticated caller), and it is CI-reachable via `verify.yml`. Its only
design debt is cosmetic — it inherits marketing chrome from the root layout.

### Excluded
`styleguide` (258) is the design system's own reference surface. It is updated
*by* every batch and never needs a brief of its own.

## Batch 4 cannot be briefed until one decision is made

Batch 4 is recorded as "internal ops / admin ERP". **The admin ERP is not in the
storefront.** It lives in the legacy SPA (`artifacts/tanmatra`) behind
`AdminAuthLayout`, and `git show HEAD:artifacts/tanmatra/src/routes.ts` lists 17
admin routes:

```
admin/ai-runs            admin/analytics           admin/cms-agent
admin/community-moderation  admin/compliance       admin/forecasting
admin/kds                admin/login               admin/menu-engineering
admin/moderation         admin/ops                 admin/ops-agent
admin/rd-applications    admin/sales-console       admin/sales-console/:slug
admin/supplier           admin/support-tickets
```

So "Batch 4" means one of two things, and they differ in size by roughly 17×:

**Reading A — the storefront's ops surfaces.** That is `/kitchen`, one route,
already secure, needing only a chrome fix. Batch 4 is then nearly empty and
should be folded into another batch.

**Reading B — port the legacy admin ERP into the storefront, then design it.**
17 routes in a different app, on a different router, behind a different auth
layout. This is a migration decision with an auth-model question attached
(`tanmatra_admin_sid` and `AdminAuthLayout` versus the storefront's island
pattern), not a design task, and it should not be smuggled in under a design
batch.

**Recommendation: Reading A.** The admin ERP is not on the critical path.
`tanmatra.food` still resolves to the legacy SPA, which serves those admin
routes today and will keep serving them after the storefront takes the domain —
the cutover only needs the *customer* surface. Redesigning admin is real work
with no user-visible benefit until someone asks for it.

## Proposed structure

Renumbering, because the old Batch 4/5 labels encode the ambiguity above.

| Batch | Contents | Routes | Rationale |
|---|---|---|---|
| **4** | Purchase funnel: brief 04 `/checkout` + G5 | 7 | Closes Batch 1's real gap; every paying customer sees these |
| **5** | Account depth: G1 | 7 | Fixes the most visible in-product inconsistency; reuses Batch 2 vocabulary |
| **6** | Corporate & group commerce: G2 | 6 | Follows Batch 3's B2B front door |
| **7** | RD booking & clinical: G3 | 4 | Fulfils Batch 3's and brief 20's CTAs |
| **8** | Community & content: G4 | 9 | Defines the editorial vocabulary |
| **9** | Secondary marketing: G6 | 11 | Largely static; cheapest per route |
| — | `/dish` ↔ brief 03 reconciliation | 1 | Decide: adopt brief 03, or record the PDP-depth track as the sanctioned design and retire the brief |
| — | `/meal-planner` (brief 06) | 1 | Brief is banked and unused |
| — | `/kitchen` chrome | 1 | Cosmetic; needs the ops-surfaces-in-storefront decision |
| Deferred | Legacy admin ERP | 17 | Reading B above. Not on the cutover path |

## Where that leaves "how far from done"

By storefront route: **20 adopted, 3 briefed but not adopted, 45 never briefed**
— 68 total, reconciled. That is 29% adopted. (20 routes come from 17 adopted
briefs: brief 05 covers two routes, 16 covers two, 17 covers three, and brief 07
is the cart drawer, which is a component rather than a route.)

That number is pessimistic in two ways worth stating. Weight is concentrated —
Batches 1–3 took the four heaviest surfaces in the app (`/` at 1,318 lines,
`/corporate-wellness` 857, `/partners/gyms` 772, `/dish` 689), while 11 of the
45 remaining are under 120 lines and several are nearly static. And 17 of the
routes people picture when they say "the admin work" are not in this app at all.

The honest read: **the customer-facing surface is roughly half designed by
weight, and the three batches that matter for coherence are 4, 5 and 6.** Batch
5 (account depth) is the one a customer would notice today.

## Decisions needed before briefing starts

1. **Batch 4 — Reading A or B?** Blocks any admin design work.
2. **`/dish` and brief 03** — adopt the brief, or bless the PDP-depth track as
   the design of record and retire the brief? Leaving both is how a design
   system loses its authority.
3. **Do `/legal`, `/legal/[slug]`, `/faq`, `/about` need briefs at all,** or is
   a shared prose/document template enough? Four routes, one decision.
4. **Batch ordering** — the table proposes coherence-first (funnel, then account
   depth). Cheapest-first would run 9 → 8 → 5 instead.
