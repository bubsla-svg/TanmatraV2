# Batch 3 — Route Briefs 14–20 (transmittable payloads)

> Phase 1 payloads for the acquisition/landing batch, compiled against real code
> (see `BATCH-3-GROUNDING.md` for the contracts each one encodes). Originally
> banked because the MCP generation path could not return them; **that blocker is
> now RESOLVED** — all seven screens are generated and banked under
> `route-14-*/` … `route-20-*/`. See **Transmission blocker → Resolution** at the
> bottom for the mechanism and the screen ids.
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

### Root cause found (follow-up session, 2026-07-30)

The 60 s cap is **client-side**: this environment launches with
`MCP_TOOL_TIMEOUT=60000`, which bounds every MCP call regardless of server. The
official endpoint (`https://stitch.googleapis.com/mcp`, `X-Goog-Api-Key` header)
serves tools fine once the schema-reference issue is absent — the whole ladder
above was re-run against it with identical results: five briefs at ~1–2 KB all
timed out; one four-line prompt (Flash, run alone) completed in-window; the same
terse prompt timed out when run concurrently with four others or on a Pro model.
"Length-bound" was really *duration*-bound all along.

Two more properties confirmed against the official endpoint:

- **Timeout is still terminal**: `list_screens` returns `{}` and
  `list_projects.screenInstances` stays `0` even for a screen the success payload
  itself confirmed COMPLETE moments earlier. There is no recovery handle.
- **The API key selects the account**: a per-key Stitch account owns its own
  projects. The `AQ.…efMOm6g` key sees a 24-project account where
  `12062470764535558612` (Batches 1–2) does not exist — reads against it fail
  with `Requested entity was not found`, which looks like a data-loss bug but is
  just the wrong account.

**Fix**: relaunch the session with `MCP_TOOL_TIMEOUT=600000` (10 min) — the env
var is read at CLI start and cannot be changed mid-session — and run one
generation at a time. Or use the Stitch web UI as above.

### Resolution (same day, this session)

The relaunch arrived still carrying `MCP_TOOL_TIMEOUT=60000`, so the harness MCP
client stayed capped — but the cap is *client*-side, so the fix was to stop using
that client: speak MCP JSON-RPC to `https://stitch.googleapis.com/mcp` directly
with `curl` (`X-Goog-Api-Key` auth, `initialize` → `tools/call`, SSE-or-JSON
response handling) under a 10-minute curl timeout. The server is stateless — no
session header needed. The API key lives outside the repo; never commit it.

Timings vindicate the diagnosis completely: the seven generations took **56 s –
2 m 20 s** each — almost all just past the 60 s cap, which is why every in-harness
attempt died and the four-line Flash prompt (alone) survived.

All seven briefs generated against project `9085082841997152511`
("Tanmatra Storefront — Clinical Metabolic OS (Batches 3–5)", the account keyed
by the current API key; Batches 1–2 live in `12062470764535558612` on the *other*
key's account) with design system `assets/0b599b1692164d81b3389c7121485392`
("Tanmatra", built from `docs/stitch/DESIGN.md` via
`create_design_system_from_design_md`), `GEMINI_3_1_PRO`, `MOBILE`, one at a time:

| Brief | Screen id | Title | Size | Banked at |
|---|---|---|---|---|
| 14 | `e59e85e442624c56bb26e55dcf925ba4` | Corporate Wellness Landing Page | 780×4888 | `route-14-corporate-wellness/` |
| 15 | `2ec0a417061c411595260fb57644d317` | Metabolic Optimization Landing Page | 780×6982 | `route-15-metabolic/` |
| 16 | `20f227e59af647f8aa6d8c7ddb4a057c` | RD Partner Application — Practice Step | 780×4214 | `route-16-rd-partners/` |
| 17 | `50fb55d9849d4751a080be80dd1593ec` | Gym Partnership Landing Page | 780×7654 | `route-17-partners-gyms/` (+1 hero imagery) |
| 18 | `83dab8d9e3524cd68e80804571264276` | Meal Bundles with Detail Modal | 780×3076 | `route-18-meal-deals/` |
| 19 | `9de9d8ff1fdc422bbe16dfac757e5c34` | Smart Meal Recommendations | 780×4104 | `route-19-meal-recommendations/` |
| 20 | `523c32f93b0940a2a41b38b025c687a9` | Diabetes Clinical Care Landing Page | 780×6580 | `route-20-care-condition/` (+2 imagery) |

Brief 18 needed one `edit_screens` round: the first pass
(`661aa6fdb8324e8b95527299d9e09779`) leaked global chrome (fixed header + bottom
nav) and flattened the combo Dialog into an inline section. The edit removed the
chrome and produced the proper open Dialog overlay with per-dish rows and a gold
"ADD COMBO" pill — the banked file is the edited screen.

Two properties of the official endpoint worth keeping: `get_screen` exists (a
recovery handle Batches 1–2 never had), and generated screens are returned in
`outputComponents[].design.screens[]` where the page is the `text/html` entry and
sibling entries are generated hero-imagery assets (banked as `hero-imagery-*.png`,
matching the Batch 1 convention).

QA pass over all seven banked files: gold defined once per file, no
white-ink-on-gold, no indigo on buttons, no global chrome (route 16's `<nav>` is
the wizard stepper, correct semantics), skeleton shimmer present in 19, combo
Dialog + "ADD COMBO" CTA present in 18. Known cosmetic nit for the wiring stage:
18's density chip reads "/$" where the shipped copy is "per ₹100" — copy binds
from code at wiring time anyway.
