# Batch 3 — Route Briefs 14–20 (transmittable payloads)

> Phase 1 payloads for the acquisition/landing batch, compiled against real code
> (see `BATCH-3-GROUNDING.md` for the contracts each one encodes). Banked here
> verbatim because the MCP generation path cannot currently return them — see
> **Transmission blocker** at the bottom. Anyone with a working Stitch session can
> paste these straight in.
>
> Brief 14 is the **kit-defining** brief: `/corporate-wellness` exercises hero +
> benefit grid + calculator + lead form + FAQ + sticky bar, which are the shared
> components behind `/partners/gyms`, `/metabolic` and `/care`. Briefs 15–20 assume
> that vocabulary and add only their own islands.

Constant across all seven (do not restate per brief when transmitting):

```
"Brand_Vibe": "Premium Clinical Metabolic OS. Clean, appetizing, and empathetic. Not a clinical textbook. Focus on food imagery and restrain from large text blocks",
"Design_System": "Strict iOS-Grade Mobile-First. Dark mode (bg-neutral-950). Squircle geometry (rounded-3xl outer, rounded-2xl inner, full for pills). Kinetic haptic scale-98 on active states. Zero flat borders (border-white/[0.06] + backdrop-blur-md). Clinical Gold #D4AF37 is the ONLY interactive colour; ink on gold is #111318, never white. Royal Indigo #3E4C8A is structural signal only and never appears on a button. Dark greys neutral-950/900, off-white #F5F5F4 ink, #A3A3A3 secondary."
```

Global UX constraints that apply to every brief in the batch: global chrome owns
header / bottom-nav / footer so Stitch returns **page content only**; `max-w-screen-xl
mx-auto` on desktop; any bottom-fixed element gets `pb-safe` plus reserved page
spacing so it never covers content; footers hidden on mobile by the app shell; all
numerals monospace `tabular-nums`; section rhythm `clamp(3rem, 8vw, 6rem)`;
progressive disclosure, never a paragraph where a tile will do.

---

## Brief 14 — `/corporate-wellness`

**Target_Route**: `/corporate-wellness` — HR-facing B2B team-lunch lander. Also
defines the shared landing kit.

**Data_Props_Required**: Server component, zero client fetching. Static copy props
from `content/landing/corporate`: `CORPORATE_HERO`, `PAIN_TILES`, `HOW_IT_WORKS`,
`DIFFERENTIATORS`, `DELIVERY_DESTINATIONS` (string[]), `CORPORATE_FAQ`,
`CORPORATE_FORM{heading,blurb,kind,source,submitLabel,whatsApp}`. Emits WebPage
JSON-LD. Two client islands: **SubsidyCalculator** — state `{modelId, teamSize:40}`,
renders `perEmployeePaise()` and monthly total through `formatPaise()`; it is an
ESTIMATOR, labelled as an estimate with "GST included", and must never be styled as
a checkout total. **CorporateLeadForm** — single-step (NOT a wizard), props
`{defaultKind, lockKind, source, submitLabel, whatsApp}`, fields mapping 1:1 to
`POST /corporate-leads`: name (2–80 req), workEmail (req), company (2–120 req),
teamSizeBand (req, one of `1-20`/`21-100`/`101-500`/`500+`), parkOrSector, phone,
message (≤1000); kind locked to `corporate` so **no kind chooser renders**. States:
idle, busy, inline error, persistent success panel; error copy covers 400 and 429
(~5/hour per IP) with a retry message, not a dead button. No auth on this route.
Anchors `#pilot-form` and `#how-it-works` must exist.

**Critical_UX_Constraints**: Sticky bottom bar is the primary conversion path — one
gold "Book Pilot Call" pill → `#pilot-form`. Tile groups are icon + one short
declarative line. `DELIVERY_DESTINATIONS` is a wrap of map-pin pill chips, not a
list. FAQ accordion fully collapsed. Hero is a real plated-meal photo, not an office
stock shot; offset asymmetric, no centered hero. Section order, exactly these eight
and nothing invented: hero → pain tiles → how it works → subsidy estimator →
differentiators → delivery chips → pilot lead form → HR FAQ.

---

## Brief 15 — `/metabolic`

**Data_Props_Required**: Server component; `await fetchMenu()` + `toProxiedImage()`
supply dishes. Composes `BenefitGrid`, `PlanCard`, `FaqAccordion`, and the
**MetabolicExplorer** client island (`MetabolicDish[]`). Copy from
`content/landing/metabolic`. Prices arrive from the catalog and render verbatim —
no client arithmetic. CTAs route into `/plans` and `/trial`.

**Critical_UX_Constraints**: Clinical claims stay short and are visually separated
from marketing copy. Plan cards reuse the money-path presentation from Batch 1 — gold
only on the CTA, never on the price. Explorer is a filterable rail, not a wall of
cards. Keep the real section order found in code; invent no new protocol tiers.

---

## Brief 16 — `/rd-partners` + `/rd-partners/apply`

**Data_Props_Required**: `PartnerHero` (static) plus **PartnerWizard**, rebuilt
against the real contract — owner-approved to replace the current six-field local
dead end. Wizard posts `POST /rd-partners/applications` via
`lib/rdPartnerApi.ts` (already shipped and tested). Fields: path
(`partner|advisory|both`), fullName (2–200), email (≤200, unique → 409), credentials
(1–200), registrationBody, registrationNumber, yearsExperience (int 0–80), cityRegion
(2–200), practiceSetting (7-value enum), clientVolumeBucket (4-value enum, show
labels not wire values), specializations / languages / interests (multi-select,
≤20 each), bio (≤2000), notifyPref (`daily|weekly|critical`). Plus a WhatsApp opt-in
sub-flow: `send-otp` → `verify-otp` → submit, where the opt-in is only honoured if
this **stable** `sessionId` verified that number. Emits `POST /rd-partners/events`
breadcrumbs.

**Critical_UX_Constraints**: Multi-step, so state MUST live in `useSearchParams` or a
store — a per-step `useState` reset silently loses the opt-in and the funnel id. One
`sessionId` for the wizard's whole life. Surface 400 field issues inline, 409 as
"application already exists", 429 as the 5-per-day limit. The OTP step must be
skippable — a 502 from the transport lets the applicant continue without opt-in.
Never show a success panel unless the server confirmed persistence.

---

## Brief 17 — `/partners/gyms`

**Data_Props_Required**: Static copy from `content/landing/partners`
(`GYMS_LANDING`, `GYM_MODELS`); composes `LandingHero`, `BenefitGrid`, `ProofStrip`,
`FaqAccordion`, `StickyCtaBar`, **GymRevenueCalculator** (estimator, same rules as
Brief 14), and `CorporateLeadForm`. Money figures via `formatPaise()`. The form here
posts `POST /partners/leads`, whose schema differs from corporate: kind
(`gym|rd|trainer|dietitian|fitness_club`), **email OR workEmail — at least one
required**, and `rdRegNo` becomes **required with format
`^[A-Za-z0-9][A-Za-z0-9\s/.-]{2,30}$`** when kind is `rd`/`dietitian`.
Sibling routes `/partners/fitness-clubs` and `/partners/dietitians` inherit this design.

**Critical_UX_Constraints**: The conditional `rdRegNo` means the form cannot be a flat
always-optional column — it needs a revealed field with room for the format error
copy. Revenue calculator is explicitly an estimate. Gym partner models are compared
in a rail, not a pricing table.

---

## Brief 18 — `/meal-deals`

**Data_Props_Required**: Server `await fetchMenu()` → `dishes` into
**BundleOfferCard** and **DealsFilterBar**, each inside its own `<Suspense>`.
All amounts server-owned; "value density per ₹100" is a derived *display*, never a
reprice.

**Critical_UX_Constraints**: **Repo law** — a combo card is a single clickable card
opening a Dialog that lists its constituent dishes, each linking to `/dish/:slug`,
with an "Add Combo" CTA. Stitch must not flatten it into separately-tappable dish
tiles. Density sorting is a chip rail; keep the two-section split (featured bundles,
then the live menu engine).

---

## Brief 19 — `/meal-recommendations`

**Data_Props_Required**: Server `await fetchMenu()` → **SmartRecommendationsGrid**
(`dishes`) inside `<Suspense>`, rendering `RecommendationCard`s. Therapeutic
reasoning is per-dish copy, not a banner essay. 1-click add reuses the existing cart
action.

**Critical_UX_Constraints**: Each card pairs a food image with a macro badge row and
one line of reasoning — no paragraph. If the dish carries no rating, omit the star row
rather than rendering empty stars (matches shipped behaviour). Suspense fallback is a
skeletal shimmer matching final geometry, not a spinner.

---

## Brief 20 — `/care/[condition]`

**Data_Props_Required**: Dynamic server route; `await fetchMenu()` + `getRds()`
(`lib/rdApi`), `notFound()` on an unknown condition. Composes `CareHero`,
`CareRdRoster`, `CareEvidence` (`CareDish[]`), `BenefitGrid`, `PlanCard`; copy from
`content/landing/care`. Condition slug drives all copy — no hardcoded condition.

**Critical_UX_Constraints**: Evidence section stays visibly evidence — citations
legible, never dressed as marketing. RD roster is a face-first rail linking to RD
detail. Plan cards keep money-path presentation. Highest clinical-sensitivity surface
in the batch: no claim may be invented that is not in the content file.

---

## Transmission blocker (as of this commit)

Generation through the MCP client is length-bound, not broken:

| Attempt | Prompt size | Result |
|---|---|---|
| Brief 14, full structured payload | ~6 KB | timeout at 60 s |
| Brief 14, compressed | ~2.5 KB | timeout at 60 s |
| Brief 14, prose-simplified | ~1.9 KB | timeout at 60 s |
| Brief 14, terse | ~460 B | timeout at 60 s |
| *"A simple dark-mode card showing a meal name and its price."* | ~60 B | **COMPLETE** — screen `77a83f0c2142427583acd7f1926c7c7e` |

So auth, project and theme are all fine — a screen really did generate, correctly
themed (Satoshi + JetBrains Mono, gold `#d4af37`), and the design system attaches
automatically without passing `designSystem`.

The blocker is that **a timeout is terminal**. `generate_screen_from_text` returns the
screen id only in its success payload, and neither `list_screens` nor `get_project`
enumerates generated screens — both report only the uploaded `DESIGN.md`, even after
`77a83f0c` was confirmed COMPLETE. With no id and no listing, a screen that generates
after the 60 s cap is unreachable forever. There is no polling handle to recover it.

Also noted: the HTTP endpoint `https://stitch.googleapis.com/mcp` reports
`Connected · tools fetch failed — can't resolve reference #/$defs/ScreenInstance`,
so it cannot serve tools to this client at all; the working tools come from the
project-scoped `@_davideast/stitch-mcp` server. MCP config changes need a session
restart to take effect.

**Unblocking options**: run these briefs from an interactive session or the Stitch
web UI where generation isn't capped at 60 s and the id is visible, then drop the
returned HTML into `docs/stitch/route-NN-*/` and the wiring can proceed here as it
did for Batches 1–2.
