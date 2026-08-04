# Batch 6 — Route Briefs 34–39 (transmittable payloads)

> Phase 2 payloads for the corporate/group-commerce batch (G2), compiled
> against real code and `BATCH-6-GROUNDING.md` (read that first — it documents
> the dead group-order add-flow and the error-path conflation fixed before
> this batch was briefable, plus two known limitations left deliberately
> unfixed as product decisions). Ordered as the real user journey: a company
> lead comes in, someone accepts an invite, lands in the shared workspace, an
> admin runs the lunch planner, members RSVP to a scheduled lunch, and —
> a parallel, ungated path — anyone shares a group-order code.
>
> Unlike Batch 5, these six routes do **not** share one fixed chrome
> component (there is no `AccountNav`-equivalent — each is a standalone
> app-shell page). What they share instead is a narrower vocabulary: flat
> card surfaces, the same money formatting (`formatPaise`, whole-rupee,
> `tabular`), the same client-derived admin/host gate pattern, and the same
> three-state (loading/empty/error) discipline Batch 5 established. `/corporate`
> is the one route in this batch that **does** inherit Batch 3's landing kit —
> it is a public marketing/lead-capture page, not an app-shell surface, and
> already reuses `ProofStrip` + `StickyCtaBar` today.

Constant across all six (do not restate per brief when transmitting):

```
"Brand_Vibe": "Premium Clinical Metabolic OS. Clean, appetizing, and empathetic. Not a clinical textbook. Focus on food imagery and restrain from large text blocks",
"Design_System": "Light-mode app-shell (NOT the dark checkout scope, NOT the marketing-lander scope except where noted for /corporate) — bg-bg/bg-surface neutrals, text-ink primary, text-ink-muted/text-ink-faint secondary. Squircle geometry (rounded-xl cards, rounded-2xl hero/summary cards, full pills for status/badges). Clinical Gold #D4AF37 is the ONLY interactive fill colour; ink on a gold fill is var(--gold-ink), never white. Sage (var(--sage-soft) bg / var(--sage-text) fg) is status/positive signal only — never a button fill. Destructive actions use var(--danger) as text/border, never a filled button. All money and counts render tabular-nums, always whole rupees (formatPaise never shows paise decimals)."
```

**Batch 6 vocabulary this must match** (confirmed against the shipped
components, not invented):

- **No dark scope, no AccountNav.** These are standalone pages inside the
  existing storefront chrome (`Header`, `BottomNav`, `Footer`) — five of six
  are `noindex` app-shell surfaces reached by direct link/invite/QR, not by
  primary nav. Do not invent a tab strip or a bespoke header for them.
- **Card pattern**: identical to Batch 5 — `rounded-xl border border-line
  bg-surface p-4` for list rows and mid-weight cards, `rounded-2xl` + `p-6`
  for a screen's one hero/summary card. Flat surface + hairline border only,
  never a shadow-heavy or gradient card.
- **Status pills** (`rounded-full px-2.5 py-0.5 text-xs font-medium`): reuse
  Batch 5's four-variant vocabulary where the semantics match — sage-soft/
  sage-text for open/active/positive, bordered ink-muted for neutral/closed,
  bordered danger for a genuine error/blocked state. Group/office-order
  `status` strings are real server enums (`open`/`closed` etc.) — render the
  actual string, don't invent icon-only badges.
- **Primary CTA**: `rounded-xl bg-gold px-5 py-3 text-sm font-semibold
  text-[var(--gold-ink)]` (never `text-white`). Secondary actions are plain
  inline text links (`text-gold-text hover:underline`). Destructive/removal
  actions (`Remove`, `Delete`) are plain text in `text-[var(--danger)]`,
  never a filled button.
- **Client-derived role/host gates, not separate tokens.** Three routes gate
  a control on "is this person special" purely from data already on the
  fetched record — `membership?.role === "admin"` (workspace, planner,
  office-lunch's Close-picks) or `group.hostUserId === userId` (group order's
  Close & checkout). Design these as ordinary conditional UI (a button that's
  present or absent), not as a separately-badged "admin mode" — there is no
  visual "you are an admin" chrome anywhere in the real components today.
- **Auth gate where sessions are required** (`corporate/[slug]`,
  `lunch-planner`, `office-lunch/[id]`): 401 renders `needsAuth` — a one-line
  prompt + the inline `<PhoneAuth>` island, never a redirect. `/corporate`
  needs no auth at all (public lead form). `/corporate/invite/[token]` is
  public to *view*, auth-gated only on the Accept action (401 redirects to
  `/login?next=...` — this is the one legitimate redirect in the whole batch,
  because accepting an invite is inherently a "come back after signing in"
  action, not a page-load gate). `/group/[code]` is public to view; only
  the host-only Close action is gated by identity, not a hard auth wall.
- **Loading / empty / error stay distinct**, per Batch 5's precedent — a
  plain-text loading line, an honest empty-state sentence, and (new in this
  batch, see Brief 39) a genuinely separate "couldn't load, try again" error
  state that must never read identically to "this doesn't exist."
- Global UX constraints unchanged: `max-w-screen-xl mx-auto` desktop
  container, narrower single/two-column surfaces (these are mostly
  `max-w-md`/`max-w-lg`/`max-w-xl` today — mobile-first, low information
  density per screen), all numerals `tabular-nums`, real list keys throughout.

---

## Brief 34 — `/corporate`

**Target_Route**: `/corporate` — public B2B lead-capture landing, the funnel
entry point. Already partially wired into Batch 3's landing kit; restyle to
finish that integration, not replace it.

**Data_Props_Required**: A short hero (H1 "Meal programs for teams" +
subhead), an inline text link out to `/corporate-wellness` ("See the full
corporate-wellness pitch — subsidy calculator & FAQ →") for the deeper pitch,
Batch 3's **ProofStrip** (four credential tiles: seat-count range, price-per-
meal, certification badge, delivery-time badge — real content already
authored, do not invent new tiles), then **CorporateLeadForm**: a Kind
selector (corporate/gym/fitness-club — hidden entirely when the page locks a
single kind, which `/corporate` itself does not), Name / Work email / Company
/ Team-size-band (4 real bands: 1-20, 21-100, 101-500, 500+) / Park-or-sector
/ Phone (optional) / "Anything we should know?" textarea (optional), a gold
submit button whose label swaps to "Sending…" while busy, an inline
`role="alert"` error line, and — on success — a full replacement success
card (checkmark badge, confirmation copy, echoes the submitted email) rather
than a toast. Below the form: a "Run a gym or club?" secondary section
listing partner-program links. Batch 3's **StickyCtaBar** pins a single gold
CTA ("Request Pilot") above the mobile nav, scrolling to the form.

**Critical_UX_Constraints**: This is the one route in this batch that *is* a
marketing lander — it's fine (expected) for it to feel more designed/visual
than the five app-shell routes that follow. But the form itself must stay a
single flat card, not a multi-step wizard — the component is deliberately
not a wizard today. Never fabricate pricing beyond the four real ProofStrip
figures already authored in `content/landing/corporate.ts`. The success state
fully replaces the form (not an overlay) and must still echo the real
submitted email, not generic "thanks" copy.

---

## Brief 35 — `/corporate/invite/[token]`

**Target_Route**: `/corporate/invite/[token]` — a shared invite link's landing
page, `noindex`. Public to view, auth-gated only on accept.

**Data_Props_Required**: **CompanyInvite**: a loading line ("Fetching your
invitation…"), an honest unavailable state ("Invite unavailable" card + a
back-link to `/corporate`) for any fetch failure, or — once loaded — the
company name as the headline, a role sentence ("You've been invited as a(n)
`{role}`" — role is a real server string, e.g. "admin" or "member", not a
fixed pair of options), an "invitation for `{email}`" detail card, and a gold
Accept button. On accept: success routes away entirely (to the new
`corporate/[slug]` workspace or `/account` — this screen doesn't render a
post-accept state, it navigates); a 403 (signed-in email doesn't match the
invited email) shows an inline message on this same screen rather than
navigating; an unauthenticated accept attempt redirects to `/login?next=...`
(the one legitimate redirect in this batch — flag it as intentional, not an
auth-gate violation).

**Critical_UX_Constraints**: Single centered card, `max-w-md`, low-key —
this is often someone's first touch with the product from a Slack/WhatsApp
link, so it should read as trustworthy and specific (real company name, real
role, real email) rather than generic. The role sentence must render whatever
string the server actually sends, not a hardcoded "member"/"admin" toggle —
there is no fixed enum the UI should assume.

---

## Brief 36 — `/corporate/[slug]`

**Target_Route**: `/corporate/[slug]` — the member workspace, `noindex`,
session-gated. The hub every accepted invite lands in.

**Data_Props_Required**: `needsAuth` gate (sign-in prompt + `PhoneAuth`) at
the top level, a loading state, an honest "workspace isn't available to you"
state for anything else gone wrong, then the loaded view: a company header
card (name + `formatPaise(perEmployeeMonthlyBudgetPaise)` shown as
"…/person/month" — a **monthly** figure, do not relabel it as per-meal), a
conditional "Open the lunch planner →" link (present only when the viewer's
own membership role is admin — an ordinary conditional link, not a separately
badged control), an office-lunches list (empty state, or rows each showing a
status pill — "Picks open" in sage when the window is live, a muted status
otherwise), and a team roster rendered as a simple wrapped row of member
email chips (each admin's chip suffixed "· admin"; no separate visual
treatment is needed for invited-vs-active members today — that's real data
on the wire but not yet surfaced by the component, so don't invent a status
dot for it unless explicitly asked to extend scope).

**Critical_UX_Constraints**: This is a low-frequency-visit utility page for
most members (they mostly land here once, from an invite, then use the
planner or office-lunch links) — keep it scannable, not dense. The monthly
budget figure must never be visually conflated with the office-lunch per-
meal budget shown on Brief 38 — they are genuinely different numbers on
different cadences in the real system today (see grounding doc), so if both
ever appear near each other, label them unambiguously.

---

## Brief 37 — `/corporate/[slug]/lunch-planner`

**Target_Route**: `/corporate/[slug]/lunch-planner` — admin-only weekly
lunch-plan builder, `noindex`, session- and role-gated (client-side role
check reinforced by real server 403s, not a separate admin token).

**Data_Props_Required**: `needsAuth` → loading → a "planner is available to
company admins only" forbidden state (distinct copy from the generic
"workspace isn't available" state — a non-admin who somehow reaches this URL
should understand *why*, not think the link is broken) → a "workspace isn't
available" state for a genuinely bad slug → the loaded two-section view.
**Section 1 (diet profile form)**: headcount input, five diet-count steppers
(veg/vegan/gluten-free/jain/halal) with a derived, non-editable "Non-
vegetarian" readout computed as headcount minus veg count, a fixed 10-option
allergen toggle-chip grid, a cuisine-preference chip input, calorie
floor/ceiling numeric inputs, a notes textarea (1000-char cap), a Save
button, and a "Saved" confirmation line. **Section 2 (plan preview)**: an
empty dashed-border state ("No plan yet — generate one from the saved
profile") before a plan exists; once generated, a provenance pill
("AI-generated" gold-tinted vs. "Rule-based" sage-soft — real, distinct
provenance, not decorative), an optional "Scheduled" sage pill, the week-of
label, an optional plan summary line, a per-day list (each day: its picks by
name with an optional one-line "why", and any warnings rendered as danger-
toned bullet lines — never suppressed or merged into the picks), then either
a "Scheduled — N office lunches created" confirmation or a gold "Schedule
this week" button with a footnote naming the schedule time and per-person
budget.

**Critical_UX_Constraints**: The per-person budget named in the schedule
footnote is a fixed constant today (₹400), not derived from the company's
monthly budget shown on Brief 36 — do not design a control here that implies
it's editable or synced; it isn't, in the real component, right now (see
grounding doc's "known limitations"). Warnings on a given day (allergen
conflicts, budget overruns, etc.) are safety-relevant — they must never be
visually de-emphasized below the picks they apply to. This is a two-step,
save-then-generate-then-schedule flow — design it as a clear top-to-bottom
sequence, not parallel panels competing for attention.

---

## Brief 38 — `/office-lunch/[id]`

**Target_Route**: `/office-lunch/[id]` — a single scheduled team lunch,
`noindex`, session-gated. Where members RSVP within a per-order budget and an
admin can close the picking window.

**Data_Props_Required**: `needsAuth` → loading → an honest "not available to
you" state, then the loaded view: a status pill + title, the scheduled
time/address line, a **per-order** budget line
(`formatPaise(perEmployeeBudgetPaise)`/person — this is a real, order-
specific figure set at schedule time, distinct from the planner's flat
constant that created it). **Pick section**: when the window is open, embeds
**OfficePicker** — a per-dish row list (name + `formatPaise(price)` +
a 0–10 quantity stepper), a running total row shown as
`{formatPaise(total)} / {formatPaise(budget)}`, danger-toned only when over
budget, and a Save button labelled "Lock my pick" (first time) or "Update my
pick" (editing an existing pick), disabled while busy/over-budget/empty. When
the window is closed, a plain "The pick window has closed" line replaces the
picker entirely — no disabled/greyed-out picker. **Team picks section**: a
"Team picks (N)" heading, an aggregated total, and a list of each participant's
pick with their own subtotal. Admin-only "Close picks" button, present only
while the window is still open.

**Critical_UX_Constraints**: The over-budget state on `OfficePicker` must be
unmistakable (danger-toned total, disabled Save) but not alarming — going
over is a normal thing to correct mid-pick, not an error state. The dish list
shown here is a plain global subset today, not a company-curated menu (see
grounding doc) — do not design copy implying "your company's usual picks" or
similar company-specific framing that the data doesn't back. Team picks stay
visible (read-only) even after the window closes — closing stops new/changed
picks, it doesn't hide what was already chosen.

---

## Brief 39 — `/group/[code]`

**Target_Route**: `/group/[code]` — a shared group order, `noindex`, public
to view. Anyone with the code can add their own items; only the host closes
and pays for everyone. **This route's own participant add-flow was dead code
before this batch's grounding fix** — the "Add your items" CTA now actually
works; design for the flow as fixed, not as it previously (silently) failed.

**Data_Props_Required**: a loading line, then one of three genuinely distinct
states — **missing** ("Group `{code}` was not found — it may have been
closed or the code is incorrect"), **error** (new in this batch: "Couldn't
load this group order" + a "Try again" action — must read as a transient
technical failure, visually and copy-wise distinct from "missing," never the
same sentence), or **ready**: a code/status header card (large tracking-wide
code, an open/sage vs. closed/muted status pill), a "Hosted by `{name}` · N
participant(s)" line, a share-instructions line naming the code, an item list
(empty state: "No items yet. Share the code with friends to get started." —
or rows each showing item name + "Added by `{name}` · Qty N" + the line total,
with a Remove text action visible only to the host or whoever added that
specific line, and only while the order is still open), a subtotal row, and
a footer that is exactly one of: "This group order is closed." (closed), a
gold "Close & checkout" button + a one-line "only you (the host) can close
this order" note (host, open), or a gold "Add your items" link out to
`/menu?group={code}` (non-host, open).

**Critical_UX_Constraints**: The three top-level states (missing/error/ready)
must be visually distinguishable at a glance, not just by copy — this is the
exact bug this batch fixed (a transient failure previously looked identical
to a bad code). The Remove action's visibility rule (host, or whoever added
that line) is real per-line logic, not a blanket "host can remove everything
except-nothing" — a non-host participant can remove their own additions but
not anyone else's. Never show a price/total for an unauthenticated viewer
that implies they're paying — the copy is explicit that only the host pays,
and the design should reinforce that, not undercut it with checkout-style
visual weight on individual line prices.

---

## Generation log

All six generated against project `9085082841997152511` ("Tanmatra
Storefront — Clinical Metabolic OS (Batches 3–5)") with design system
`assets/0b599b1692164d81b3389c7121485392` ("Tanmatra"), `GEMINI_3_1_PRO`,
`MOBILE`, one at a time via the same direct-MCP-over-HTTP curl technique
Batches 3–5's resolution sections document.

| Brief | Screen id | Title | Size | Banked at |
|---|---|---|---|---|
| 34 | `9f213e78832c45049ff86aa33aa52c5a` | Corporate Wellness - Tanmatra | 780×3202 | `route-34-corporate/` |
| 35 | `7c9bc30085b44081b03913a87ebba7f3` | Corporate Invite - Acme Robotics | 780×1768 | `route-35-corporate-invite/` |
| 36 | `646af5a85a16433b810de3cf39e41822` | Corporate Workspace - Acme Robotics | 780×1768 | `route-36-corporate-workspace/` |
| 37 | `bc90a9f46a53449f90f3a46c7937db8b` | Corporate Lunch Planner Admin | 780×2782 | `route-37-lunch-planner/` |
| 38 | `36c05f2a2e1141109788b004e950ab81` | Team Lunch RSVP & Admin | 780×2800 | `route-38-office-lunch/` |
| 39 | `158072894a1c4deba5e1ae59eb57ca03` | Group Order - Participant View | 780×1768 | `route-39-group-order/` |

QA pass over all six banked files: gold defined once per file (`primary-container`
+ `on-primary-container`, never the plain `primary`/`on-primary` pair which
would put white text on a muted gold), no white-ink-on-gold anywhere real
buttons render, no filled danger/sage buttons, all four money/status
treatments render as plain-text or soft-tint per the shared vocabulary.
Brief 34's extra height (3202px vs. the other single-section screens) is
just generous mobile section padding across hero/proof-strip/form/links —
confirmed by heading count (exactly the 3 expected: H1 hero, "Get a
proposal", "Run a gym or club?"), not extra invented sections.

**One hallucination for the wiring stage**: brief 37
(`/corporate/[slug]/lunch-planner`) invented an entire desktop left sidebar
shell — a fixed `w-64` panel with a fabricated "Metabolic Workspace" brand
title, a fake admin-user profile card ("Clinical Admin" / "Metabolic Corp" /
"Admin Access" + a stock portrait image), and a 4-item nav to pages that
don't exist in the real product ("Dashboard", "Lunch Planner", "Team
Insights", "Settings"). None of that wires in — the real page has no
sidebar (same `Header`/`BottomNav`/`Footer` chrome as every other route in
the storefront). Only the `<main class="lg:ml-64 …">` content — Section 1
(team diet profile) and Section 2 (plan preview) — is real page content;
ignore the `lg:ml-64` offset too, since there's no sidebar to offset for.
Brief 38's `<header>` wrapping the top status/title/time block is legitimate
page-section content (matches Batch 5's brief-30 precedent for per-section
`<header>` tags), not site chrome — it wires in as-is. No other file in this
batch has any hallucinated chrome.
