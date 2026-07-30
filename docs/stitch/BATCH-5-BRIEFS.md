# Batch 5 — Route Briefs 27–33 (transmittable payloads)

> Phase 2 payloads for the account-depth batch (G1), compiled against real code and
> `BATCH-5-GROUNDING.md` (read that first — it documents the two orphaned routes,
> the one fully-fake feature, and the two dead-end auth flows fixed before this
> batch was briefable). Unlike Batch 4, this batch is briefed against an
> **already shipped sibling surface within the same batch family**: Batch 2's
> `/account` hub (route-08) and its five sibling routes (health-information,
> wellness, preferences, orders, favorites) already established the account
> chrome these seven routes extend. None of that vocabulary is restated per
> brief below; it is binding on all seven.

Constant across all seven (do not restate per brief when transmitting):

```
"Brand_Vibe": "Premium Clinical Metabolic OS. Clean, appetizing, and empathetic. Not a clinical textbook. Focus on food imagery and restrain from large text blocks",
"Design_System": "Light-mode account chrome (NOT the dark checkout scope) — bg-bg/bg-surface neutrals, text-ink primary, text-ink-muted/text-ink-faint secondary. Squircle geometry (rounded-xl cards, rounded-2xl hero/summary cards, full pills for status/badges). Clinical Gold #D4AF37 is the ONLY interactive fill colour; ink on a gold fill is var(--gold-ink), never white. Sage (var(--sage-soft) bg / var(--sage-text) fg) is status/positive signal only — never a button fill. Destructive actions use var(--danger) as text/border, never a filled button. All money and counts render tabular-nums."
```

**Account vocabulary this batch must match** (confirmed against the shipped
`/account` hub and its five Batch-2 siblings, not invented):

- **No dark scope.** Every screen here is a normal light-mode page inside the
  existing storefront chrome (`Header`, `BottomNav`, `Footer` already render
  around it) — do not wrap these in `data-stitch="dark"` or invent a bespoke
  header. That treatment belongs to the checkout funnel (Batch 4) only.
- **AccountNav tab strip**: `components/account/AccountNav.tsx` — a horizontal-
  scroll row of plain-text tabs under a `border-b border-line` rule. The active
  tab gets `border-b-2 border-gold text-ink`; every other tab is
  `border-b-2 border-transparent text-ink-muted`. **All seven routes in this
  batch render it** (as of this batch's grounding fix, `symptoms` and `history`
  now do too) — treat it as fixed page chrome above the route's own content,
  not something to redesign per screen.
- **Card pattern**: `rounded-xl border border-line bg-surface p-4` for list
  rows and mid-weight cards; `rounded-2xl` + more padding (`p-6`) for a screen's
  one hero/summary card (wallet balance, referral code). Never a shadow-heavy
  or gradient card — flat surface + hairline border is the whole vocabulary.
- **Status pills** (`rounded-full px-2.5 py-0.5 text-xs font-medium`, four real
  variants, all already shipped on `SubscriptionCard`): active/positive =
  `bg-sage-soft text-sage-text`; neutral/paused = `border border-line
  text-ink-muted`; halted/error = `border border-[var(--danger)]
  text-[var(--danger)]`; cancelled/faint = `border border-line text-ink-faint`.
  Do not invent a fifth treatment or collapse these to one colour — they encode
  real, distinct server states.
- **Primary CTA**: `rounded-xl bg-gold px-5 py-3 text-sm font-semibold
  text-[var(--gold-ink)]` (never `text-white` — that fails contrast and is a
  recurring defect this batch is fixing everywhere it appears). Secondary
  actions are plain inline text links (`text-gold-text hover:underline`, or
  `text-ink-muted hover:underline` for a lower-emphasis action like "Set
  default"). Destructive actions (`Delete`, `Cancel`) are plain text in
  `text-[var(--danger)]`, never a filled red button.
- **Auth gate**: every route is session-gated. A 401 renders `needsAuth`: a
  one-line prompt + the inline `<PhoneAuth>` island, **never a redirect to a
  separate /login page**. This is now correct on all seven routes in this
  batch (it was already correct on five; `symptoms` and `history` were fixed
  to match as part of this batch).
- **Loading / empty / error are three distinct states**, never collapsed into
  one generic spinner or blank screen: a plain-text loading line, an honest
  empty-state sentence (sometimes with a link out — "Browse plans", "Browse
  Registered Dietitians"), and a `role="alert"` error line in
  `text-[var(--danger)]` that never blocks the rest of the page from
  rendering.
- Global UX constraints unchanged from prior batches: `max-w-screen-xl
  mx-auto` desktop container (these are narrower single-column/two-column
  surfaces, mobile-first); all numerals `tabular-nums`; progressive
  disclosure over dense paragraphs; real list keys throughout (`.id`-keyed,
  bar the one harmless literal-array key already fixed in `history`).

---

## Brief 27 — `/account/addresses`

**Target_Route**: `/account/addresses` — saved delivery address CRUD, the most
structurally complete route in the batch (fully wired, restyle only).

**Data_Props_Required**: `AccountNav` (active="addresses") + **AddressManager**
(client island): three top-level states — `needsAuth` (sign-in prompt +
`PhoneAuth`), loading, and the loaded view. Loaded view is **AddressList**
stacked above either **AddressForm** (when adding/editing) or an "Add an
address" gold button (when not). Each address row: label + a bordered type
pill (home/work/other) + a conditional sage "Default" pill, the joined address
lines, the phone number (`tabular`), and a three-action row (`Edit` gold-text,
`Set default` ink-muted — hidden when already default, `Delete` danger-text) —
the row being mutated shows all three actions at reduced opacity, never a
spinner overlay. **AddressForm**: a 2-col row (Label text input + Type select),
full-width Line 1, full-width Line 2 (optional, labelled as such), a 2-col row
(City + PIN code, PIN gets `aria-invalid` styling on a malformed value), Phone,
then Save/Cancel. A location-picker overlay (**LocationPickerFlow**, an
existing separate component — do not redesign, just leave a clear insertion
point) can precede the form when adding a new address from scratch.

**Critical_UX_Constraints**: The Default pill is server truth (the single-
default invariant is enforced server-side) — never let the form imply the
customer can have two defaults. PIN/phone validation is client-side UX only
(a format guard), never presented as address-serviceability confirmation —
serviceability itself is a server 422 the form must be able to surface via its
existing error line. Keep the row-action row terse (three plain text actions,
no icon-only buttons) to match the rest of the account hub's list rows.

---

## Brief 28 — `/account/subscriptions`

**Target_Route**: `/account/subscriptions` — plan lifecycle management, the
richest route in the batch: real pause/resume/cancel/reactivate, a full
change-plan + Razorpay reauthorisation flow, and a per-subscription delivery
schedule. Also the route where this batch removed a fully fake feature
(`HybridWorkToggle`) — the address line shown per card is now the plain real
value, not an interactive control.

**Data_Props_Required**: `AccountNav` (active="subscriptions") + **Subscription
Manager**: `needsAuth` / loading / empty (with a "Browse plans" link) states,
a conditional sage credit-balance pill above the list ("N meal credit(s) —
skipped deliveries come back as credits", only when balance > 0), then a
stacked list of **SubscriptionCard**s. Each card: cadence + meals/delivery
header, one of the four real status pills (active/paused/halted/cancelled —
see the shared vocabulary above, these are not decorative), price/delivery-
window line (`tabular`), a next-delivery-or-paused-date line, the plain
address line (label-free — just the joined address string, no "change" affordance),
a conditional sage pending-plan-change banner (with a "Complete authorisation"
inline link only when reauth is actually required), an action row driven
entirely by the card's own status (2 of: Pause/Resume/Cancel/Reactivate
billing — cancel renders in danger-text, the rest in gold-text), a "Change
plan" toggle, and a "Deliveries" toggle. Expanding **Change plan** reveals
either the reauth step (a one-line explanation of the price increase + a gold
"Authorise new amount" button — this is a real Razorpay modal handoff, not a
form) or the edit form (Cadence select, a Meals-per-delivery number input OR,
for a day-plan subscription, a plain note that meals come from the per-day
schedule instead, a live tabular price preview computed the same way the
server bills, and a "Confirm change" button disabled when nothing changed).
Expanding **Deliveries** reveals a conditional "UPI Autopay active" sage note,
up to 4 upcoming/skipped delivery rows (date + optional window, a skipped row
shown struck-through, each with a Skip/Restore text action), and a footnote
about the 24h skip-credit cutoff.

**Critical_UX_Constraints**: The four status pills must read as genuinely
distinct at a glance — this is the card a customer scans fastest across
multiple plans. The Change-plan and Deliveries sections are inline expansions
(accordion-style, not a modal or a route change) — both already ship that way
and a customer may have both open on different cards simultaneously. Never
show a "Change delivery location" control of any kind on this card — that
capability does not exist server-side (this batch removed a fake one); the
address is display-only here.

---

## Brief 29 — `/account/symptoms`

**Target_Route**: `/account/symptoms` — physiological symptom logging feeding
real clinical data to registered dietitians. **This route gained AccountNav in
this batch's grounding pass** — it was previously an orphan with no way back
into the account hub; design it as a full hub member, tab strip included.

**Data_Props_Required**: `AccountNav` (active="symptoms") + **SymptomTracker
View**: a `needsAuth` gate (sign-in prompt + `PhoneAuth`) at the top level —
signing in is required to log OR view history, there is no partial/anonymous
state. Once authenticated: a two-column layout (form left, history right on
desktop; stacked on mobile). **Form**: a Symptom Classification select (4
real options — Post-Meal Bloating & Gas / Afternoon Lethargy / Optimal
Sustained Energy / Early Hunger), a Reaction Severity slider (1–5, live
numeric readout), an optional "Related Dish or Meal" text input explicitly
labelled optional, a Clinical Annotations textarea, and a gold "Record
Symptom Log →" submit button (disabled while busy, label swaps to "Recording
Telemetry…"). A conditional confirmation/error banner appears above the form
on submit. **History** (right column): a loading line, an honest empty state
("No physiological symptom observations recorded..."), or a stacked list of
entries — each a sage-soft symptom-type pill, the log date, a severity line
("Severity: N / 5"), and **only when a related dish was actually provided** a
"• Correlated with: <slug>" fragment (omit the whole fragment — not a blank
value — when the field is empty), and an optional italic quoted note.

**Critical_UX_Constraints**: This is clinical-sensitivity data — the form
copy already frames it as feeding dietitian prescriptions, so the layout
should read as a genuine intake tool, not a casual feedback widget. The
optional related-dish field must visually read as optional (placeholder text,
no red asterisk) — nothing on this screen should imply a value is required
when the server itself treats it as optional. Never fabricate a "Correlated
with" line when no dish was given; the honest state is simply omitting that
fragment, already reflected in the real component.

---

## Brief 30 — `/account/appointments`

**Target_Route**: `/account/appointments` — the customer's RD consultation
schedule, fully wired, restyle only.

**Data_Props_Required**: `AccountNav` (active="appointments") +
**AppointmentsList**: `needsAuth` / loading / empty (with a "Browse
Registered Dietitians" link to `/rd`) states, then a stacked list of
appointment rows. Each row: the appointment kind (humanized, e.g. "video
consult"), a status pill (sage-soft/sage-text, real server status string —
not a fixed enum of icons), a time range line ("Thu, 6 Aug, 4:00 PM — 4:30
PM"), a footer line pairing the dietitian's name (humanized from their slug)
against the price — rendered as **"Free Intro"** when `pricePaise === 0` (a
real server value, not a placeholder) or the formatted rupee amount
otherwise.

**Critical_UX_Constraints**: The "Free Intro" branch is real data, not a
loading/error fallback — style it as a legitimate, slightly celebratory
state (e.g. a sage or gold accent on that specific line), not identical
styling to a missing price. Keep the row compact — this list can run long
for an active customer with a recurring RD relationship.

---

## Brief 31 — `/account/billing`

**Target_Route**: `/account/billing` — read-only wallet + credit-ledger
statement, fully wired, restyle only. Explicitly NOT order receipts (those
live at `/account/orders`) and NOT recurring plan billing (`/account/subscriptions`)
— the page's own footer says so and the design must not blur that boundary.

**Data_Props_Required**: `AccountNav` (active="billing") + **BillingPanel**:
`needsAuth` / loading states, then one hero card ("Wallet balance" label,
a large tabular gold-text amount, a line explaining it applies automatically
at checkout with a link to `/vouchers` to redeem a code) above a "Credit
activity" section — an honest empty state ("No credit activity yet") or a
stacked list of ledger rows, each a label (`creditLabel(entry)`, real
server-described reason) + date on the left, a signed tabular amount on the
right (`+₹X` in sage-text for a credit, `−₹X` in ink-muted for a debit — not
danger-red; a debit here is normal usage, not an error). A closing footnote
line points to `/account/orders` and `/account/subscriptions` for receipts
and plan billing respectively.

**Critical_UX_Constraints**: This screen has exactly zero mutating actions —
no buttons beyond the two inline text links (Vouchers, Orders/Subscriptions).
Do not add a "Top up" or "Redeem" button here; that flow lives on
`/vouchers`, referenced not duplicated. The wallet-balance figure is the
single largest number on the page — everything else is a supporting ledger.

---

## Brief 32 — `/account/loyalty`

**Target_Route**: `/account/loyalty` — referral code + per-plan loyalty
progress, fully wired, restyle only.

**Data_Props_Required**: `AccountNav` (active="loyalty") + **LoyaltyHub**:
one shared `needsAuth`/loading gate for both panels below it (a single
sign-in prompt, never two). **ReferralPanel**: a "Give ₹X, get ₹Y" headline +
one explanatory line, a large tracking-wide code display next to a gold
"Copy"/"Copied" button, a bordered "Got a friend's code?" redeem mini-form
(input + "Apply" ghost button, disabled until non-empty), a conditional sage
confirmation line on successful redemption, and — only when the customer has
actual referrals — a "Friends you've referred" list (join date left, either
a sage "You earned ₹X" or a faint "Pending first order" right). **LoyaltyProgressPanel**
(renders nothing at all when the customer has no active subscriptions — a
real conditional, not a loading state): a "Plan rewards" label above a
stacked list, one card per subscription — cadence/meals header, a tabular
"N delivered" line, an "N more for a free delivery (₹price)" line where the
price is literally that plan's own per-delivery price (never a second
invented figure), and a premium-bonus line that's either "One-time loyalty
bonus earned" (sage, past tense) or "N more for a one-time loyalty bonus"
(neutral, forward-looking).

**Critical_UX_Constraints**: ReferralPanel is the dominant element on this
screen — LoyaltyProgressPanel is real but secondary and may be entirely
absent for a customer with no active plan, so the layout must hold together
with just the referral panel present. The redeem-code input uppercases
visually but must not block lowercase entry (the real form does this via
CSS, not input filtering). Never show a numeric reward figure that isn't
traceable to a real field already on screen or in the API response.

---

## Brief 33 — `/account/history`

**Target_Route**: `/account/history` — macro intake vs. clinical target
dashboard. **This route gained AccountNav in this batch's grounding pass**
(previously an orphan, same fix as Brief 29) — design it as a full hub
member. Also the route with this batch's most severe pre-existing defect
(fabricated clinical targets), now fixed at the data layer — the design must
support the honest version, not the old one.

**Data_Props_Required**: `AccountNav` (active="history") + **MealHistory
Dashboard**: a `needsAuth` gate (sign-in prompt + `PhoneAuth`) at the top
level, then a loading line, then the loaded view: a 3-across metric-tile grid
(Calorie Adherence / Protein Volume / Prebiotic Fiber), each tile showing a
label, the accumulated total across recent logs (large, tabular), and a
target line reading **"Target: {value}/day"** in gold-text sourced directly
from the server's real per-customer target — the server always returns a
fully-populated targets object (defaulting new customers to a standard 2000
kcal / 80g protein / 28g fiber profile), so every customer sees a real number
here, never a client-invented one. Below the tiles: a "Recent Verified Meal
Intake Logs" card — an honest empty state ("No automated delivery order
syncs or manual entries recorded in the last 30 days") or a stacked list of
log rows, each pairing a meal label + "Logged for: <date>" on the left against
three tabular figures (kcal / protein / fiber) on the right.

**Critical_UX_Constraints**: The three metric tiles are the headline of this
screen — give them real visual weight (large numerals, generous tile
padding), since they're the answer to "am I on track." Do not add a fourth
tile for `waterTargetMl` — it's in the API response but genuinely never
surfaced anywhere in the product; inventing a tile for it here would be new
scope, not a restyle. Keep the per-log list visually secondary to the tiles —
it's supporting detail, not the headline metric.

---

## Generation log

All seven generated against project `9085082841997152511` ("Tanmatra
Storefront — Clinical Metabolic OS (Batches 3–5)") with design system
`assets/0b599b1692164d81b3389c7121485392` ("Tanmatra"), `GEMINI_3_1_PRO`,
`MOBILE`, one at a time via the same direct-MCP-over-HTTP curl technique
Batch 3's resolution section documents (the harness's own `MCP_TOOL_TIMEOUT`
stays capped at 60s in this environment; generation itself runs well past
that, so the in-harness `mcp__stitch__generate_screen_from_text` tool is
unusable for this step — cheap calls like `get_project` still go through it
fine).

| Brief | Screen id | Title | Size | Banked at |
|---|---|---|---|---|
| 27 | `8a3f223ed325427eadb665d89aa09547` | Addresses Management - Account Hub | 780×1768 | `route-27-account-addresses/` |
| 28 | `13a07fcb2bf548009f39f3adafba557b` | Subscription Management - Account Hub | 780×1768 | `route-28-account-subscriptions/` |
| 29 | `a4b16c3b3466443fb462ca44e339f185` | Symptom Logging - Account Hub | 780×2492 | `route-29-account-symptoms/` |
| 30 | `c7e6da18b5bb472392db854d1652867a` | Dietitian Appointments - Account Hub | 780×1768 | `route-30-account-appointments/` |
| 31 | `3e4734c43c724e75bd9bc76810bf85d8` | Billing & Wallet - Account Hub | 780×1772 | `route-31-account-billing/` |
| 32 | `f9fb358fab6045639b0442a581233eaf` | Rewards & Referrals - Account Hub | 780×1768 | `route-32-account-loyalty/` |
| 33 | `e2c793168c77487da49d7c70eb579096` | Clinical History - Account Hub | 780×2712 | `route-33-account-history/` |

QA pass over all seven banked files: gold defined once per file, no
white-ink-on-gold, no danger-filled buttons, all four subscription-status
pill treatments present and distinct where called for. **Two nits for the
wiring stage**, both the same hallucination: briefs 27 (`/account/addresses`)
and 32 (`/account/loyalty`) each invented their own page-level branded header
row (an account-circle icon, a "Tanmatra"/"Account Hub" title, a settings
icon) above the real tab strip — that row duplicates the site's actual global
header and does not get wired in; only each file's tab strip + content below
it is real page content. The other five files have no such row. Brief 30's
per-card `<header>`/`<footer>` tags are legitimate article sectioning inside
each appointment card, not page chrome — those wire in as-is.
