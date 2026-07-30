# Stitch Batches 4–5 — scope, and where the design system actually stands

Batches 1–3 were briefed in writing before they were built. Batches 4 and 5 were
not: until this document they existed only as two one-line entries in a task
list ("internal ops / admin ERP", "auxiliary & stubs"), which is why "how far
from done?" had no answer for most of the surface. This is the missing artefact.

**No design work here.** No Stitch generation, no code. This is an inventory, a
correction of the recorded status, and a set of decisions — all four now taken,
each reversible, each with its reasoning written down so an owner can overrule it
on the merits rather than re-derive it.

## Method, and what is trustworthy

Route count comes from `find app -name page.tsx` — **68 routes**. Per-route
weight is the page plus every `@/components/*` module it imports directly,
counted in lines; it is a proxy for how much surface a redesign touches, not a
promise.

Adoption status is determined by **diffing the banked `.stitch.html` against the
live implementation** — section order, named affordances, dark-scope treatment,
money presentation. Nothing else proved trustworthy.

> **Two rejected methods, recorded so nobody repeats them.**
>
> **Marker-class counting** (`rounded-3xl`, `rounded-full bg-gold`, `tabular`)
> over-reports and under-reports at once: those markers are Batch 3's landing-kit
> vocabulary, so the heuristic scored `/account/orders` — verified Batch 2 work —
> at **zero**. Density tells you *which* batch touched a file, not *whether* one did.
>
> **Citation-grepping** (does a docstring say `Stitch brief 14` / `route-05`?)
> looked authoritative — 39 files carry one — and this document's first revision
> used it as ground truth. It is also wrong: it under-reported **4 of 20 briefs**,
> a 20% false-negative rate. Annotating your own work is a habit, not a build
> gate; the four briefs adopted by a differently-named workstream simply never
> got the comment. Citations are useful for *attribution*. They are not evidence
> of *adoption*.
>
> The lesson generalises past this document: when a cheap proxy for "was this
> done?" disagrees with the code, believe the code.

## Status of briefs 01–20: all twenty are adopted

| Brief | Route(s) | Status | Evidence |
|---|---|---|---|
| 01 | `/` | adopted | `Section01ClinicalHero` |
| 02 | `/menu` | adopted | `DishCard` — "Route Brief 02 v3, owner-confirmed" |
| 03 | `/dish/[slug]` | **adopted, uncited** | live section order matches the banked design one-for-one — see below |
| 04 | `/checkout` | **adopted, uncited** | dark scope + `StepDots` + `PhoneAuth` island + order summary + glass sticky footer — see below |
| 05 | `/plans`, `/plan/[planId]` | adopted, both screens | `PlanCardStitch` + `PlanBuilder` |
| 06 | `/meal-planner` | **adopted, uncited** | `WeekCalendarStrip` + `DayCard` + sticky glass plan bar — see below |
| 07 | cart drawer | adopted | `CartDrawer` sheet + stepper rows + `MiniCartBar` |
| 08–13 | the six `/account` routes | adopted | all six cite route-08 … route-13 |
| 14–20 | 10 acquisition surfaces | adopted | all cite briefs 14–20 |

Four entries changed from the first revision, all in the same direction — the
work was already done and the record was wrong.

**Brief 03 → `/dish/[slug]`.** Recorded as "brief unused" because nothing cites
it and the PDP came from a separately-named "PDP depth" track. Diffing says the
track *was* the brief's implementation. Banked section order vs. live:

| Banked | Live |
|---|---|
| Hero section | `DishGallery` |
| Header row: title + gold Add pill | `<h1>` + `formatPaise` + `AddToCart` |
| "METABOLIC PROFILE" | 4-col tabular macros `<dl>` |
| "CORE COMPONENTS" | `DishSpec` |
| "SAFETY & ALLERGENS" | `DishAllergens` |
| "PAIRS WELL WITH" rail | `DishPairing` |
| "User Feedback" + submit overlay | `DishReviews` |

Section for section, in order. Only the labels differ, and those are Stitch's
invented copy — the same class of fabrication as its "Keto-Cleanse Bowl" and
₹1,450 placeholders. The folder also contains a `dish.wired.png`, a wired-result
capture no other brief has.

**Brief 04 → `/checkout`.** Recorded "not adopted" on citation-only evidence.
The live route carries `data-stitch="dark"` on its wrapper, a real `StepDots`
progress indicator, `PhoneAuth` as the identity island the brief specifies, an
order summary with per-line quantity steppers, the brief's own "server bills the
final total" money language, and a glass sticky footer pairing "Est. total" with
a gold pill. Every substantive element of the banked mock is present.

**Brief 06 → `/meal-planner`.** Recorded "not adopted" (zero citations).
`WeekCalendarStrip` is the banked horizontal day-chip strip — and improves on it,
since the live day kinds (gym / travel / WFH) actually tune the next generation
rather than being decorative tags. `DayCard` is the `rounded-3xl` day card with
three slots, each an image plus a `kcal · g · price` tabular line plus a Swap
pill, with a Regen control and a dashed empty state. The banked "Fixed Plan Bar"
is `sticky bottom-16 … bg-[var(--glass)] backdrop-blur-xl md:bottom-0` — the same
glass treatment and mobile-nav clearance as checkout's footer.

**So: 20 briefs exist and all 20 are adopted. Batches 1–3 have no gap.** The
first revision's "three remaining routes" did not exist.

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
surfaces every paying customer sees. `/checkout` (brief 04) turns out to be
adopted already, so these are briefed **against** it rather than with it: reuse
checkout's own vocabulary — `data-stitch="dark"` scope, `StepDots`, the glass
sticky footer, amount-free CTAs — so the funnel reads as one surface end to end.
`/login` is the odd one out: the storefront's rule is that auth is an island,
so the brief for it must justify why a standalone route exists at all rather
than quietly re-introducing a redirect target.

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

## What "Batch 4" was hiding

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

**Reading A, decided** (see Decisions §1). The admin ERP is not on the critical
path. `tanmatra.food` still resolves to the legacy SPA, which serves those admin
routes today and will keep serving them after the storefront takes the domain —
the cutover only needs the *customer* surface. Redesigning admin is real work
with no user-visible benefit until someone asks for it.

## Proposed structure

Renumbering, because the old Batch 4/5 labels encode the ambiguity above.

| Batch | Contents | Routes | Rationale |
|---|---|---|---|
| **4** | Post-purchase & onboarding: G5 | 6 | Extends the already-adopted `/checkout` forward; every paying customer sees `order/confirmed` and `track` |
| **5** | Account depth: G1 | 7 | Fixes the most visible in-product inconsistency; reuses Batch 2 vocabulary |
| **6** | Corporate & group commerce: G2 | 6 | Follows Batch 3's B2B front door |
| **7** | RD booking & clinical: G3 | 4 | Fulfils Batch 3's and brief 20's CTAs |
| **8** | Community & content: G4 | 9 | Defines the editorial vocabulary |
| **9** | Secondary marketing: G6 | 11 | Largely static; cheapest per route. `/legal`, `/legal/[slug]`, `/faq`, `/about` share one prose template instead of four briefs (decision 3) |
| — | Citation backfill: `/dish`, `/checkout`, `/meal-planner`, cart | 4 | Cheap, and it is what makes the next audit a grep instead of a diff |
| — | `/kitchen` chrome | 1 | Cosmetic; the route-group fix, not a brief |
| Deferred | Legacy admin ERP | 17 | Reading B above. Not on the cutover path |

Batch 4 lost a route and Batches 1–3 gained three: the two rows this table
carried for `/dish` and `/meal-planner` are gone, because the diff found both
already built. Nothing was descoped — the record caught up with the code.

## Where that leaves "how far from done"

By storefront route: **23 adopted, 0 briefed but not adopted, 45 never briefed**
— 68 total, reconciled. That is **34% adopted**, and the briefed-but-unbuilt
column is empty: every brief that exists has shipped.

The 23 routes come from 19 briefs. Brief 07 is the cart drawer — a component,
not a route — so 19 of the 20 briefs map onto routes at all; brief 05 covers two
(`/plans`, `/plan/[planId]`), brief 16 two, brief 17 three, and the remaining 16
one each: 16 + 2 + 2 + 3 = 23. The 45 unbriefed are the 44 grouped in G1–G7 plus
`/styleguide`, which is excluded by design rather than pending.

The first revision said 29% on the strength of citation-grepping. The five-point
correction is not progress made since; it is progress that had already been made
and was mis-recorded.

That number is pessimistic in two ways worth stating. Weight is concentrated —
Batches 1–3 took the four heaviest surfaces in the app (`/` at 1,318 lines,
`/corporate-wellness` 857, `/partners/gyms` 772, `/dish` 689), while 11 of the
45 remaining are under 120 lines and several are nearly static. And 17 of the
routes people picture when they say "the admin work" are not in this app at all.

The honest read: **the customer-facing surface is roughly half designed by
weight, and the three batches that matter for coherence are 4, 5 and 6.** Batch
5 (account depth) is the one a customer would notice today.

## Decisions — taken

Four decisions were open when this document was first written. All four are
resolved below. Any of them can be overridden by the owner; until then these are
what the batch table above encodes, and none of them is expensive to reverse.

**1 · Batch 4 means Reading A — the storefront's ops surfaces, not the legacy
admin ERP.** Adopted as recommended above. The consequence is that "Batch 4" as
an ops batch effectively vanishes: `/kitchen` is the storefront's only internal
route, it is already secure, and its one defect is cosmetic. So the *number* 4 is
reused for the post-purchase batch and the legacy ERP is recorded as deferred
rather than as unstarted design work. Porting 17 admin routes across apps, auth
models and routers is a migration with a design phase at the end of it — it needs
its own decision, not a slot in a design batch.

**2 · `/dish` adopts brief 03 as-is; the brief is not retired.** This one stopped
being a preference and became a finding. The question assumed the PDP-depth track
and brief 03 were two designs competing for one route; the diff shows they are one
design under two names — section for section, in order, with only Stitch's invented
labels differing. There is nothing to reconcile and nothing to retire. What is
missing is the annotation, which is why citation backfill is now a row in the
table rather than a decision. Same for `/checkout` (brief 04), `/meal-planner`
(brief 06) and the cart (brief 07).

**3 · `/legal`, `/legal/[slug]`, `/faq` and `/about` get one shared prose
template, not four briefs.** They are long-form document surfaces whose design
problem is entirely typographic: measure, heading scale, list rhythm, anchor
links, a table of contents on the long ones. That is one decision applied four
times, and `/legal` at 33 lines does not warrant its own generated mock. The
template lands inside Batch 9 and is documented on `/styleguide` as a prose
scope, so the next document route inherits it for free.

**4 · Ordering is coherence-first: 4 → 5 → 6 → 7 → 8 → 9.** Cheapest-first
(9 → 8 → 5) closes more routes per week and is the wrong trade here. The cost of
an unfinished design system is not the count of unstyled routes, it is the number
of *boundaries a single user crosses in one session* — and those cluster in the
funnel and the account hub, not in the static pages. Batch 9 is also the batch
that benefits most from being last: by then the editorial and prose vocabulary
Batch 8 defines already exists, so the cheapest batch gets cheaper still.

### Still genuinely open

Not decisions I should make:

- **When to remap `tanmatra.food`** to the storefront service. Unrelated to
  design coverage, but it sets whether Batches 5–9 land before or after the
  storefront is the public surface. `docs/DOMAIN-CUTOVER.md` is cited in three
  places in `deploy.yml` and does not exist; writing it is open work.
- **Whether the legacy admin ERP is ever ported** (Reading B). Deferred, not
  declined.
