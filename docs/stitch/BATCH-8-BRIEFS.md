# Batch 8 — Route Briefs 44–52 (transmittable payloads)

> Phase 2 payloads for the community/content batch (G4), compiled against real
> code and `BATCH-8-GROUNDING.md` (read that first — it documents the fabricated
> progress dashboard, the fabricated Q&A submissions, and the unstyled allergen
> chips fixed before this batch was briefable).
>
> **This batch defines the editorial vocabulary.** Batches 1–7 built landing,
> marketing, account, commerce and clinical surfaces. None of them built an
> article, a bio, a streak tracker, or a forum. There is no shared kit to
> inherit here — the one piece of prior art is `components/legal/LegalArticle.tsx`
> (back-link → title → byline → dek → section loop → `max-w-3xl` shell), and
> `recipes/[slug]`, which independently reinvents a richer version of the same
> idea inline. Brief 50 (`/recipes/[slug]`) is therefore the **anchor** of this
> batch: it is the most complete article template that already exists, and the
> other eight briefs should read as consistent with whatever it lands on.

Constant across all nine (do not restate per brief when transmitting):

```
"Brand_Vibe": "Premium Clinical Metabolic OS. Clean, appetizing, and empathetic. Not a clinical textbook. Focus on food imagery and restrain from large text blocks",
"Design_System": "Light-mode editorial/content scope (NOT the dark checkout scope) — bg-bg/bg-surface neutrals, text-ink primary, text-ink-muted/text-ink-faint secondary. Squircle geometry (rounded-xl cards, rounded-2xl feature/article cards, full pills for tags and status). Clinical Gold #D4AF37 is the ONLY interactive fill colour; ink on a gold fill is var(--gold-ink), never white. Sage (var(--sage-soft) bg / var(--sage-text) fg) is positive/status signal only — never a button fill, and never used to label a caution. Destructive/error text uses var(--danger) as text only. All counts, times, macros and money render tabular-nums."
```

**Editorial vocabulary this batch establishes** (binding on all nine):

- **One voice: warm, plain, specific.** The grounding pass found two
  incompatible registers in this feature area — the challenges routes speak
  plainly ("Join one and stay accountable"), while the tracker and Q&A had
  drifted into overwrought clinical jargon ("Live Regimen Telemetry",
  "Collective Wisdom & Advisory Care", "Behavioral Consistency"). **The plain
  register wins.** These are community surfaces, not lab reports. Prefer "Your
  streaks" to "Live Regimen Telemetry", "Questions answered by our RDs" to
  "Collective Wisdom & Advisory Care".
- **The article shell**: `max-w-3xl` single column, generous vertical rhythm,
  hero image where one exists → eyebrow pill row → `h1` → dek paragraph →
  content. Body copy is the point on these routes; give it real measure and
  line-height rather than compressing it into cards.
- **Content cards are image-led** — unlike the account/commerce cards from
  Batches 5–7, which are flat text rows. A challenge card, recipe card, or dish
  guide leads with its image (or an honest placeholder box when `image` is
  `null`, which is a real nullable field on both `Challenge` and `Recipe`).
- **Tag/filter pills**: `rounded-full px-3 py-1 text-xs`. Active filter =
  `bg-gold text-[var(--gold-ink)]`; inactive = `border border-line text-ink-muted`.
  Content taxonomy tags (goal, diet, specialty) are informational, not
  interactive, and read as `bg-surface-raised text-ink-muted`.
- **Sage means positive or complete, never caution.** This batch fixed an
  allergen list that rendered listed allergens in the success colour. Allergens,
  warnings, and disclaimers are neutral or `--danger` — never sage.
- **Auth gate**: `/challenges/[slug]`'s cohort room, `/challenges/tracker`, and
  `/qa`'s ask-form are session-gated — a signed-out visitor gets a one-line
  prompt + the inline `<PhoneAuth>` island, **never a redirect**. Reading the
  Q&A forum, the challenge list/detail, team, recipes and meal guides is fully
  public.
- **Loading / empty / error are three distinct states, and none of them is
  ever filled with invented content.** This is the batch where that rule was
  broken twice; every brief below states the honest state explicitly.
- Global constraints unchanged: `max-w-5xl` for grid/directory routes,
  `max-w-3xl` for article routes, mobile-first, real list keys throughout.

---

## Brief 44 — `/challenges`

**Target_Route**: `/challenges` — public directory of RD-led group challenges,
server-rendered with ISR. Fully wired, restyle only.

**Data_Props_Required**: An eyebrow, `h1`, and one-line description, then either
an honest empty state ("No active challenges right now — check back soon.") or a
responsive grid of **ChallengeCard**s. Each card: the challenge image (or an
honest placeholder box — `image` is genuinely `string | null`), a
client-computed status pill (upcoming / active / ended, derived from real
`startsAt`/`endsAt`), a conditional "Featured" badge (real server field, a
number guarded `> 0`), title, a two-line-clamped tagline, up to 3 goal tags,
a `tabular` line pairing `durationDays` with `memberCount`, and a "Led by
{rdName} · {date range}" footer. The entire card is one link.

**Critical_UX_Constraints**: This is the batch's first image-led card grid —
establish the treatment the recipe grid (Brief 49) will echo. The status pill
and the Featured badge are two different signals and must not read as the same
thing. Card images vary in aspect; fix the ratio and crop rather than letting
rows go ragged.

---

## Brief 45 — `/challenges/[slug]`

**Target_Route**: `/challenges/[slug]` — a single challenge: public detail above,
session-gated cohort room below. The cohort room is this batch's reference
implementation for auth-gated interactivity — it already distinguishes a 401
(session gone) from a 403 (signed in but not a member).

**Data_Props_Required**: Public section — hero image, status pill, title,
tagline, full description, goal tags, and a conditional "Shop the challenge
menu" link (only when `bundleSlug` is set). Then **ChallengeRoom**, with four
states: (1) loading; (2) signed-out — a prompt + inline `<PhoneAuth>`; (3)
signed-in, not joined — a gold "Join" CTA, and a cohort feed that reads but
shows "Join the challenge to post" in place of the composer; (4) signed-in and
joined — an outlined "Leave" control, a conditional "Upcoming RD check-ins"
list (only when there are real check-ins) with external join links, a post
composer (textarea + submit), and the feed. **PostFeed**: an honest empty state
("No posts yet — be the first to check in.") or a list of posts, each with an
avatar-initials chip, author name, relative timestamp ("3h ago" / "2d ago"),
and body.

**Critical_UX_Constraints**: The cohort feed is UGC — design it to hold real,
uneven, human-length posts, not uniform lorem. The join/leave control changes
the whole page's affordances; make that state change unmistakable. Never
design a "post" composer that appears interactive for a non-member — the real
component correctly replaces it with an explanation.

---

## Brief 46 — `/challenges/tracker`

**Target_Route**: `/challenges/tracker` — the signed-in member's personal streak
tracker. **This route was rebuilt in this batch's grounding pass** (see
grounding doc): it previously fabricated a progress dashboard for signed-out
visitors. Design for the honest version only.

**Data_Props_Required**: A three-way gate first — loading, then a signed-out
prompt + inline `<PhoneAuth>`, then a real error state (a message plus a "Try
again" action; this must never be styled to look like empty or fabricated
data). Signed in: an "Active challenges" card containing either an honest empty
state ("You haven't joined a challenge yet" + a link to `/challenges`) or a
grid of joined-challenge cards. Each card: title, a `tabular` "Day N / M" pill
(derived from the real `joinedAt` against `durationDays` — a real streak, never
a placeholder), description, and a progress bar with a `tabular` percentage;
the whole card links to `/challenges/{slug}`. Below that, an "Upcoming
dietitian check-ins" card: an honest empty state, or real check-ins each with
title, a `tabular` scheduled time, and an external "Join session" link.

**Critical_UX_Constraints**: Every number on this screen is the customer's own
health-adjacent progress — the design must make it feel earned and specific,
and must never have a "filler" state that looks like data. The progress bar is
the emotional core of the page: gold fill on a neutral (`bg-surface-raised`)
track, never sage — sage is reserved for completion, not for the track itself.

---

## Brief 47 — `/team`

**Target_Route**: `/team` — the company's dietitians and chefs. Public,
server-rendered. Fully wired, restyle only.

**Data_Props_Required**: Two grouped sections ("Registered dietitians",
"Chefs"), each a grid of **TeamCard**s; a section header only renders when that
group has members, and a single honest empty state ("Team profiles are coming
soon.") covers the fully-empty case. Each card: an accent-tinted avatar circle
with initials (accent is real per-profile data — gold / sage / blue), name, a
conditional "RD" badge, title, an optional italic `signatureLine`, years of
experience, and a "View profile →" link. **Note**: only the link is
interactive — the card itself is deliberately not a link, so the sage accent
never lands on an interactive control.

**Critical_UX_Constraints**: This is a people page — the avatar treatment
carries it, and initials-in-a-circle needs to feel considered rather than like
a fallback. Keep the three accent variants visibly distinct but equally
weighted; none of them should read as "more senior".

---

## Brief 48 — `/team/[slug]`

**Target_Route**: `/team/[slug]` — a single dietitian or chef bio, with their
dishes. Public, server-rendered. Fully wired, restyle only.

**Data_Props_Required**: Avatar + initials in the profile's real accent colour,
a conditional RD badge, name, title, years of experience, an italic
`signatureLine`, the bio prose, a "Credentials" list (only when non-empty), a
"Specialises in" chip row from `lifestyles` (only when non-empty), and — only
when the profile actually owns dishes — a "Dishes from this kitchen" (chef) /
"Dishes signed off by this RD" (RD) mini-grid, each dish showing its image,
name, and a `tabular` "{calories} kcal · {price}" line.

**Critical_UX_Constraints**: The dish prices here are **real live catalog
money**, resolved server-side — treat them as real, not decorative. This is a
bio, so the prose deserves article-grade measure and line-height (see the
shared article shell above), not card-compressed text. Every section below the
header is conditional on real data; the layout must hold together for a profile
with no credentials, no lifestyles, and no dishes.

---

## Brief 49 — `/recipes`

**Target_Route**: `/recipes` — recipe directory with client-side filtering.
Server-renders the full grid for SEO, then filters in the browser. Fully wired,
restyle only.

**Data_Props_Required**: A filter bar with three pill groups (goal, diet, max
time) plus a free-text search box, then a result-count line, then either an
honest empty state ("No recipes match those filters.") or a grid of
**RecipeCard**s. Each card: image or an honest "Recipe" placeholder box, an
author-role badge, title, two-line-clamped summary, a `tabular` stats row
(time always; calories and protein only when actually present — both are real
nullable fields), and a "By {authorName}" byline.

**Critical_UX_Constraints**: Filtering is instant and client-side — the design
should feel immediate, with the active-filter state obvious at a glance and a
visible count so an over-filtered empty result reads as a filter outcome rather
than an error. Echo Brief 44's image-led card treatment; these two grids are
the batch's matched pair.

---

## Brief 50 — `/recipes/[slug]` — **the editorial anchor**

**Target_Route**: `/recipes/[slug]` — a single recipe article. Already the most
complete editorial template in the storefront; this brief formalises it as the
pattern the rest of the batch's long-form surfaces follow.

**Data_Props_Required**: Hero image (when present) → a pill row (author role,
goal label, diet) → `h1` title → summary dek → byline → a **three-column
`tabular` stat block** (Time always; Calories and Protein only when non-null)
→ an optional body paragraph → an "Ingredients" list → a numbered "Method"
sequence with gold step markers → a fixed disclaimer box linking to
`/legal/disclaimer` ("Recipes are general nutrition guidance, not medical
advice").

**Critical_UX_Constraints**: This is the article shell every other long-form
route in the batch inherits — get the measure, the heading scale, and the
vertical rhythm right here first. The numbered method steps are the most
functional part of the page (someone is cooking from them): high contrast,
generous line-height, unambiguous step markers. The stat block is the one place
`tabular` numerals do real work — align them. The disclaimer is required copy
and must not be visually buried, but must not compete with the method either.

---

## Brief 51 — `/qa`

**Target_Route**: `/qa` — community Q&A: public to read, session-gated to ask.
**Rebuilt in this batch's grounding pass** — it previously fabricated
successful submissions and shipped fake seed threads. Design for the honest
version only.

**Data_Props_Required**: A two-column layout — thread list left, ask-form right
(sticky on desktop). **Threads**: a real loading line, an honest empty state
("No questions yet — be the first to ask our dietitians."), or a list of
question cards, each with a sage category pill, an author name, the question
title and body, and then **one of two genuinely different states**: an answered
card (a gold-tinted panel headed "Answered by {RD name}" with the answer body)
or an unanswered one (a plain neutral "Awaiting a dietitian's response." line —
never labelled "verified", which is exactly the defect this batch fixed).
**Ask form**: when signed out, a prompt + inline `<PhoneAuth>`; when signed in,
a category select, a question field, a context textarea, a gold submit, a real
`role="alert"` error line on failure, and a sage confirmation **only** on
genuine success.

**Critical_UX_Constraints**: The answered-vs-unanswered distinction is the
integrity of this page — they must be unmistakably different, and the
"answered" treatment must never appear over an empty answer. The error state
must be prominent enough that a failed submission cannot be mistaken for a
successful one. Threads are real user prose of uneven length; design for that.

---

## Brief 52 — `/meal-guides/[dishSlug]`

**Target_Route**: `/meal-guides/[dishSlug]` — a per-dish storage, reheating and
sourcing guide. Reached from a dish's PDP/recommendation card, not from any
index — there is no `/meal-guides` directory route. Public, server-rendered.

**Data_Props_Required**: A back-link to `/dish/{slug}`, then two cards.
**ThermalInstructions**: a "Cold storage" / "Container safety" pair, then a
numbered three-step reheating sequence with gold step markers. **SourcingTransparency**:
a per-kitchen sourcing note list (real, keyed off the dish's kitchen), then an
allergen section rendering the dish's **real** `allergens` array — as neutral
bordered chips when allergens are present, and a sage chip only for the genuine
"None reported" case — followed by the shared cross-contamination note.

**Critical_UX_Constraints**: The allergen block is safety information and this
batch just fixed it rendering unstyled and mis-coloured. It must be immediately
legible, must never use the success colour to label a listed allergen, and must
not be visually subordinate to the sourcing prose above it. The reheating steps
are functional instructions read in a kitchen — same treatment discipline as
Brief 50's method steps.

---

## Generation log

All nine generated against project `9085082841997152511` ("Tanmatra
Storefront — Clinical Metabolic OS (Batches 3–5)") with design system
`assets/0b599b1692164d81b3389c7121485392` ("Tanmatra"), `GEMINI_3_1_PRO`,
`MOBILE`, one at a time via the same direct-MCP-over-HTTP curl technique
Batches 3–7's resolution sections document.

| Brief | Screen id | Title | Size | Banked at |
|---|---|---|---|---|
| 44 | `7ffef0edc0234eca9498dbf995801183` | Challenges Directory - /challenges | 780×3428 | `route-44-challenges/` |
| 45 | `b9e2e8d7d50f416a921bf55b56541aad` | 14-Day Fibre Reset Challenge | 780×4678 | `route-45-challenge-detail/` |
| 46 | `3f3f70065e1a4842af16fb9661cd7b7d` | Your Challenge Tracker | 780×2010 | `route-46-challenge-tracker/` |
| 47 | `4eb207f1ef824c06a30e6ebfbcf25796` | The People Behind Your Plate | 780×4792 | `route-47-team/` |
| 48 | `8a09a8bd9d7243f7b3dd6fad16d5ec7f` | Dietitian Bio - Ananya Nair | 780×6540 | `route-48-team-profile/` |
| 49 | `95a8eb0950784865b9b963d21ac099e8` | Recipe Directory | 780×3836 | `route-49-recipes/` |
| 50 | `e395ccd407424bc3b776815af7117af6` | Recipe Detail - Warm Turmeric Lentil Bowl | 780×4646 | `route-50-recipe-article/` |
| 51 | `82d32272cdee4f0aa9c9e6314a22627f` | Community Q&A Board - /qa | 780×3986 | `route-51-qa/` |
| 52 | `fc653ed50b1146c59d7bc0a32655d124` | Meal Storage & Reheating Guide | 780×2992 | `route-52-meal-guide/` |

QA pass over all nine banked files, focused on this batch's specific risks:
gold always paired with dark ink text (`text-ink`/`on-background`/
`on-primary-container`, never white) everywhere a button renders; the
allergen chips on brief 52 render neutral (`bg-neutral-light`), never sage —
confirming the fix from the grounding pass carried into the design; the
progress-bar track on brief 46 is neutral with a gold fill, sage reserved for
the "Day N/M" completion pill only; and brief 51's answered/unanswered
distinction is exactly as specified — "ANSWERED BY RD ..." only appears on
threads with a real answer, the unanswered thread gets a plain italic
"Awaiting a dietitian's response." with no gold, star, or "verified" language
anywhere near it.

**Two hallucinations for the wiring stage**, both invented global site chrome
that doesn't belong in page content:
- Brief 44 (`/challenges`) invented a fixed bottom mobile-nav bar (comment:
  "Bottom Navigation Bar (Shared Component)") with four fabricated links
  (Explore/Challenges/Health/Profile) that don't correspond to this app's real
  `BottomNav`. Exclude entirely; the real page ends after the challenge card
  stack.
- Brief 47 (`/team`) invented a full sticky top header — a "Tanmatra"
  wordmark, a hamburger button, a fabricated desktop nav row
  (Home/Team/Nutrition/Profile), and a profile-avatar circle — none of which
  exists in the real site chrome. Exclude entirely; the real page starts at
  the "THE TEAM" eyebrow section inside `<main>`.

No other file in this batch has any hallucinated chrome. The remaining seven
files' `<header>`/`<main>` tags are ordinary page-content sectioning (title
blocks, article headers) and wire in as-is, consistent with the precedent
Batch 5 established for legitimate per-section `<header>` usage.
