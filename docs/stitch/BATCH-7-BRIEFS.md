# Batch 7 — Route Briefs 40–43 (transmittable payloads)

> Phase 2 payloads for the RD-booking/clinical-consult batch (G3), compiled
> against real code and `BATCH-7-GROUNDING.md` (read that first — it documents
> the `bookable` gate, the 404-vs-outage conflation, and the two coach-chat
> bugs fixed before this batch was briefable, plus the known limitations left
> deliberately unfixed). Ordered as the real funnel: browse the directory,
> land on a profile and book, arrive via a clinical protocol page, or talk to
> the AI coach — a parallel, always-available path.
>
> Two different visual registers apply here, split cleanly by route type:
> **`rd` and `rd/[slug]` are app-shell utility surfaces** (directory + booking
> flow) — same flat-card, no-dark-scope vocabulary Batch 5/6 established.
> **`clinical` is a public marketing/conversion lander**, structurally
> parallel to Batch 3's already-adopted `/metabolic` and `/care/[condition]`
> — it should read as a landing page, not an app-shell screen, though it does
> **not** reuse Batch 3's `LandingHero`/`ProofStrip`/`StickyCtaBar` kit
> components today (it has its own simpler `ProtocolView` template shared
> with `/performance`, out of scope) — restyle within that existing
> structure rather than swapping in the landing kit, which would be new
> scope beyond this batch. **`coach` is session-gated app-shell**, same
> register as `rd`/`rd/[slug]`.

Constant across all four (do not restate per brief when transmitting):

```
"Brand_Vibe": "Premium Clinical Metabolic OS. Clean, appetizing, and empathetic. Not a clinical textbook. Focus on food imagery and restrain from large text blocks",
"Design_System": "Light-mode (NOT the dark checkout scope) — bg-bg/bg-surface neutrals, text-ink primary, text-ink-muted/text-ink-faint secondary. Squircle geometry (rounded-xl cards, rounded-2xl hero/summary cards, full pills for status/badges). Clinical Gold #D4AF37 is the ONLY interactive fill colour; ink on a gold fill is var(--gold-ink), never white. Sage (var(--sage-soft) bg / var(--sage-text) fg) is status/positive signal only — never a button fill. Destructive actions use var(--danger) as text/border, never a filled button. All money and counts render tabular-nums, always whole rupees."
```

**Batch 7 vocabulary this must match** (confirmed against shipped code, not
invented):

- **`RdCard` is fixed, reusable vocabulary** — rendered identically by `rd`
  (the directory) and `clinical` (its "Talk to a specialist" section):
  avatar-initials chip (gold tint), name/title, up to 4 specialty chips,
  years+languages line, a footer row pairing a free-intro sage badge and/or
  "from ₹X" against a "View profile →" link — and, new in this batch, a
  "Not currently accepting bookings" muted line in that same footer slot
  when the RD isn't bookable. Do not invent a second directory-card shape.
- **Card pattern**: `rounded-xl border border-line bg-surface p-4`–`p-5` for
  list rows and mid-weight cards; `rounded-2xl` + more padding for a
  screen's one hero/summary surface. Flat surface + hairline border only.
- **Status/provenance pills**: `rounded-full px-2.5 py-0.5 text-xs
  font-medium`, `bg-sage-soft text-sage-text` for a positive/free signal,
  plain bordered/muted for neutral. No fifth ad-hoc treatment.
- **Primary CTA**: `rounded-xl bg-gold px-5 py-3 text-sm font-semibold
  text-[var(--gold-ink)]` (never `text-white`). Secondary actions are plain
  inline text links or outline buttons (`border border-line`), never a
  second filled color.
- **Auth gate**: `rd/[slug]`'s booking action and `coach` are session-gated
  — 401/no-session renders `needsAuth`, a one-line prompt + inline
  `<PhoneAuth>`, never a redirect. `rd` (directory) and `clinical` need no
  auth at all — pricing and RD profiles are public information.
- **Loading / empty / error stay genuinely distinct**, per the established
  precedent — a plain-text loading line, an honest empty-state sentence,
  and (new in this batch, `rd/[slug]`) a "briefly unavailable" state that
  must never look identical to "this doesn't exist."
- Global UX constraints unchanged: `max-w-2xl`/`max-w-5xl` containers per
  route (these are narrower, mobile-first single/two-column surfaces except
  `clinical`'s wider landing layout), all numerals `tabular-nums`, real
  list keys throughout.

---

## Brief 40 — `/rd`

**Target_Route**: `/rd` — public RD directory, server-rendered, ISR. Fully
wired, restyle only.

**Data_Props_Required**: An eyebrow ("Registered dietitians"), H1 ("Our
dietitians"), a one-line description, then either an honest "directory
briefly unavailable" line (empty state) or a responsive grid
(`sm:grid-cols-2 lg:grid-cols-3`) of **RdCard**s. Each card: a gold-tinted
initials avatar chip + name + title, up to 4 specialty chips, a
years-experience + languages line, and a footer row that's one of: a sage
"Free 15-min intro" badge optionally paired with a tabular "from ₹X" price,
OR — for a non-bookable RD — a muted "Not currently accepting bookings"
line (this is new, real server data this batch wires in for the first
time; show at least one card demonstrating it alongside cards showing the
normal bookable footer). Every card ends with a "View profile →" link.

**Critical_UX_Constraints**: This is a scan-and-choose screen — keep each
card's information dense but skimmable, consistent hierarchy across every
card (name/title always the same weight, specialty chips always capped at
4). The non-bookable footer state must read as informational, not as an
error or a dead end — the card is still a real, clickable profile (bio,
credentials, specialties are all still worth reading even if booking is
currently closed).

---

## Brief 41 — `/rd/[slug]`

**Target_Route**: `/rd/[slug]` — RD profile + the batch's one real money
path. Server-rendered profile content; **RdBooking** (client island) owns
the booking flow.

**Data_Props_Required**: A back-link to `/rd`, then profile content:
name/title, years+languages (tabular), credential chips, bio, specialty
chips, and a "Consultations" price-list card (3 rows — 15-min intro /
30-min / 45-min — each a label against a tabular price, "Free" in sage-text
when zero). Below that, **RdBooking**, with FIVE genuinely distinct states
to design (show the two most important — the interactive form and the
not-bookable state — as the primary renderings, but account for all five in
the design language): (1) **not bookable** — a plain card, "Not currently
accepting bookings" + a one-line explanation, no interactive elements; (2)
**needs auth** — sign-in prompt + `PhoneAuth` island; (3) **confirmed
booking** — a sage-tinted card, date/time (tabular) + "Free intro" or "Paid
₹X"; (4) **the live form** — three session-kind pills (each showing price
or "Free"), a slot picker (its own loading/empty/populated sub-states,
scrollable chip grid of time slots, tabular), and a primary CTA whose label
changes with state ("Book free intro" / "Book & pay ₹X" / "Pay ₹X" /
"Working…"); (5) a "slot held, complete payment" interstitial line when a
paid booking is pending. Also design the page-level "briefly unavailable"
fallback (new this batch): a back-link + a single muted sentence, no 404
chrome, no broken-looking layout — this replaces the whole profile content
area when the API is transiently unreachable, so it must look intentional
on its own, not like a stripped-down error page.

**Critical_UX_Constraints**: The client never shows a price it didn't get
from the server — every rupee figure on this page is real. The slot-picker
grid needs to comfortably show ~24 chips without feeling like a wall of
buttons (the real component caps the visible list and scrolls). The
not-bookable state and the briefly-unavailable state must look visually
distinct from each other and from a normal 404 — they are three different
situations (RD exists but isn't taking bookings / API hiccup / genuinely no
such RD) and conflating any two of them was exactly the defect this batch
fixed.

---

## Brief 42 — `/clinical`

**Target_Route**: `/clinical` — public clinical-protocol landing/conversion
page. Server-rendered via the shared `ProtocolView` template (also drives
`/performance`, out of scope). Fully wired, functionally complete,
restyle-and-polish rather than restructure.

**Data_Props_Required**: A hero (eyebrow, H1 with a gold accent span,
description, two CTAs — "See the dishes" filled gold, "Book a free RD
consult" outlined — plus a tabular qualifying-dish/RD-count stat line), a
**BenefitGrid** "science pillars" section (already-shipped shared
component, reuse as-is), a **ProtocolDishRail** horizontal scroll of
featured dishes (already-shipped, reuse as-is), a "The program" section
built around one **PlanCard** (already-shipped, same money-card vocabulary
as `/metabolic` and `/care` — do not redesign the card itself, just its
section framing), a conditional "Talk to a specialist" section reusing
**RdCard** (same component as Briefs 40/41 — including its new
not-bookable footer state, if any of the matched RDs happen to be
non-bookable), a conditional sage-tinted safety-disclaimer card (real
compliance copy, `CARE_SAFETY` content — must not be reworded or
softened), and a closing "Ready when you are" CTA card mirroring the hero's
two actions plus a third "Try 3 days first" outline link.

**Critical_UX_Constraints**: This is the one route in the batch that should
read as a conversion page, not a utility screen — give the hero and section
transitions real visual weight (this is closer in spirit to Batch 3's
already-adopted `/metabolic`/`/care` than to the account-hub vocabulary).
Do not invent condition-specific filtering on the RD section or the dish
rail beyond what `cfg.filter`/`cfg.rdKeywords` already compute — the section
either appears with real matched specialists or is omitted entirely (a real
conditional, not an empty state to fill with placeholder content). The
safety-disclaimer card's copy is compliance-reviewed (FSSAI advertising
regs) — restyle its container, never alter its text.

---

## Brief 43 — `/coach`

**Target_Route**: `/coach` — session-gated AI nutrition-coach chat,
`noindex`. Fully wired, restyle only.

**Data_Props_Required**: A static page header (title + a standing "not
medical advice" disclaimer, both already authored — do not reword). Then
**CoachChat**: a loading line, a sign-in gate (prompt + inline `PhoneAuth`
— and, new this batch, a conditional error line above the auth widget for
the "your session expired" case), or the chat itself — an empty-state hint
bubble ("Ask me to explain a dish's macros…"), then a message thread:
user turns right-aligned in a gold bubble, agent turns left-aligned in a
neutral surface bubble, each optionally followed by one or more inline
**CoachActionCard**s. Design both action-card variants: `book_rd` (a
Registered-Dietitian prompt card with urgency-conditioned copy, a
consults-remaining sentence — **including the zero-remaining case**, which
this batch's fix now renders distinctly from the "unknown" case that omits
the sentence entirely — and a gold "Book a dietitian →" link) and
`add_to_cart` (dish name, a server-formatted price label, an optional
target-conditioned suffix and reasoning line, a gold "View & add →" link to
the dish PDP — deliberately not a direct add-to-cart button, since the
server card doesn't carry the numeric id the cart needs). A sticky composer
at the bottom (text input + Send button, disabled while streaming).

**Critical_UX_Constraints**: Message bubbles must stay readable at up to
~85% width, not full-bleed — this is a conversational surface, not a
document. The action cards are secondary to the message text they follow —
give them clear but not dominant visual weight (a bordered card, not
another gold-filled hero moment competing with the primary CTA elsewhere on
the page). The zero-consults-remaining sentence is a real, distinct piece
of information (this batch's fix) — do not let a restyle re-collapse it
visually with the "no sentence shown" case by, say, rendering an empty
line in both.

---

## Generation log

All four generated against project `9085082841997152511` ("Tanmatra
Storefront — Clinical Metabolic OS (Batches 3–5)") with design system
`assets/0b599b1692164d81b3389c7121485392` ("Tanmatra"), `GEMINI_3_1_PRO`,
`MOBILE`, one at a time via the same direct-MCP-over-HTTP curl technique
Batches 3–6's resolution sections document.

| Brief | Screen id | Title | Size | Banked at |
|---|---|---|---|---|
| 40 | `5da3e865a66b4c9289f3054e6559e1e0` | Dietitian Directory | 780×1800 | `route-40-rd-directory/` |
| 41 | `d62fa0eeda2b4fecaa352cb9099ce3aa` | Dietitian Profile & Booking - Dr. Anjali Nair | 780×3338 | `route-41-rd-profile/` |
| 42 | `1ccc7d161be84ad6a6481577a44acdd3` | Metabolic Healing - Clinical Protocol | 780×8532 | `route-42-clinical/` |
| 43 | `759b5326edb9497e8fb7cd6bae834350` | AI Nutrition Coach Chat - /coach | 780×1768 | `route-43-coach/` |

QA pass over all four banked files: gold defined once per file
(`primary-container`/`primary` both resolve to the bright `#D4AF37`, always
paired with a dark ink text class — `on-primary-fixed`/`on-background` —
never the white `on-primary`), no white-ink-on-gold anywhere a real button
renders, no filled danger/sage buttons. Brief 40's not-bookable card state
renders exactly as specified — a muted, low-opacity "Not currently
accepting bookings" line paired with an unchanged "View profile →" link,
correctly informational rather than alarming. Brief 43's `<header>`
(page title + disclaimer) and `<footer>` (sticky composer) are legitimate
real page content — they match `app/coach/page.tsx`'s own static header and
`CoachChat`'s own sticky form exactly, not invented site-wide chrome; no
logo, nav links, or account menu appear in either. **No hallucinated
chrome found in any of the four files** — a first for this project's
Stitch batches.

Brief 42's height (8532px, well beyond the other three) was checked
specifically: its heading structure matches the brief's seven sections
exactly (hero, "How it's built" with 3 pillar `h3`s, "Clinical Plates" dish
rail, "Start the Clinical program", "Clinical Directory", a compliance
notice, "Ready when you are") with no extra invented sections — the height
comes from six real images plus generous mobile section padding across a
genuinely long single-page marketing lander, not hallucinated content.
