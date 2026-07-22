# Frontend UI Construction Spec — Amendment 02f

**Date:** 2026-07-22 · **Governs:** screen composition and component construction for rebuild Phases 1–3 · **Subordinate to:** IMPECCABLE.md (tokens, states, a11y, safety, performance — all of it applies and none of it is restated here) **Rule:** IMPECCABLE says how things may look. This says what to build. If a value you need isn't here, it's in IMPECCABLE; if it's in neither, propose it — never improvise it.

> Transcribed into the repo from the Google Doc source (`1ZLia2ISZvihH7Rh4Jxp-JoOaUtNIY8FRJJVkuj-JVBw`) on 2026-07-22.

## 1. Component manifest (build in this order — each depends on the ones above)

| # | Component | Key props | Notes |
|---|---|---|---|
| 1 | `<Chip>` | glyph, label, value?, tone | 12-glyph closed set, Amd 02 §4. Tone maps to semantic tokens only. |
| 2 | `<DietMark>` | type: 'veg' \| 'nonveg' | FSSAI. Min 14px. Never restyled. Not a `<Chip>` — separate component so it can't be refactored into the chip array. |
| 3 | `<Price>` | paise, size, strike? | Intl.NumberFormat('en-IN'), tabular figures. **Accepts server-quoted values only** — no arithmetic props. |
| 4 | `<DishImage>` | src, ratio, priority? | Fixed aspect-ratio, AVIF/WebP, blur placeholder. |
| 5 | `<MacroReadout>` | macros, verified | verified=false → labels without numerals (Brief A5 gate). |
| 6 | `<RdBadge>` | rdName, credential, photo? | Sage. The trust primitive — used on PDP, plan page, bump card. |
| 7 | `<DishCard>` | dish, onOpen | IMPECCABLE §8.5 anatomy. Max 3 chips. |
| 8 | `<PlanCard>` | plan, variant: 'matched' \| 'alt', onSelect, onTrial | §2.2 below. |
| 9 | `<StickyBar>` | total?, cta, subLabel? | The one persistent action surface. Safe-area aware. |
| 10 | `<SegmentedControl>` | options, value, onChange | ≤4 options. Replaces every dropdown in the builder. |
| 11 | `<OrderBump>` | offer, onAccept, onDecline | §2.5. Single-use per flow. |
| 12 | `<StepDots>` | current, total | Checkout only. Non-interactive. |
| 13 | `<Sheet>` | open, onClose, snapPoints | Focus trap, Escape, focus return (IMPECCABLE §14). |

Anything not on this list is a page-level composition, not a component. Do not create a `<Card>` abstraction that these share — variance between them is deliberate.

## 2. Screen compositions

### 2.1 Router — "What's lunch for?"

Full-viewport, no header nav, no scroll on a 390×844 baseline. Question in display size, ≤6 words. Five stacked answer buttons, each ≥64px tall, full-bleed minus 16px gutters, 12px apart — thumb-reachable without aim. Text only: **no icons on answers** (icons invite decoding; these are read once and tapped). Fifth option ("Just show me the food") is visually subordinate — text-style, not outlined. Dismiss affordance top-right. No progress indicator: implying steps that don't exist is its own load.

### 2.2 `<PlanCard>` anatomy (top → bottom, exact order)

Photo (16:9, one hero dish) → plan name → **one-line promise** (≤8 words) → per-meal price in display size + total in secondary → 3 chips max (goal glyph, Meal-card OK, one proof) → primary CTA "Start [Plan]" → secondary text link "Try 3 days — ₹399". variant='matched': full width, saffron CTA, RD badge if clinical. variant='alt': 60% height, condensed, outlined CTA, no chips. **The matched card is 2× the visual weight of alternates** — that ratio is the recognition mechanic; equal-weight cards recreate comparison shopping.

### 2.3 Plan page

Hero dish photo (4:3 mobile) → plan name + promise → `<RdBadge>` for Steady/GLP-1 (the credibility beat, 02d §6 — never collapsed) → this week's menu as a horizontal scroller of `<DishCard>`s → "What's included" as ≤5 icon rows, never prose → one "The science" collapse → sticky `<StickyBar>` with per-meal price + "Continue". Alternate plans live behind a bottom "Other plans" strip, not a tab bar.

### 2.4 Builder — confirm, don't construct

Three `<SegmentedControl>`s stacked (duration · meals/day · preference), every one pre-filled per 02d §5, plus a start-date row showing the default with an inline edit affordance. Total updates in place on change — **no layout shift, no spinner over the number** (a jumping total is IMPECCABLE §15 and a trust break). Sticky bar: total + "Review". Entire screen fits one viewport at 390×844; if it doesn't, cut a control, not the padding.

### 2.5 `<OrderBump>` — the RD offer

Bordered card, raised surface, **not** a checkbox row. Contents: RD photo (circular, 56px) → "Add your dietitian — [Name], RD" → two-line value ("2 video sessions a month · weekly tuning on WhatsApp") → +₹499/mo with clinic rate ₹1,999+ as adjacent secondary text (never a strikethrough — it's someone else's price, not a former price) → "Your plan is complete without it" in secondary, always visible → single "Add" button. Declining = doing nothing; there is no decline button to hunt for. Accepted state: card collapses to one confirmed line + "Remove".

### 2.6 Trial card

Appears as secondary on plan surfaces. Anatomy: "Try 3 days first" → ₹399 → **one sentence of mechanics, verbatim**: "Credited in full when you start any plan within 7 days." → three dish thumbnails (the fixed trio, 02e §3.5) → outlined CTA. Never saffron-filled: it must not out-compete the plan CTA it sits beneath.

## 3. Mobile interaction rules

**Thumb zone.** Every primary action lives in the bottom third. Nothing that advances the journey sits in the top 25% of the viewport — that region is for orientation and dismissal only. **Sticky bar contract:** one per screen, ≤88px tall, always shows the amount at stake plus one verb; it is the only fixed element besides the header; it clears env(safe-area-inset-bottom). **Sheets over navigation** for anything reversible (dish detail from builder, address edit, payment method expansion) — a sheet preserves context; a route change destroys it. **Gestures are never the only path:** swipe on the plan-alternates strip has a visible tap affordance too. **Tap feedback ≤100ms** — scale-down 0.98 on :active, transform only.

## 4. Photography & merchandising

| Surface | Ratio | Shot |
|---|---|---|
| Plan card hero | 16:9 | one signature dish, 45° angle, natural light, on-brand surface |
| Plan page hero | 4:3 mobile / 21:9 desktop | same dish, closer crop |
| Dish card (grid) | 1:1 | top-down, consistent plate, consistent framing across the whole grid |
| PDP hero | 4:3 | 45°, garnish visible, steam if hot |
| Trial thumbnails | 1:1 | the fixed trio, identical treatment |
| RD badge | 1:1 circular | real photo, clinical-warm, no stock |

Grid consistency outranks individual shot quality: one dish shot from a different height breaks the whole grid's rhythm. Every surface ships with its reserved dimensions before the image loads (IMPECCABLE §12/§15). Shoot at the new price points — the photography *is* the justification for the reprice (02a §7).

## 5. Density & hierarchy law

One dominant element per viewport — if two things compete, one is wrong. Per-viewport ceilings on any commerce surface: **1** primary CTA · **3** chips per card · **5** icon rows in any "what's included" block · **2** lines per paragraph · **0** paragraphs above the fold. Vertical rhythm: 32px between sections, 16px within, 8px inside components. When a screen feels full, remove a decision, not whitespace.

## 6. Do not build

No tab bars on plan surfaces (they imply parallel comparison) · no carousels that auto-advance · no modal over modal · no sticky element besides header and one bar · no skeleton that differs in size from its loaded content · no "recommended" or "popular" badge without order data behind it (IMPECCABLE §2.6) · no shared `<Card>` base component · no icon-only controls in the money path · no toast as the sole confirmation of a money event.
