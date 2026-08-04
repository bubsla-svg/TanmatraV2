# Batch 4 — Route Briefs 21–26 (transmittable payloads)

> Phase 2 payloads for the post-purchase & onboarding batch (G5), compiled against
> real code and `BATCH-4-GROUNDING.md` (the contracts each one encodes — read that
> first, it documents what was broken and what got fixed before this batch was
> briefable at all). Unlike Batch 3, this batch is briefed against an **already
> shipped** sibling surface: `/checkout` (Batch 1, route-04) defines the dark scope,
> `StepDots`, glass sticky footer, and money-CTA discipline this whole funnel uses.
> These six routes are what a customer sees immediately before or after that screen
> — briefing them in isolation would produce a funnel that visually resets itself
> at every step. None of that vocabulary is restated per brief below; it is binding
> on all six.

Constant across all six (do not restate per brief when transmitting):

```
"Brand_Vibe": "Premium Clinical Metabolic OS. Clean, appetizing, and empathetic. Not a clinical textbook. Focus on food imagery and restrain from large text blocks",
"Design_System": "Strict iOS-Grade Mobile-First. Dark mode (bg-neutral-950). Squircle geometry (rounded-3xl outer, rounded-2xl inner, full for pills). Kinetic haptic scale-98 on active states. Zero flat borders (border-white/[0.06] + backdrop-blur-md). Clinical Gold #D4AF37 is the ONLY interactive colour; ink on gold is #111318, never white. Royal Indigo #3E4C8A is structural signal only and never appears on a button. Dark greys neutral-950/900, off-white #F5F5F4 ink, #A3A3A3 secondary."
```

**Checkout vocabulary this batch must match** (all confirmed against the shipped
`/checkout` code, not invented):

- **Dark scope**: every screen root is `<div data-stitch="dark" className="min-h-screen bg-[var(--bg)] text-ink">`. Stitch should assume this wrapper exists and return page content only.
- **StepDots**: `components/checkout/StepDots.tsx` — a fixed-height row of dots, the current step at `size-2.5 bg-gold` with a soft gold glow, completed steps `size-1.5 bg-gold`, pending steps `size-1.5 bg-[var(--line-strong)]`. Any multi-step flow in this batch (`/quick-setup`) reuses this exact component — do not invent a progress bar or a numbered pill row instead.
- **Glass sticky footer**: `fixed inset-x-0 bottom-16 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:bottom-0` — `bottom-16` clears the mobile bottom-nav, `md:bottom-0` because desktop has none. The primary conversion action on a screen with real page-scroll content lives here, not inline at the bottom of the content column.
- **Money-CTA discipline**: exactly ONE button per screen may carry an amount, and only at the actual commitment moment — checkout's own `Pay ₹XXX with UPI` is the model. Every other button on every other screen is a plain verb (`Continue`, `Add to cart`, `Sign in`, `Track live`, `Retry`) with no amount printed on it, even when the surface is money-adjacent. A trial-start button ("Start the taste test · ₹399") is the one other legitimate exception in this batch — it IS the commitment moment for that screen — but a customisation "Add to cart" or a wizard's "Continue" must never show a price.
- Global UX constraints unchanged from Batch 3: global chrome owns header / bottom-nav / footer; `max-w-screen-xl mx-auto` on desktop (these are narrower `max-w-md`/`max-w-xl` mobile-first surfaces, so this rarely binds); any bottom-fixed element gets `pb-safe`; all numerals `tabular-nums`; progressive disclosure, never a paragraph where a tile will do.

---

## Brief 21 — `/order/confirmed/[orderId]`

**Target_Route**: `/order/confirmed/[orderId]` — the post-payment confirmation
screen, the tail of the checkout funnel and every customer's first touchpoint
after paying.

**Data_Props_Required**: Server component. `fetchOrderStatus` returns one of three
outcomes and the screen must render all three, never a generic error: `not_found`
("We can't find that order" + Back to menu), `unavailable` ("We can't reach the
kitchen right now" + Back to menu, order unaffected), or `ok` with `{status,
etaMinutes}`. On `ok`: a status headline via `statusLabel(status)`, coloured by
`statusTone(status)` — `live` (sage, with a small pulsing sage dot), `settled`
(neutral ink-muted), `failed` (destructive red) — matching the exact tone system
already shipped on `/account/orders`. ETA only renders when `TRACKABLE_STATUSES`
contains the status (an allowlist — delivered/cancelled/refunded/failed dishes get
no ETA line). A `failed` tone additionally shows "This order did not complete —
you have not been charged for it." Two buttons: "Track live" (gold, links to
`/track/:orderId`, **only rendered when `TRACKABLE_STATUSES` contains the status**
— a delivered or cancelled order gets no dead Track link) and "Back to the menu"
(ghost/outline). Below that: **PlanPerks** (client island, conditional — may render
nothing at all when there's nothing to show; when present, shows a sage credit-applied
line, a sage creditback line, a post-purchase add-on attach card, and/or a plain
autopay-disclaimer note, any subset) and **ThankYouRecommendations** (static
3-card grid: Talk to a Dietitian / Join a Cohort Challenge / Upgrade to Premium,
each a badge + title + one line + a bordered ghost CTA linking out).

**Critical_UX_Constraints**: This is a confirmation, not a celebration page — no
confetti, no oversized checkmark hero. Order id renders in `tabular-nums`. The
status headline is the single largest, most prominent element on the screen; PlanPerks
and ThankYouRecommendations are secondary and visually subordinate, stacked below a
clear break. Never invent a status the server didn't send, and never show an ETA on
a settled/failed order.

---

## Brief 22 — `/track/[orderId]`

**Target_Route**: `/track/[orderId]` — live order tracking, reachable from Brief
21's "Track live" and from `/account/orders`.

**Data_Props_Required**: Server shell (heading "Tracking your order" + `#orderId`
in `tabular-nums` + a short ISO-22000 kitchen-hygiene line) around one client
island, **TrackStatus**, which polls the guest status endpoint every 20s. Four
render states: loading skeleton (a pulsing neutral block, no spinner), `not_found`
card, `unavailable` card ("Live tracking is unreachable right now" / "Your order is
unaffected — this screen retries automatically"), and the live card. The live card
uses the **exact same** `statusTone` colour system as Brief 21 (sage pulse for
`live`, neutral for `settled`, destructive for `failed`) — a customer bouncing
between `/order/confirmed` and `/track` must see one consistent visual language, not
two. ETA (`tabular-nums`, "Estimated arrival in N min") renders only while
`TRACKABLE_STATUSES` holds; "This order has been delivered." renders only when the
status is literally `delivered`; the failed-tone card shows the same
did-not-complete line as Brief 21. The component stops polling once the order
reaches a terminal status — no visual requirement here beyond not implying
liveness (no pulse dot) once the status is settled or failed.

**Critical_UX_Constraints**: `aria-live="polite"` on the status region (already a
requirement, not new — preserve the semantics, just restyle). No numeric status
percentage or map/route visualisation — the real data is a status string + an ETA
integer, nothing else; do not invent a progress bar with false precision. This
screen is revisited over minutes, sometimes reloaded from a push notification — it
must look complete and calm on first paint, not mid-animation.

---

## Brief 23 — `/trial`

**Target_Route**: `/trial` — the 3-Day Taste Test offer, a funnel entry point
distinct from `/checkout` but priced identically seriously: this IS a purchase
decision.

**Data_Props_Required**: Server-rendered offer hero (eyebrow "Not ready for a
month?", headline "Try 3 lunches for ₹399", the verbatim creditback line from
copy) + a "What happens after the trial?" card quoting the real weekly/monthly
prices of the desk_fuel plan (`computePlanQuote`, never invented) + a "How the
creditback works" numbered 3-step card. In between: **TrialStart** (client
island) — a Veg/Non-veg segmented toggle (`role="group"`, `aria-pressed`), a
3-across grid of the fixed trio's dish photos + names for whichever track is
active (never a customer-composed selection — the trio is fixed per track), and
the ONE money-bearing CTA on this screen: "Start the taste test · ₹399" in the
glass sticky footer (checkout vocabulary — this is the commitment moment, so it
earns the sticky-footer treatment `/custom-build` and `/quick-setup` do NOT get).
Below the button, a small "no auto-convert" reassurance line.

**Critical_UX_Constraints**: The trio images are real food photography, never
generic icons — this is the single highest-intent moment for actual dish appeal in
the batch. The three explainer cards (what-happens-after / how-creditback-works)
must not out-compete the trio + CTA for visual weight; they are reassurance
copy, secondary to the offer itself. Track toggle switches the trio instantly, no
loading state needed (both trios are already resolved server-side).

---

## Brief 24 — `/quick-setup`

**Target_Route**: `/quick-setup` — a 3-step dietary/goal wizard, a second funnel
entry point (onboarding, not purchase).

**Data_Props_Required**: Server shell (hero) around **QuickSetupWizard** (client
island), a 3-step flow using the shared **StepDots** component (checkout
vocabulary — replace any bespoke progress-pill row with the real component,
`current`/`total` = step/3). Step 1: goal (3 selectable cards, radio semantics).
Step 2: allergen exclusions (4 toggle rows, "Select dietary allergens our kitchen
must strictly omit" — this copy is a real promise, the selections are genuinely
persisted). Step 3: dietary style (2 radio rows) + a short honest note that
clinical conditions below affect today's preview only and are not saved (linking to
`/account/health-information`) + condition checkboxes (PCOS / Type 2 Diabetes).
Step 4 (reached via "See Customized Menu", which also fires the real save): a
state card with FOUR distinct renderings — busy ("Saving your profile…"), saved
("Profile Saved" + goal/style summary, this state is only reachable after a real
successful save), needsAuth (a sign-in prompt + the existing **PhoneAuth** island
inline, never a redirect, selections preserved), and error (short message + Retry
button) — plus, always below the state card regardless of which of the four is
showing, **InstantPlanPreview**: a "Top 3 Therapeutic Meal Matches" list (each a
food photo, a sage badge, one line of reasoning, price, and an Add-to-cart button)
OR, when nothing matches, an empty state with a "Consult a Dietitian" link. A gold
"Activate Recurring Subscription" CTA closes the preview.

**Critical_UX_Constraints**: This is the batch's PHI boundary — the condition
checkboxes must visually read as lighter-weight / more provisional than the
allergen step (which is genuinely saved), and the link out to
`/account/health-information` must be visible, not buried. The needsAuth state is
not a dead end or a wall — the wizard's step 1–3 selections stay visible/summarised
while `<PhoneAuth>` is offered inline. No sticky footer on this route — the wizard's
own step navigation (Back / Continue) stays inline at the bottom of the card, matching
the current shipped behaviour; do not add a second, competing sticky action bar.

---

## Brief 25 — `/custom-build`

**Target_Route**: `/custom-build` — per-dish order customisation, a second-order
surface reached from the menu, not a funnel entry point.

**Data_Props_Required**: Server shell (hero, honest copy — "Pick a dish, adjust its
real customisation options... before adding it to your order", no invented
clinical claims) around **CustomBuildHub** (client island), a two-column layout:
left column is (1) a scrollable dish picker (8 dishes, price + macros + kitchen
tag per row) and (2) a "Customise" section rendering the SELECTED dish's real
`customizations` groups — single-select groups as a radio row (one active), multi-
select groups as independent toggle chips, each option showing its real
`priceModifier` ("+₹15" or "Included"); when a dish has zero customisation groups
(most of them — this is normal, not an error), an honest "No customisation options
for this dish" note, never an empty box. Right column (sticky): an order-summary
card — dish name, a one-line "Customised: X, Y" or "No customisations selected"
summary, then Base price / Customisations / Estimated total in
`tabular-nums`, a short sage note that selections travel to checkout where the
server computes the final price (this total is a preview, said plainly, not a
guarantee dressed as one), an "Add to cart" button (plain verb, no amount — money
discipline above), and a "Save to Vault" secondary action.

**Critical_UX_Constraints**: The customisation option buttons need a clear,
immediate active/inactive state (border-gold + gold fill on select) since price
changes live as the customer taps — this is the whole point of the screen. Do not
compress the option grid so tightly that the price-modifier text clips; it is the
one number on this screen the customer is actively deciding against. No sticky
footer — the summary card is already sticky (`lg:sticky top-6`) and doing that job;
a second fixed bar would fight it for the same screen real estate.

---

## Brief 26 — `/login`

**Target_Route**: `/login` — standalone sign-in, reachable from anywhere in the app
(account gates, `?next=` deep links), NOT part of the checkout flow (checkout keeps
its own in-flow identity step).

**Data_Props_Required**: A single narrow card (`max-w-md`), three states. (1)
Checking: "Checking your session…" while an existing-session probe runs — brief,
should not flash if the probe resolves fast. (2) Sign-in: "A code by SMS, no
passwords." + the **PhoneAuth** island in its natural three-stage shape — collapsed
("Have an account? Sign in for faster checkout" as a plain text link, not a
button), phone-entry (labelled number input + "Send code"), code-entry (labelled
6-digit input + "Verify" + a "Resend" ghost action) — plus an inline reCAPTCHA
mount point Stitch does not need to style beyond reserving its space. (3)
Unavailable (no Firebase config shipped): a plain-text warning ("Sign-in is
temporarily unavailable...") in the destructive colour + a gold "Browse the menu"
fallback CTA — this state must look intentional and calm, not like a crashed page.

**Critical_UX_Constraints**: This card is reused verbatim inside Brief 24's
needsAuth state (same `<PhoneAuth>` component) — style it once, correctly, here.
No page chrome beyond the shared header/footer; this is the plainest, most
utilitarian screen in the batch and should look it — one card, centered, nothing
competing with the OTP flow for attention.

---

## Generation log

All six generated against project `9085082841997152511` ("Tanmatra Storefront —
Clinical Metabolic OS (Batches 3–5)") with design system `assets/0b599b1692164d81b3389c7121485392`
("Tanmatra"), `GEMINI_3_1_PRO`, `MOBILE`, one at a time via the same direct-MCP-over-HTTP
curl technique Batch 3's resolution section documents (the harness's own
`MCP_TOOL_TIMEOUT` stays capped at 60s in this environment; generation itself runs
well past that, so the in-harness `mcp__stitch__generate_screen_from_text` tool is
unusable for this step — cheap calls like `get_project` still go through it fine).

| Brief | Screen id | Title | Size | Banked at |
|---|---|---|---|---|
| 21 | `c569e70c739f4d6abf5c1dc8c7c12214` | Order Confirmation - Being Fired | 780×2942 | `route-21-order-confirmed/` |
| 22 | `cd42b5ef84f84631b9be152d1b98fbd1` | Live Order Tracking - /track/[orderId] | 780×1768 | `route-22-track/` |
| 23 | `d3d1646d204e4458a993218fbc0b1223` | 3-Day Taste Test Trial | 780×2354 | `route-23-trial/` (+1 hero imagery) |
| 24 | `b48e7436f92f47dc88b7d7d4684f38f2` | Quick Setup - Allergens & Matches | 780×3516 | `route-24-quick-setup/` |
| 25 | `f8f49e0c368149c1936b49ea0cc201db` | Custom Build - /custom-build | 780×3036 | `route-25-custom-build/` |
| 26 | `fed54721e9184e83b7e947b8d88f315d` | Sign In - /login | 780×1768 | `route-26-login/` |

QA pass over all six banked files: gold defined once per file, no white-ink-on-gold,
no indigo on buttons, no global header/nav/footer chrome (three files have a local
`<header>` — 24's and 26's are legitimate in-page section headers matching their
briefs exactly; 26's has no chrome at all). One nit for the wiring stage: brief 25
(`/custom-build`) hallucinated its own step-dot row ("Step 2 of 4: Custom Build") —
the real route is not a multi-step wizard at all, it's a single free-form
customisation screen, so that element does not get wired in; the real StepDots
component belongs on brief 24 (`/quick-setup`) instead, which is the one genuine
multi-step flow in this batch.
