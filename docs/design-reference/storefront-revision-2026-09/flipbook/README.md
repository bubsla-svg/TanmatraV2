# PR-11 flipbooks — 393×852

Evidence for the tokens sub-PR (`docs/MOBILE-FIRST-CX-BRIEF.md` "Foundations 0").
Same seven states before and after, captured at the brief's 393px source-of-truth
width (iPhone 15 Pro) against a `next build` + `next start` of each tree, with the
API upstream unreachable so the static fallback catalog renders (`fetchMenu()`
`source: "fallback"`). 1x viewport frames; nothing was restyled — only tokens moved,
so "after" is the whole app in the delivered revision's palette and type, unrestyled.

- `before/`, `after/` — the app's real default: no stored theme choice, so the Stitch
  scope forces the **dark arm** on redesigned routes (`components/StitchScope.tsx`).
- `after-light/` — the same states with a stored `theme=light` choice (next-themes key,
  unchanged), because the README's two contrast fixes (`--muted-foreground` → 41 %,
  amber text/fills → 37 %) live in the light arm. No `before-light/`: producing it
  needs a production build of the base tree, and the dark default is the customer's
  first render.

| # | State | Route |
|---|-------|-------|
| 01 | Home | `/` |
| 02 | Menu grid | `/menu` |
| 03 | Dish PDP | `/dish/quinoa-khichdi` |
| 04 | Plans | `/plans` |
| 05 | Cart drawer open (after "Add") | `/menu` |
| 06 | À-la-carte checkout | `/checkout?mode=alacarte` |
| 07 | QR start | `/start` |

Regenerate: `scratch/flipbook.mjs` pattern = `e2e/specs/stitch-runtime/*-flipbook.spec.ts`
(goto → role-first readiness → deterministic shot). Re-baseline `layout-vrt` separately.

## PR-11b — primitives

`Rail`, `Disclosure`, `QuantityStepper`, `StickyAction` and their migrated call sites.
The "before" for 11b is the merged 11a tree, i.e. `after/` and `after-light/` above —
no separate copy. `11b/after/` and `11b/after-light/` are the same seven states on the
11b tree. What to compare: the dish-card and PDP steppers, the cart-drawer rows, the
checkout order-summary rows, the pay bar, the mini-cart pill, the section chip bar and
the pantry rail. Every state present before is present after; only the skin moved.

## PR-11c — CUJ 1+2: home, menu, dish sheet/PDP, cart drawer

`11c/reference/` — the delivered revision itself rendered at 393×852 (light), from the
exported `src/` under a minimal Vite runner (the export ships no `main.tsx`; `App.tsx`
imports two files that were not exported). These are the pixel-match targets the brief's
execution order step 4 asks for. `11c/after/` and `11c/after-light/` are the production
storefront on the 11c tree; the "before" is the merged 11b tree (`11b/after*`).

### Divergence ledger (reference trait → what production renders, and why)

| Reference | Production (11c) | Rule |
|---|---|---|
| CSS `dish-art` plate on every card, hero and PDP | real photography via `DishImage`/`SafeImage`, with the branded fallback tile | README override; brief CUJ 1 §11 |
| Card without macros, hard-coded `4.8 ★`, "Fresh today" chip on every card | macros row on every card; stars only from the payload; badges only from the payload | Law 8; README override |
| Add button 40 px, solid primary on every card | 44 px outline-gold Add (in-cart face: 48 px stepper) — one solid action colour per viewport | one-gold rule (`one-gold.spec.ts`), 48 px money-path floor |
| Menu page title block ("Good food, well considered.") + search box | no visible title block; the sr-only h1 stays | owner decision 2026-08-16 (first product above the fold); search removed earlier |
| Category chips solid primary when selected | primary tint (`bg-primary/10`) when selected | selection is never the action colour |
| Ticker, hamburger grid nav, `/cart` route, favourites heart | header/tab-bar/drawer shell unchanged; no favourites feature | README override; brief scope rule 5 |
| Cart summary as a dark `bg-primary` panel with an amber CTA | summary on the sheet surface, Checkout in the action colour | the CTA must stay the one action colour, and gold-on-green vanishes |
| Hero eyebrow "Nutrition, without the noise", stats "24g+ / 1 kitchen" | eyebrow rule with no invented copy; the three trust lines as the stats row | no new copy, no unsourced numbers |
| Amber accent as text (`text-accent` eyebrows at 53 %) | `--accent` is the 37 % amber (4.6:1) | README contrast fix (PR-11a) |

Two menu-chrome changes travel with the card, both presentation and both forced by the
card's height (≈3× the old row):

- The sticky control cluster used to paint over the header whenever both pinned, so the
  header's location trigger, search and theme toggle were unreachable on `/menu` after the
  first scroll (the theme-toggle e2e only passed because Playwright crawled the shorter page
  back to the top). It now pins just below the header while the header is revealed, off the
  same `useScrollHide` stream the header and tab bar share — Law 1.
- `cv-auto-row` (`content-visibility: auto` with a 192 px placeholder) came off the grid
  items: the placeholder would mis-size every unrendered card and shift the document as rows
  materialise, and Chromium's lazy render left most of the grid unlaid-out for seconds after
  load. The horizontal rails keep `.cv-auto`, where item sizes are fixed.

## PR-11d — CUJ 5: checkout, plan leg, order confirmed

`11d/after/` and `11d/after-light/` are the mandated seven frames on the 11d tree, taken the
way CI builds the storefront (`NEXT_PUBLIC_LIVE_CHECKOUT` unset, no API, fallback catalog);
the "before" is the merged 11c tree (`11c/after*`). Of the seven only `06-checkout-alacarte`
belongs to this PR, and without an API it can only show the guest form with an estimated
subtotal — so the surfaces 11d actually restyles are evidenced separately:

`11d/mock-before*` and `11d/mock-after*` — fifteen states per arm the sandbox cannot reach on
its own, captured off a `NEXT_PUBLIC_LIVE_CHECKOUT=1` build with placeholder Firebase public
config (without it `PlanIdentityGate` never mounts the session probe), the browser seams
stubbed with `page.route()` exactly as `e2e/specs/stitch-runtime/checkout.spec.ts` and
`checkout-doubletap.spec.ts` stub them, the same stub Razorpay modal, and a scratchpad mock
answering the server-side `GET /api/orders/:id/status`. **Every figure on these frames is
fixture data** (`₹3,442` plan quote, `₹104` à-la-carte quote, `#ORD_FLIP_…` ids, `TNM7K2X`
referral code) — not the live catalogue, not real orders. The mock never enters the repo.

| Frame | State | How it is reached |
|---|---|---|
| `p0` | plan serviceability gate | `/checkout?plan=desk_fuel` |
| `p1`, `p2`, `p2b` | plan details: top, consent + total card, manual address | PIN `201301` cleared, stubbed session, address typed through the picker's manual fallback |
| `p3` | plan payment-processing (14.6) | verify held open after the stub modal resolves |
| `p4` | plan payment-unresolved (14.7) | verify 503 through `verifyWithRetry`'s bounded attempts |
| `a1`, `a2`, `a3` | à-la-carte form with an active quote and a bookable window; summary open; consent + pay bar | quote, slots, session and address stubbed |
| `a4` | inline error after a real attempt | street line cleared, CTA tapped |
| `a5`, `a6` | à-la-carte 14.6 / 14.7 | as `p3` / `p4` |
| `c1` | order confirmed, on-demand (`preparing`, ETA) | mock status endpoint |
| `c2` | order confirmed, scheduled plan order (window, perks, claim, referral) | mock status + sessionStorage perks |
| `c3` | order not found | mock 404 |

### Choices without a reference screen (what changed → why)

The revision has no checkout route; these follow the 11c grammar and its ledger.

| Before 11d | Production (11d) | Rule |
|---|---|---|
| Selected delivery-day segment as a solid gold fill beside a solid gold pay CTA | the 11c selection tint (`bg-primary/10`) | one solid action colour per viewport (`one-gold.spec.ts`) |
| Totals and unit prices in gold text | data face (`.font-data`) in the primary ink | amounts are data; gold is the action colour, not a highlighter |
| Plan pay bar as its own `fixed … bg-[var(--glass)]` markup | `StickyAction` (the 11b primitive) | one sticky base, spelled once |
| Fields on the page background with a hairline focus edge | fields on the surface fill, primary focus edge, 50 px minimum height | 48 px money-path floor; a perceivable boundary |
| Section questions as 14 px labels | display face (Fraunces) at 20 px; field labels stay small | the reference's hierarchy: display titles, quiet labels |
| Eyebrows in gold text (`Order confirmed`, `Next steps…`) | the 37 % amber `text-accent` eyebrow | README contrast fix (PR-11a) |
| `rounded-3xl` / `rounded-xl` cards | `rounded-2xl` throughout | the 11c card radius |
| Reference's dark summary panel with an amber CTA (from `/cart`) | not adopted | Checkout stays the one action colour; gold-on-green vanishes |
| Breeze fallback (`CheckoutFlow` …), `EveningAddOffer`, `PhoneAuth` | untouched | 11h / 11g; the fallback is local-dev parity only, never the checkout |

Noticed while capturing, not changed (product shape is frozen): on the plan leg a saved
address never seeds `PlanDetails` — the serviceability gate's PIN seed mounts the step first
and the once-only prefill has already fired when `/api/addresses` lands. The manual-address
frames above are how every returning customer currently gets through.

## PR-11e — CUJ 3+6: goal-based shelves, dish-sheet disclosures, meal planner, trust surfaces

`11e/reference/06-about.png` — the delivered revision's `/about` at 393×852, the one reference
screen this PR has (the revision's six routes hold no shelf, planner or dietitian page).
`11e/after/` and `11e/after-light/` are the mandated seven frames on the 11e tree (the "before"
is `11d/after*`). `11e/before*` → `11e/after*` also carry the fifteen extra frames below — the
surfaces this PR actually restyles, all reachable without an API (fallback catalog; the planner
and the dietitian booking show their sign-in / no-data states honestly):

| Frame | Surface |
|---|---|
| `r01` | `/metabolic` — the goal explorer (CUJ 3 §1) |
| `r02`, `r03` | `/performance`, `/clinical` — `ProtocolView` + `ProtocolDishRail` |
| `r04` | `/care` — need-state and condition rails on `CardSection` |
| `r05` | `/meal-planner` — the sign-in island (the planner itself needs a session) |
| `r06` | `/about` — the reference's composition on the page's own copy |
| `r07`, `r08`, `r09` | `/team`, `/rd`, `/rd/[slug]` — the authority pages and `RdBooking` |
| `r10`, `r10b` | dish quick view, top and scrolled to its end (`DishSpec` → `Disclosure`) |
| `r11` | `/menu` filter sheet |
| `r12`, `r13` | dish page scrolled to the Nutrition / Ingredients disclosure and to Allergens |
| `r14` | the kitchen-safety sheet (CUJ 6 §2-3) |

### Divergence ledger (reference `/about` → what production renders, and why)

| Reference | Production (11e) | Rule |
|---|---|---|
| Hero eyebrow "The Tanmatra method" + italic accent line in the h1 | the page's existing h1 and paragraph inside the dark band; no eyebrow, no italic line | no invented copy |
| "Our point of view" left column with a display h2 | the page's "Our Mission" as the accent eyebrow, its statement in the display face on the right | the page has no second heading string |
| Step cards: number **and** an icon disc | the number inside the disc | production has no icon per step |
| Quote band + "Meet the menu" | the page's closing band with its one gold CTA ("Start your plan") | keep the existing action |
| `text-accent` eyebrows on the dark `bg-primary` band | none placed on the band (`Section07ProofKitchen` already uses `text-primary-foreground/80` there) | 37 % amber on the green band measures ≈1.5:1, and in dark mode both resolve to the same hex |

### Choices without a reference screen (what changed → why)

| Before 11e | Production (11e) | Rule |
|---|---|---|
| Dish page: Astryx `CollapsibleGroup` (both rows openable, `spacious` = 41 px triggers) | the shared `Disclosure` (one row open at a time, Nutrition first, 48 px triggers) | brief CUJ 3 §3; `lib/tapTargets.test.ts` now pins the primitive's floor |
| Dish quick view: `DishSpec` as a flat stack (chips, fibre/sugar cards, ingredient chips) | the same content as two `Disclosure` rows, "Nutrition" and "Ingredients", under the always-visible kcal / P / C / F grid | brief CUJ 3 §3-4 (one summary row visible); the two labels are the dish page's own |
| Allergens as an accordion (brief CUJ 3 §3 names them) | not collapsed anywhere — restyled in place, chip and copy intact | never behind a tap: an unreviewed list must never read as "no allergens" (`DishAllergens`, `DishDrawer` §6 notes) |
| "Why this meal" as an accordion | `DishRationale` stays a short card (one sentence, optional expansion), accent eyebrow | one sentence is already the summary row; it renders only with a session |
| Solid gold on selected day segments (planner strip, metabolic goal toggle, booking chips, filter chips as `bg-gold/10 text-gold-text`) | the 11c selection tint (`border-gold bg-primary/10 text-primary`) | one solid action colour per viewport |
| Gold text as a highlighter (figures, links, GI chip, "View profile →") | data face in the primary ink; text links in the primary ink or neutral underline | gold is the action colour, not a highlighter |
| Planner: `style={{ …var(--warning) }}` inline colours on the macro-warning note | `border-[var(--warning)]` / `bg-[var(--warning)]` utilities (the form `LocationPickerFlow` already uses) | no inline colours; same token |
| `rounded-3xl` / `rounded-xl` / `rounded-card` cards across the cluster | `rounded-2xl` throughout | the 11c card radius |
| `/performance`, `/clinical`: hero CTA and closing consult CTA both solid gold | unchanged — they sit in different viewports | the rule is per viewport |

## PR-11f — CUJ 4: cross-sell, pantry and marketplace

No reference screen: the delivered revision has no marketplace, bundle or cart upsell, so
these follow the 11c card grammar (`DishCard`) and the 11c cart-drawer ledger. `11f/after/`
and `11f/after-light/` are the mandated seven frames on the 11f tree (the "before" is
`11e/after*`); `11f/before*` → `11f/after*` also carry the ten frames below.

**Mock-fed, like 11d's checkout.** Without an API the marketplace catalogue is empty — the
server-side `fetchMarketplaceItemsServer` fails closed to `[]`, and `/marketplace` is
prerendered at build time with that empty list — so the ten frames come from the same build
served against the scratchpad mock (four fixture items, `image: null` so the branded
fallback tile shows; `/marketplace` and `/meal-deals` purged from the prerender cache so they
regenerate against it) with the browser's own `GET /api/marketplace/items` stubbed through
`page.route()` for the cart upsell rail and the pantry rail. **Every item, supplier, price and
badge on these frames is fixture data.** The mock never enters the repo; the honest no-API
state ("Marketplace catalog is currently empty.") is what CI and a bare clone render.

| Frame | Surface |
|---|---|
| `m01`, `m02` | `/marketplace` — title block and the card grid (index page cards) |
| `m03`, `m03b` | `/marketplace/[slug]` — top, and the buy card at the end |
| `m04`, `m04b` | `/meal-deals` — `BundleCard`s, top and end |
| `m05`, `m05b` | cart drawer with `CartUpsellRail` (one meal in the cart), top and scrolled |
| `m06` | `MiniCartBar` on `/menu` after the drawer closes |
| `m07` | dish page scrolled to `PantryRail` ("Goes with this") |

### Choices without a reference screen (what changed → why)

| Before 11f | Production (11f) | Rule |
|---|---|---|
| Prices and totals in gold text (`font-clinical-data text-gold-text`, `tabular … text-gold-text`) | data face (`.font-data`) in the primary ink — cards, buy card, bundle totals, upsell rows, pantry rail, mini-cart subtotal | amounts are data; gold is the action colour |
| Item names as 14 px bold sans | display face (Fraunces) — the `DishCard` item-name grammar | one card language across dishes, pantry goods and bundles |
| Badges as `bg-sage-soft/90` with a `border-[var(--sage)]/20` hairline and backdrop blur | plain `bg-sage-soft text-sage-text` chips; category chip as a secondary fill | status keeps its signal colour (README); no arbitrary colour utilities |
| `rounded-3xl` bundle cards with `shadow-sm`; `rounded-lg`/`rounded-md` rows and buttons; `border border-line` on every inner tile | `rounded-2xl` cards, secondary-fill tiles without hairlines, pill secondary buttons | the 11c card radius; fill, not hairline, for a perceivable boundary |
| Upsell rail as a raised hairline box with a gold-text title | a secondary-fill panel with a neutral small label; its "+ Add" stays a pill outline | inside the cart drawer, add-on CTAs are secondary, never the primary accent (brief CUJ 4 §2) |
| Bundle affordance "See what's inside" as a `rounded-lg` gold-outline bar | the same outline as a pill | one shape for outline actions (the card Add) |
| Marketplace buy card `rounded-3xl … shadow-2xl` | `rounded-2xl … shadow-[var(--shadow-raised)]` — the dish page's buy card | one raised-card treatment |
| "Marketplace" / "Meal Bundles" page titles as bold sans | the display h1 | the 11d focus-title grammar |

Unchanged on purpose: `MarketplaceAddToCart`, `MarketplaceBuyNow`, `EveningAddOffer` (Breeze
fallback, 11h) and the money path behind "Buy now" (`lib/marketplaceApi.ts` checkout →
shared Razorpay order + verify) — presentation only, no handler, id, testid or copy moved.

## PR-11g — onboarding and account

No reference screen: the delivered revision ships neither the `/quick-setup` wizard, the
`/start` QR lane, `/trial`, sign-in, nor any `/account` surface, so these follow the grammar
established in 11c–11f — the card (`rounded-2xl border border-line bg-surface p-5`), the
display-face headings, the `.font-data` figures, the tap-to-select row (gold border + faint
primary tint, never a solid gold fill), the field grammar, and one gold action per viewport.
`11g/after/` and `11g/after-light/` carry the mandated seven frames (`01`–`07`) on the 11g
tree plus the seventeen onboarding and account frames below; the mandated "before" is
`11f/after*`, and `11g/before*` carry the seventeen 11g "before" frames.

**Signed-out is stub-free; signed-in is fixture-fed.** Every `/account` island is
session-gated and renders an honest inline sign-in state on a 401 — exactly what the
`cuj-account-*` and `stitch-runtime/account` specs assert. The signed-out frames (`g07`–`g13`)
need no stub. Three authed frames (`g14`, `g15`, `g15b`) layer 200 stubs over a 401 catch-all,
using the `stitch-runtime/account` §9.2 fixture verbatim (one active weekly subscription,
`/api/auth/user` → a member) so the hub's authenticated chrome and the "Your plans" delivery
list render. **The member, subscription, delivery window and prices on those three frames are
fixture data;** the honest signed-out state is what CI and a bare clone render.

| Frame | Surface |
|---|---|
| `g01`, `g02`, `g03`, `g03b` | `/quick-setup` — step 1 goal, step 2 dietary style, step 3 allergens, step 3 with a selection |
| `g04` | `/start` — QR lane (`QrStart` / `QrTrio` / `ReferralWelcome`) |
| `g05` | `/login` — `LoginCard` |
| `g06` | `/trial` — hero, creditback steps, `TrialStart` sticky CTA |
| `g07` | `/account` — signed-out (`PhoneAuth`, expanded) |
| `g08`–`g13` | `/account/{orders,subscriptions,addresses,preferences,loyalty,billing}` — signed-out sign-in states |
| `g14` | `/account` — authed hub (fixture member): name row, live-order card, section list |
| `g15`, `g15b` | `/account/subscriptions` — authed "Your plans" card, and the delivery list expanded |

### Choices without a reference screen (what changed → why)

| Before 11g | Production (11g) | Rule |
|---|---|---|
| Wizard option rows as `SquircleOptionCard` (a bordered squircle with an `<h4>` and a check-icon), selection a `border-2 border-gold` surface | inline `<button>` rows on the checkout tap-to-select grammar (`border-gold bg-primary/10 text-primary` selected, `border-transparent bg-secondary text-ink-muted` idle) | one selection grammar across the funnel; the primitive stays for `/styleguide` |
| Segmented and tab controls painted solid gold when active (`/start` veg toggle, `TrialStart` toggle, `AccountNav` underline, loyalty/protocol track chips) | the same tap-to-select tint (gold border + faint primary tint) | gold is the action colour, not a selection fill |
| Prices, PINs, dates and figures in gold or bold sans (`font-clinical-data text-gold-text`, `tabular … text-ink`) | data face (`.font-data font-bold text-primary`) — trial prices, subscription price and window, order amounts, wallet balance, loyalty figures, referral awards | amounts are data; gold is the action colour |
| Section titles and item names as 14 px bold sans | display face (Fraunces) — the page-h1 grammar and the card-title grammar | one heading language across onboarding and account |
| `rounded-3xl`/`rounded-card` cards with `shadow-sm`/`shadow-lg` hovers; native inputs with a `ring` focus | `rounded-2xl` cards without the hairline-and-shadow; the field grammar (`min-h-[50px]`, `focus-visible:border-primary`) | the 11c card radius and field grammar; a perceivable boundary from fill, not shadow |
| `TrialStart` sticky CTA as a hand-rolled `fixed bottom-16 … bg-[var(--glass)]` bar | the shared `StickyAction` chrome anchored at `bottom-0` (the focus shell mounts no tab bar) | one sticky-CTA primitive (11b); the commitment CTA matches CheckoutPay |
| `AccountHub` section links as nine bordered cards | one `divide-y divide-line` card of display-title rows | the account content order (`AccountHub` as shipped) in one card, not nine boxes |
| Row actions (Track, Manage, Skip, Edit, Set default) as gold-text links without a hit floor | text-actions with a 44 px hit area (`-my-2 min-h-11`), preserving the skeleton-mirrored row height | Law 8 targets; the pending skeletons stay CLS-stable |

Unchanged on purpose: every rendered string, question, `data-screen-*` marker, `aria`, `href`,
`role`, form field, handler and the phone-auth cooldown/stages — presentation only. The
subscription price line gained a `<span>` wrapper (text identical). Deferred, not touched
here: the global header location trigger (`ServiceabilityBar` / `DeliveryAddressBar` — shell
chrome on home/menu/plan, 11h), the clinical dashboards behind `/account/{history,symptoms,
wellness}` (their page chrome is restyled; the dashboard bodies are 11h), `WellnessHub`,
`BloodReportOCR`, and `EveningAddOffer` (Breeze fallback, 11h).

## PR-11h — shell chrome: the header location trigger

The mobile shell the brief names (§ "Preserve the delivered shell pattern"; the
reference-→-production map's shell row) was already on the grammar after 11a–11g
for `Header`, `HeaderShell`, `FocusHeader`, `MobileBottomNav` and `app/layout.tsx`.
The one piece still on the old face was the header's **location trigger** —
`ServiceabilityBar` and `DeliveryAddressBar` — deliberately deferred from 11g
(§ PR-11g) because it renders in the global `<header>` on every page and owns the
`layout-vrt` `global-header` baseline. This finishes it.

`11h/after*` carry the mandated seven on the 11h tree plus the four header-state
frames below; `11h/before*` are the same on the merged 11g tree. The header
strips (`h01`, `h02`) are cropped to the top 132px so the trigger is legible;
the serviceable and unserviceable states are driven by seeding the widget's
`tnm_serviceability_state` and stubbing `/api/serviceability` — the pincode and
verdict are fixture-driven.

| Frame | Surface |
|---|---|
| `01`–`07` | the mandated seven — the header trigger rides `01-home` and `02-menu` |
| `h01` | header, default `Set location` trigger |
| `h02` | header, serviceable pill (`201301 ✓`) |
| `h03` | home, unserviceable state (`We're not in 400001 yet` + notify-me) |
| `h04` | the location sheet opened from the header trigger |

### Choices without a reference screen (what changed → why)

| Before 11h | Production (11h) | Rule |
|---|---|---|
| Triggers on `rounded-xl` with a `shadow-sm` hairline | `rounded-full`, no shadow — the pill shape the serviceable state already used | one pill shape for the location control; boundary from fill/border, not shadow |
| Arbitrary colour utilities (`bg-[var(--surface-subtle)]`, `border-[var(--line-strong)]`, `text-[var(--ink)]`) | the registered tokens (`bg-secondary`, `border-line-strong`, `text-ink`) | the token layer, not raw `var()` reaches — same values, lint-visible |
| Pin icon and `MAP` tag in `text-gold`; serviceable tick in `text-[var(--success)]` | icon/tag in `text-accent`, tick in `text-sage-text` | gold stays the action colour; the trigger's marks are accent/signal, not action |
| Sheet `rounded-t-3xl … shadow-2xl`; saved-address rows `bg-surface-raised` / `bg-bg`; manual pin field with a `line-strong` focus ring | sheet `rounded-t-2xl shadow-[var(--shadow-raised)]`; rows on the tap-to-select tint (`bg-primary/10` / `bg-secondary`); field grammar (`min-h-[50px]`, `focus-visible:border-primary`) | the 11c card/sheet radius, selection tint and field grammar |
| Unserviceable + undeliverable notices as danger-bordered cards | the plain grammar card / a secondary note | a notice is a note, not an alert box; signal stays in the text |

Unchanged on purpose: every rendered string, pincode logic, the `MENU_FIT`
width clamp and its measured comment, the localStorage keys, `aria` labels,
handlers and the one-instance-per-page contract — presentation only. `layout-vrt`'s
`global-header` baseline is regenerated in its own commit from the CI artifact,
since the trigger's shape changed. The genuinely un-restyled **feature and
marketing pages** (b2b, challenges, coach, legal, `custom-build`, and the
`/account/{history,symptoms,wellness}` clinical dashboards) are a separate,
larger body of work — a follow-up, not this shell PR.
