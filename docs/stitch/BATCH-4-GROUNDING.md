# Batch 4 Grounding — Post-purchase & Onboarding (G5)

> Reconciliation input for Route Briefs 21–26. Establishes, per route, the real
> backend contract and the logic that must survive wiring — written **before**
> any Stitch generation so the briefs describe what the server actually does,
> not what the current screens claim it does.
>
> Batch 3's grounding pass found a recruitment wizard that never transmitted.
> This pass found the same failure mode twice more, once on the money path.

## Route → real path map

| Scope-doc route | Real storefront path | Page LOC | Route weight |
|---|---|---|---|
| `order/confirmed/[orderId]` | `app/order/confirmed/[orderId]/page.tsx` | 84 | 228 |
| `trial` | `app/trial/page.tsx` | 80 | 185 |
| `quick-setup` | `app/quick-setup/page.tsx` | 33 | 181 |
| `custom-build` | `app/custom-build/page.tsx` | 33 | 152 |
| `track/[orderId]` | `app/track/[orderId]/page.tsx` | 36 | 116 |
| `login` | `app/login/page.tsx` | 24 | 115 |

Page LOC is small because these are thin server shells composing islands — the
same structure Batch 3 found. Route weight (page + directly imported
`@/components/*`) is the number the scope doc ranks by.

## The batch splits in two, and the split is the headline

**Four routes need design only.** `/order/confirmed`, `/track`, `/trial` and
`/login` are correctly wired, honest about failure, and free of every defect
signature in this batch. They can be briefed and restyled directly.

**Two routes need repair before design.** `/quick-setup` and `/custom-build` are
unwired demo surfaces: they collect input, claim to have saved or priced it, and
discard it. Designing them first would mean polishing a screen that lies. Brief
24 and Brief 25 must therefore specify the wiring alongside the visual, exactly
as Brief 16 did for the RD wizard.

## Contracts that must survive wiring

### `GET /api/orders/:externalOrderId/status` — WIRED ✅

Guest endpoint (no auth), `artifacts/api-server/src/routes/checkout.ts`. Client:
`lib/orderStatus.ts`. Powers **both** `/order/confirmed` and `/track`.

```
200 { orderId, status, etaMinutes }   ETA counts down a 25-min SLA
404 { error: "order not found" }
```

`fetchOrderStatus` maps every failure to an honest state — `not_found` vs
`unavailable` — and validates the body shape before trusting it. Server
components pass `API_BASE_URL`; the client island passes `""` and goes
same-origin through the proxy. **Preserve this three-outcome contract**: the
design needs a real "we can't find that order" state and a real "can't reach the
kitchen" state, not one generic error card.

`lib/orderStatus.ts` already owns the post-purchase status vocabulary:

| Export | Meaning |
|---|---|
| `statusLabel(status)` | Human copy; **unknown values pass through raw rather than being guessed at** |
| `TRACKABLE_STATUSES` | Allowlist of in-flight statuses. Fails safe: hides Track for anything unrecognised rather than showing a dead CTA on a settled order |
| `statusTone(status)` | `live` / `settled` / `failed` — **already matches the route-12 brief**: danger tone + dimmed card + no reorder CTA for cancelled, refunded, failed |

### Trial pricing — WIRED ✅, priced from the spine

`/trial` takes `TRIAL_PRICE_PAISE` from `lib/trial.ts` and derives the
"most popular plan" figures from `computePlanQuote("desk_fuel", …)` in
`@workspace/subscription-rules`. No number on that page is invented locally.
`resolveTrio` drops menu slugs it cannot resolve rather than faking them, and
says so in its own docstring. This is the pattern the other two routes violate.

### Add-ons — the real spine has exactly two

`@workspace/subscription-rules` exports `ADD_ONS`; the storefront adapter
`lib/addons.ts` states the rule outright:

> *"Nothing is priced here — every paise comes from `ADD_ONS`, so the storefront
> can't drift from the bill."*

| id | display | attach point |
|---|---|---|
| `rd_bump` | Your dietitian | `plan_review` |
| `evening_add` | Evening meal | `post_purchase` |

Two add-ons, priced in a shared package, with attach points the server honours.

### `/login` is sanctioned, and must stay a leaf

`app/login/page.tsx` sanitises `next` to an internal path — anything not matching
`/^\/(?!\/)/` falls back to `/account`, so it cannot become an open redirect.
The docstring records why it exists at all: *"§2 — account access; checkout keeps
its own in-flow identity."*

This does **not** reopen the auth-island rule. `/login` is a destination a
customer may choose; it is not a redirect target for gated surfaces. The brief
must not introduce "sign in to continue" bounces from any island — those still
render `<PhoneAuth>` in place. `AddToCart`'s group branch already links to
`/login?next=…` on a 401, which is the sanctioned shape: an explicit user-visible
choice, not an interception.

## Defects found, with evidence

All pre-existing. None introduced by this batch. Ordered by consequence.

### 1 · `/custom-build` invents a parallel add-on system, and the configuration is silently discarded

`components/custom/CustomBuildHub.tsx:9-13` hardcodes three boosts with three
hardcoded prices in a client component:

```
protein-double      "Double Organic Protein Boost"        quotePaise: 9500
prebiotic-fiber     "Hydroponic Prebiotic Fiber Bowl"     quotePaise: 6500
probiotic-kombucha  "Raw Ginger Fermented Kombucha"       quotePaise: 12000
```

None of the three exists in `ADD_ONS`. The client then sums them (`:21`) and
hands the total to the cart (`:109`):

```tsx
<AddToCart dish={{ id: selectedDish.id, …, price: totalQuote }} />
```

**The wire rule survives; the flow does not.** `AddToCart` keys the cart line on
`dishId` and the server re-prices at `/orders` (`AddToCart.tsx:61` — *"Local
cart; server re-prices at /orders"*), so no client number is ever billed. But
the boosts are not line items and `dishId` is just the base bowl, so the
customer is shown *"Estimated Total Quote"* including three boosts, is charged
for the base bowl alone, and receives no boosts. The configurator's entire
output is dropped at the boundary.

The screen asserts the opposite, in a sage callout at `:103`:

> *"Server Authoritative Money (§5): Final billing is recalculated securely by our
> Express gateway during checkout."*

That sentence is true of the *architecture* and misleading *here* — it reads as
reassurance that the quote above it will be honoured. The file header makes the
same claim (*"with server-authoritative price quotes"*). A disclaimer that
describes a property the surrounding code does not have is worse than no
disclaimer.

`SaveToVaultButton` (`:111`) compounds it by saving `${slug}-custom`, a slug that
exists in no catalogue — a dangling vault reference.

### 2 · `/quick-setup` says "Profile Saved" and saves nothing

`components/wizard/QuickSetupWizard.tsx` holds goal, allergens, dietary style and
conditions in local `useState`, and at step 4 renders a card reading **"Profile
Saved"** (`:44`). Nothing is transmitted. `InstantPlanPreview` filters the
already-fetched menu client-side through `recommendMenu`, so the *preview* does
honour allergens (`computeDishFit` returns a `conflict` band and
`recommendMenu` excludes it) — but the profile itself never leaves the browser
and no kitchen, order or account record learns of it.

Step 2's prompt is the sharp end (`:94`):

> *"Select dietary allergens our kitchen must strictly omit"*

The kitchen is never told. On an allergen control that sentence is a
safety-shaped promise the system does not keep, and it is the single most
important thing this batch fixes. `/account/preferences` (Batch 2, route-11) is
the real persistence surface this should write to.

Same failure mode as Brief 16's wizard — collect, congratulate, discard — but
with allergens instead of a licence number.

### 3 · Fabricated fallbacks for data the server didn't send

| File | Line | Fallback |
|---|---|---|
| `wizard/InstantPlanPreview.tsx` | 68 | `dish.price ?? 35000` (display) |
| `wizard/InstantPlanPreview.tsx` | 70 | `dish.price ?? 35000` (**into `AddToCart`**) |
| `custom/CustomBuildHub.tsx` | 20 | `selectedDish.price ?? 35000` |
| `custom/CustomBuildHub.tsx` | 46 | `d.price ?? 35000` |
| `custom/CustomBuildHub.tsx` | 49 | `?? 450` kcal, `?? 0` g protein |

₹350 is invented. Batch 3 already removed this exact fallback from
`deals/DealsFilterBar.tsx` and `recommendations/RecommendationCard.tsx`, both of
which now carry a `// MONEY:` comment recording it; these two files were simply
outside that batch's route set. The nutrition fallback is worse than the price
one — inventing "450 kcal" for a dish whose calories are unknown is a fabricated
clinical number on a clinical product. Drop the line, don't fill it.

### 4 · HTML entities inside JS string literals render literally

In JSX *text*, `&rarr;` decodes. Inside a *JavaScript string* it does not — it
ships to the user as the raw characters `&rarr;`.

| File | Line | Renders as |
|---|---|---|
| `wizard/QuickSetupWizard.tsx` | 106 | `Excluding &check;` |
| `wizard/QuickSetupWizard.tsx` | 127 | `Active &check;` |
| `wizard/QuickSetupWizard.tsx` | 141 | `Continue &rarr;` |
| `custom/CustomBuildHub.tsx` | 73 | `Added &check;` |

Fix with the literal glyph (`✓`, `→`), which the repo already uses elsewhere —
`AddToCart.tsx:54` ships `"Added ✓"` correctly. Eight further instances exist
outside this batch (`qa/`, `symptoms/`, `menu/SaveToVaultButton`,
`onboarding/`); they are **out of scope here** and belong to their own batches.

### 5 · `text-white` on `bg-gold` — the AA failure Batch 3 recorded

Gold `#D4AF37` under white measures ≈1.9:1. The token law is `--gold-ink`
(`#111318`, 8.84:1). `lint:tokens` does not catch it — it is a palette utility,
not a raw hex, and the palette-class ban was revoked for the storefront under
DS-0. Instances: `QuickSetupWizard.tsx:140`, `InstantPlanPreview.tsx:78`,
`CustomBuildHub.tsx:65,69,70,72`.

Identical to the `PartnerWizard.tsx` defect Batch 3's grounding logged and fixed.

### 6 · `bg-sage-100` / `text-sage-800` do not resolve

Three of this batch's components paint with them —
`QuickSetupWizard`, `InstantPlanPreview`, `CustomBuildHub` — so those chips and
the step-progress inactive dots render unstyled. Five more components elsewhere
share the defect (`account/AppointmentsList`, `qa/CommunityQaForum`,
`symptoms/SymptomTrackerView`, `guides/SourcingTransparency`,
`challenges/ChallengeTrackerView`); fix this batch's three, leave the rest to
their own batches rather than smuggling a repo-wide sweep into a design PR.

### 7 · Post-purchase coherence gaps (`/order/confirmed` ↔ `/track` ↔ route-12)

Three findings, all from helpers that exist and are not called:

- **`/order/confirmed` renders "Track live" unconditionally** (`:66-72`). It
  never consults `TRACKABLE_STATUSES` — the allowlist built for exactly this,
  whose docstring says it *"fails safe by hiding Track for anything it doesn't
  recognise rather than showing a dead CTA on a settled order."* A delivered or
  cancelled order still offers Track.
- **`/track` polls every 20 s forever** (`TrackStatus.tsx:11,29`), including
  after `delivered` and `cancelled`. No terminal stop.
- **Neither route uses `statusTone`.** So `cancelled` / `refunded` / `failed`
  render in the same neutral treatment as `delivered`, while Batch 2's route-12
  gives them a danger tone, a dimmed card and no reorder CTA. A customer moving
  from `/account/orders` to `/track` crosses a design boundary mid-flow.

That third one is the concrete instance of the argument the scope doc used to
choose coherence-first ordering — worth briefing deliberately rather than
patching.

## What must survive wiring

- `fetchOrderStatus`'s three outcomes, and `statusLabel`'s pass-through of
  unknown statuses. Never invent a status.
- `TRIAL_PRICE_PAISE` and `computePlanQuote` as the only source of trial and
  plan figures.
- `resolveTrio` dropping unresolvable slugs rather than faking them.
- `fetchMenu()` staying server-side on `/trial`, `/quick-setup`, `/custom-build`;
  all three already `await` it in the page and pass `dishes` down.
- The `Suspense` boundaries on `/quick-setup` and `/custom-build`.
- `/login`'s `next` sanitisation, verbatim.
- `AddToCart` keying on `dishId` with the server re-pricing at `/orders`.

## Wiring checklist for Batch 4

- [ ] `/quick-setup` persists the profile to the real preferences surface, or the
      "Profile Saved" and "our kitchen must strictly omit" copy goes
- [ ] Allergen selections reach the server, or the screen stops implying they do
- [ ] `/custom-build` uses `ADD_ONS` from `@workspace/subscription-rules`, or the
      three invented boosts go
- [ ] No client-side price arithmetic feeding `AddToCart`
- [ ] The "Server Authoritative Money" callout is removed or made true
- [ ] `SaveToVaultButton` stops writing a `-custom` slug that resolves to nothing
- [ ] All five `?? 35000` / `?? 450` fabricated fallbacks removed
- [ ] Four entity-in-string-literal bugs fixed with literal glyphs
- [ ] Gold CTAs use `--gold-ink`, never `text-white` (6 instances)
- [ ] This batch's three `sage-100` / `sage-800` users repointed to real tokens
- [ ] `/order/confirmed` gates its Track CTA on `TRACKABLE_STATUSES`
- [ ] `/track` stops polling on a terminal status
- [ ] `/order/confirmed` and `/track` adopt `statusTone`, matching route-12
- [ ] `/login` gains no redirect-target behaviour; islands still render `<PhoneAuth>`
