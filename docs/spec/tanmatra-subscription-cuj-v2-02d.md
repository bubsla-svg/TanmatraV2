# Subscription CUJ v2 — Amendment 02d

**Date:** 2026-07-21 · **Supersedes:** the pre-plan-architecture subscription journey · **Composes with:** Amendment 02 (plans, bump), 02b (trial), 02c (checkout), IMPECCABLE, rescue plan Phase 2 **Why revise:** the existing CUJ was functional for a catalog; it predates the four named plans, the trial rung, and the breeze checkout. A journey built for browsing dishes cannot be optimal for subscribing to positioned plans.

> Transcribed into the repo from the Google Doc source (`1cB2KxPQV8tzZNtm9Bf9zsexBeZzka6mvNui65Ztap6w`) on 2026-07-22.

## 1. The elevation thesis

Three substitutions, each trading an expensive cognitive act for a cheap one:

1. **Comparison → recognition.** Reading and weighing four plan cards is comparison shopping — the heaviest load in the journey. Self-identification is nearly free. The journey opens with one question, and the answer *is* the plan.
2. **Construction → confirmation.** The three-axis builder currently asks the user to assemble a subscription. With defaults on every axis, it asks them to *approve* one — configure-by-exception.
3. **Payment → retention as the journey's end.** The CUJ doesn't end at "paid"; it ends at week-2 retained. First delivery is the real conversion event, so onboarding beats are journey stages, not marketing afterthoughts.

## 2. The router — "What's lunch for?"

One screen, one question, five tappable answers, no typing:

| Answer | Routes to | Note |
|---|---|---|
| "Get me through the workday" | Desk Fuel | modal path |
| "Keep my sugar steady" | Steady | credibility beat applies (§6) |
| "I'm on a GLP-1" | GLP-1 Companion | credibility beat applies (§6) |
| "Build muscle" | Protein Build | |
| "Just show me the food" | Menu (PLP) | the escape hatch — browsers are never trapped in a quiz |

Mechanics: hero primary CTA "Find my plan" opens it; skippable at every moment; answer persists as the preference default downstream; never re-asked. It is one tap — not a multi-step quiz. Goal Fit Analysis remains the *deeper* optional instrument on the PDP (per the existing direction); the router is its one-tap cousin, not its replacement.

## 3. Stage map v2

| # | Stage | Surface | The one decision | Default (pre-selected) | Load removed vs current |
|---|---|---|---|---|---|
| 0 | Arrive | Home | none — PIN gate is a check, not a choice | geolocated PIN suggestion | dead-end geography discovered at checkout |
| 1 | Recognize | Router | which goal is mine | — | reading + comparing 4 plan cards |
| 2 | See the match | Plan page (matched plan first, other three one swipe/tap away) | this is my plan → continue (or trial) | matched plan | plan-grid paralysis; macros walls (chips + one "The science" collapse) |
| 3 | Confirm config | Builder | approve or adjust | duration: Monthly (per-meal price leading) · meals/day: 1 (lunch) · preference: from router or Veg · start: next weekday | three simultaneous unset axes |
| 4 | Review | Plan review | RD bump yes/no (the only upsell, 02 §5) | bump unselected | scattered upsells later in flow |
| 5–7 | Checkout | 02c screens | identity · address · pay | per 02c | per 02c — entire spec applies |
| 8 | Confirmed | Confirmation | Evening Add (skippable) | skipped | per 02c/§13 |
| 9 | Onboard | WhatsApp + first box | none | — | see §7 |

**Happy-path decision count, landing → pay screen: 5** (goal · plan · config-approve · bump-decline · pay). The previous journey carried 9–11 including implicit comparisons.

## 4. Defaults doctrine

Every axis ships pre-selected to the honest modal choice; changing is one tap on a segmented control (no dropdowns at ≤4 options, IMPECCABLE §8.4 spirit). "Most popular" badges appear only when order data actually says so (§2.6) — until the data exists, no badge. Defaults are never dark: the pre-selected state is fully visible, priced, and one tap from any alternative. The trial (02b) renders as the secondary action at stages 2 and 4 exactly per its anti-cannibalization rules — the pressure-release valve at both hesitation points.

## 5. Price framing ladder

Per-meal price leads at stages 1–4 ("₹199/meal · your meal card covers it"); the exact total is always visible but secondary; at the pay screen the total leads (02c). One framing per stage, never both fighting for primacy. The monthly number a user first meets at stage 3 is the same number they pay at stage 7 — the ladder reorders emphasis, never the amount (§10.1 makes drift impossible anyway).

## 6. Appropriate friction — the clinical exception

Load reduction is not friction elimination. Steady and GLP-1 Companion each carry **one deliberate credibility pause** at stage 2: the named-RD block (photo, credentials, sage RD Verified), and for GLP-1 the boundary line "designed to work alongside your prescribing doctor." This beat costs seconds and buys the trust that clinical positioning runs on — removing it would make the journey faster and the plan less believable. It is the only sanctioned slowdown in the CUJ.

## 7. Onboarding beats (stages 9a–9d — the journey's actual end)

9a **T-1 evening:** WhatsApp — "Your first Desk Fuel lunch arrives tomorrow, 12:30–1:30." · 9b **Day 1:** "Left the kitchen" ping; box carries the insert card (02b machinery reused). · 9c **After first delivery — not before:** controls intro, one message: "Skip a day, swap a dish, pause anytime — all here." Teaching controls before there's anything to control is pure load. · 9d **Day 3:** one-tap sentiment check (👍/👎 + optional line) routed to ops; a 👎 gets a human reply, not a form. **Week-2 renewal-intact = journey complete.** Digital touches capped at the lifecycle rules (02 §5).

## 8. Zero-dead-end rule

Every state in stages 0–9 names its next action: unserviceable PIN → "notify me" + Teams pointer; builder abandon → state persists 7 days, return resumes at stage 3; payment fail → 02c recovery; router skip → menu with a floating "Find my plan" affordance. The audit-era failures (silent absorption, 404s, blank cold-loads) are unrepresentable in this map — if a screen exists, its empty/error/next states exist (IMPECCABLE §8.1/§13).

## 9. Budgets & funnel instrumentation

Landing → subscribed, new decided user: **≤14 taps, ≤3 minutes, 0 typed fields before checkout identity** (composes with 02c's ≤9-tap checkout). Trial-convert path: ≤5 taps (credit auto-applied). Funnel events, named now so analytics and Playwright share a vocabulary: cuj_pin_ok → cuj_router_answer → cuj_plan_view → cuj_builder_open → cuj_builder_confirm → cuj_review → cuj_checkout_start → cuj_paid → cuj_first_delivery → cuj_week2_retained. Stage-to-stage conversion joins the benchmark framework scoreboard; the 28.1% menu→cart baseline maps to plan_view → builder_confirm as its successor metric.

## 10. Delta summary (what "elevated" means, concretely)

| Dimension | Existing CUJ | v2 |
|---|---|---|
| Plan selection | compare 4 cards + tiers | recognize via 1 question |
| Builder | 3 unset axes | approve defaults, adjust by exception |
| Decisions to pay screen | 9–11 | **5** |
| Upsell placement | scattered | exactly two: bump (stage 4), Evening Add (stage 8) |
| Journey end | payment | week-2 retained |
| Clinical trust | macro walls | one credibility beat, chips elsewhere |
| Dead ends | discovered by users | structurally impossible |
