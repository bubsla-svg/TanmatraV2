# Batch 3 Grounding — Acquisition & Landing Routes

> Phase 3 reconciliation input for Route Briefs 14–20. Establishes, per route, the
> **real** backend contract and the logic that must survive wiring. Written before
> transmission so the Stitch briefs describe the contract the server actually
> enforces, not the placeholder the storefront currently renders.

## Route → real path map

| Runbook item | Real storefront path | Page LOC |
|---|---|---|
| `/corporate-wellness` | `app/corporate-wellness/page.tsx` | 96 |
| `/metabolic` | `app/metabolic/page.tsx` | 104 |
| `/rd-partners` | `app/rd-partners/page.tsx` + `app/rd-partners/apply/page.tsx` | 15 + 27 |
| `/partners/gyms` | `app/partners/gyms/page.tsx` (siblings: `fitness-clubs`, `dietitians`) | 111 |
| `/meal-deals` | `app/meal-deals/page.tsx` | 47 |
| `/meal-recommendations` | `app/meal-recommendations/page.tsx` | 33 |
| — (Batch 3 adjacency) | `app/care/[condition]/page.tsx`, `app/premium/page.tsx` | 104 / 52 |

## Lead-capture contracts (server-enforced)

Three landing funnels post to three **different** endpoints with three different
schemas. Two are already wired; one is not.

### 1. `POST /corporate-leads` — WIRED ✅

`artifacts/api-server/src/routes/corporateLeads.ts`. Client:
`artifacts/storefront/lib/corporateApi.ts` (has `corporateApi.test.ts`), rendered
through `components/landing/LeadForm.tsx`. Rate-limited by `corporateLeadRateLimit`.

```
kind          "corporate" | "gym" | "fitness_club"      (required)
name          2–80 chars                                 (required)
workEmail     email, ≤254                                (required)
company       2–120 chars                                (required)
teamSizeBand  "1-20" | "21-100" | "101-500" | "500+"     (required)
parkOrSector  ≤120                                       optional
phone         ≤20                                        optional
message       ≤1000                                      optional
source        ≤160                                       optional
```

### 2. `POST /partners/leads` — WIRED ✅

`artifacts/api-server/src/routes/partnerLeads.ts`. Same `LeadForm.tsx`, non-corporate
branch. Two cross-field refinements the UI must honour:

```
kind            "gym" | "rd" | "trainer" | "dietitian" | "fitness_club"  (required)
name            2–80                                                     (required)
email           email ≤254   ┐ at least ONE of the two is required
workEmail       email ≤254   ┘ (refine → error surfaces on `email`)
rdRegNo         ≤80 — REQUIRED when kind ∈ {rd, dietitian}, min length 4,
                must match /^[A-Za-z0-9][A-Za-z0-9\s/.-]{2,30}$/
                (e.g. "RD-1234", "IDA/5678")
company, teamSizeBand, parkOrSector, phone, practiceSetting, message, source — optional
```

Design consequence: the `rdRegNo` field is **conditionally required**, so the
partner form cannot be a flat single-column set of always-optional inputs. The
regex error message is user-facing copy the design must have room to show.

### 3. `POST /rd-partners/applications` — **NOT WIRED** ❌

`artifacts/api-server/src/routes/rdPartners.ts:232`, spec'd in
`lib/api-spec/openapi.yaml:599` as `rdPartnersSubmitApplication`. Fully implemented
server-side — inserts into `rdApplicationsTable`, calls `notifyOpsOfApplication()`
and `sendRdWelcomePacket()`, and has a follow-on
`POST /rd-partners/applications/:id/create-account`. Submissions are rate-limited to
**5 per IP per 24 h**.

`components/rd-partners/PartnerWizard.tsx` does not call it. It collects six fields
into `useState` and `setStep("submitted")` renders a success panel reading *"Our
Clinical Governance board reviews all credentials within 48 hours."* Nothing is
transmitted; the applicant's licence number is discarded on unmount. This is a
silent dead-end on a recruitment funnel and a Phase 3 rule-2/rule-4 violation that
predates the redesign — fixing it is part of Batch 3 wiring, not a side quest.

The real schema is 15 fields plus an OTP sub-flow:

```
path                "partner" | "advisory" | "both"                    (required)
fullName            2–200                                              (required)
email               email ≤200                                         (required)
credentials         1–200                                              (required)
registrationBody    ≤120                                    optional/nullable
registrationNumber  ≤80                                     optional/nullable
yearsExperience     int 0–80                                           (required)
specializations     string[] (≤20 items, each ≤80)          default []
cityRegion          2–200                                              (required)
languages           string[] (≤20 items, each ≤40)          default []
practiceSetting     "solo"|"clinic"|"hospital"|"corporate"|
                    "academia"|"online-only"|"other"                   (required)
clientVolumeBucket  "lt10"|"10_50"|"50_200"|"gt200"          optional/nullable
interests           string[] (≤20 items, each ≤80)          default []
bio                 ≤2000                                   optional/nullable
whatsapp            { countryCode, phone }                  optional
whatsappOptIn       boolean                                  default false
notifyPref          "daily" | "weekly" | "critical"          default "weekly"
sessionId           8–64 chars — stitches funnel events                (required)
```

**WhatsApp opt-in is server-authoritative.** `whatsappOptIn: true` is honoured only
if `consumeOtpProof(sessionId, e164)` finds proof that this session completed
`POST /rd-partners/whatsapp/verify-otp` for that exact number. Absent proof the
server silently downgrades `whatsappOptIn` to `false` and still persists the row.
So the design needs a real two-call verification step:

```
POST /rd-partners/whatsapp/send-otp    → sends code
POST /rd-partners/whatsapp/verify-otp  → mints the proof
POST /rd-partners/applications         → consumes it
```

**Funnel telemetry:** `POST /rd-partners/events` accepts
`{ sessionId, eventName, step?, applicationId?, extra? }`. `sessionId` must be
generated once and held stable across the whole wizard — which is precisely why
wizard state cannot live in per-step local `useState`.

## Catalog-backed routes

Both read the same server-side source, so neither may fetch on the client:

- `/meal-deals` → `await fetchMenu()` from `@/lib/catalog` → `dishes` passed to
  `BundleOfferCard` (85 LOC) and `DealsFilterBar` (73 LOC), each inside `<Suspense>`.
- `/meal-recommendations` → `await fetchMenu()` → `SmartRecommendationsGrid` (73 LOC),
  inside `<Suspense>`.

Preserve on both: the server `fetchMenu()` call, the `Suspense` boundaries, and the
prop shape. Prices come from the catalog payload and are rendered verbatim — the
"value density per ₹100" copy on `/meal-deals` is a *derived display* over
server amounts, never a client-side repricing.

**Combo rule (repo law, `CLAUDE.md`):** a combo card must be a single clickable card
that opens a Dialog listing its constituent dishes, each linking to `/dish/:slug`,
with an "Add Combo" CTA. `BundleOfferCard` is the surface that has to keep this
shape — Stitch must not flatten it into a grid of separately-tappable dish tiles.

## Known token defect in this batch

`PartnerWizard.tsx:117` paints the submit CTA `bg-gold` + `text-white`. Gold
`#D4AF37` under white text measures ≈1.9:1 — an AA failure. The token law is
`--gold-ink` (`#111318`, 8.84:1). `lint:tokens` does not catch it because the class
is a palette utility, not a raw hex, and the palette-class ban was revoked for the
storefront under DS-0. Fix during wiring.

## Wiring checklist for Batch 3

- [ ] `LeadForm.tsx` keeps both endpoint branches and the conditional `rdRegNo` rule
- [ ] `PartnerWizard` posts to `/rd-partners/applications` with the full 15-field payload
- [ ] Wizard `sessionId` generated once, stable across steps, emitted to `/rd-partners/events`
- [ ] Wizard step + form state survives step changes (URL or store, not per-step `useState`)
- [ ] WhatsApp opt-in runs the real send-otp → verify-otp pair before submit
- [ ] Submit handles 400 (field issues array), 429 (5/IP/24h) with visible copy
- [ ] `fetchMenu()` stays server-side on `/meal-deals` and `/meal-recommendations`
- [ ] `BundleOfferCard` keeps the single-card → Dialog → `/dish/:slug` + Add Combo shape
- [ ] Gold CTAs use `--gold-ink`, never `text-white`
- [ ] No client-side price arithmetic anywhere in the batch
