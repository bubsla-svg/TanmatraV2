# Design System: Tanmatra — Premium Clinical Metabolic OS

> Single source of truth for every Stitch screen generation in the total-redesign
> programme (Batches 1–5). Every route brief transmitted to Stitch references this
> document; the per-route payload only adds `Target_Route`, `Data_Props_Required`
> and route-specific `Critical_UX_Constraints`. Generated via the stitch-skill
> engine; reconciliations between the owner's brief and the engine's hard rules
> are marked ⚖.

## 1. Visual Theme & Atmosphere

A dark, food-first clinical operating system — the confidence of a diagnostics
lab shot through the warmth of a chef's pass. Surfaces are deep charcoal glass;
food photography is the only saturated thing on screen, so plates read as the
heroes and the interface recedes to instrumentation. Empathetic, not sterile:
clinical numbers are present but quiet, set in monospace and small caps, never
shouting. No text walls anywhere — meaning arrives through imagery, badges and
short declarative lines.

- **Density:** 4 — "Daily App Balanced". Generous breathing room between
  sections (`clamp(3rem, 8vw, 6rem)`), tighter inside cards.
- **Variance:** 6 — "Offset Asymmetric". Split and staggered compositions;
  centered heroes are banned at this variance.
- **Motion:** 5 — "Fluid". Spring physics, kinetic press states, no cinema.

## 2. Color Palette & Roles

- **Obsidian Canvas** (`#0A0A0A`, Tailwind `neutral-950`) — primary background.
  Never pure black.
- **Graphite Surface** (`#171717`, `neutral-900`) — raised cards, sheets, bars.
- **Smoked Glass** (`rgba(23,23,23,0.72)` + `backdrop-blur-md`) — floating
  chrome: sticky bars, overlays, the mini-cart.
- **Whisper Hairline** (`rgba(255,255,255,0.06)`) — every border. Zero flat
  opaque borders anywhere.
- **Off-White Ink** (`#F5F5F4`) — headlines and primary text.
- **Muted Steel** (`#A3A3A3`, `neutral-400`) — secondary text, metadata.
- **Clinical Gold** (`#D4AF37`, saturation 65% — under the 80% cap) — **the
  only action colour.** Primary CTAs, active tab, focus rings, price emphasis.
  Ink on gold fill: `#111318` (8.84:1). ⚖ Owner caveat and engine single-accent
  rule agree here: one accent, and it is gold.
- **Royal Indigo** (`#3E4C8A`, saturation 38%) — ⚖ NOT a second action colour.
  Structural signal only: data-viz fills, protocol-tier badges, subtle section
  tint washes. Never on a button, never interactive.
- **Sage Signal** (`#7D9E7E`) / **Ember Warning** (`#B6892F`) / **Clay Danger**
  (`#B0655A`) — status semantics only, inherited from the token bridge.

Banned: purple/neon glows, gradient text on headlines, warm/cool grey mixing
(neutral scale only), any second interactive hue.

## 3. Typography Rules

- **Display:** `Satoshi` — track-tight (`-0.02em`), weight-driven hierarchy
  (500→700), scale via `clamp()`. Headlines never exceed 3 lines.
- **Body:** `Satoshi` — relaxed leading (1.6), 65ch max measure, Muted Steel
  for secondary copy.
- **Clinical data / prices / macros:** `JetBrains Mono` with
  `font-variant-numeric: tabular-nums` — this is an existing repo law
  (`.text-clinical-data`) and the engine's high-density monospace rule agrees.
- ⚖ Engine bans `Inter`; the shipped storefront uses IBM Plex Sans. The
  redesign moves display+body to Satoshi; JetBrains Mono is retained (already
  self-hosted). Font swap lands once, in the shared layout, not per-route.
- Serif: banned (software UI context).

## 4. Component Stylings

- **Buttons:** squircle pills (`rounded-full`), Clinical Gold fill with
  `#111318` ink for primary; ghost (hairline border + off-white ink) for
  secondary. Active state: `scale-[0.98]` with a 120ms spring — the kinetic
  haptic. No outer glows, no gradients, no cursor tricks.
- **Cards:** `rounded-3xl` outer, `rounded-2xl` for nested media, Graphite
  Surface fill, Whisper Hairline border, shadow tinted to canvas
  (`shadow-black/40`). Food imagery bleeds to the card edge on top
  (`rounded-t-3xl`), text zone below — never text over image.
- **Badges/chips:** `rounded-full`, hairline border, monospace for numeric
  content (macros: `32P · 41C · 12F`), Royal Indigo tint for protocol tiers,
  Sage/Ember/Clay for status. Visual macro badges replace nutrition paragraphs.
- **Inputs:** label above, error below in Clay, focus ring in gold. No floating
  labels.
- **Loading:** skeletal shimmer matching final layout geometry. No spinners.
- **Empty states:** composed plate-photography compositions with one gold action.

## 5. Layout Principles

- Mobile-first; all multi-column collapses to single column under 768px, no
  horizontal scroll ever, 44px minimum touch targets.
- Desktop containment: `max-w-screen-xl mx-auto`; full-height moments use
  `min-h-[100dvh]`, never `h-screen`.
- **Reserved chrome (hard, app-wide):** the global layout owns exactly one
  `<header>` (Smoked Glass, serviceability entry) and, on mobile, the bottom
  4rem belongs to `MobileBottomNav` with `MiniCartBar` stacking above it.
  Generated screens must not introduce their own nav, header, footer, or a
  competing bottom-fixed bar. `pb-safe` (env(safe-area-inset-bottom)) on every
  bottom-fixed element. Footer is desktop-only.
- Asymmetric splits over centered stacks; the 3-equal-cards feature row is
  banned — use 2-column zig-zag, offset grids, or horizontal snap-scroll rails.
- No overlapping elements; every element owns its spatial zone.

## 6. Motion & Interaction

- Spring physics everywhere: `stiffness: 100, damping: 20`. No linear easing.
- Press feedback: `scale-[0.98]` on all interactive surfaces (the kinetic
  haptic), `transform`/`opacity` only — never top/left/width/height.
- Staggered cascade reveals for lists and grids (60–90ms steps).
- One perpetual micro-loop per screen maximum (e.g. a shimmer on the live
  delivery ETA) — dashboards breathe, they don't blink.
- `prefers-reduced-motion` collapses all of it to opacity fades (repo a11y law).

## 7. Anti-Patterns (Banned)

No emojis. No Inter. No pure `#000000`. No neon/outer glows. No oversaturated
accents. No gradient headline text. No custom cursors. No overlapping elements.
No 3-column equal card rows. No centered hero at variance 6. No "Scroll to
explore"/chevron filler. No generic names or fake round numbers — all data is
real wire data (Phase 3 rule 4: mock arrays are stripped and replaced with API
payloads before commit). No AI copy clichés ("Elevate", "Seamless", "Unleash").
No second interactive colour. No client-side price computation — the server
owns every amount; the UI renders pre-formatted strings it was given.

---

# Route Brief 01: `/home` (Batch 1, Item 1)

**Source:** `artifacts/storefront/app/page.tsx` — Server Component, 15-section
landing. DTR personalization: `tnm_ref` cookie → `deriveHeroContent()` →
`HeroContent { eyebrow, headline, blurb, badge|null }`. Per-meal price arrives
pre-formatted inside `hero.blurb` from `PLAN_PRICE_TABLE` (test-pinned; never a
literal).

**Screen spec (Stitch visual description):**

1. **§01 Hero — asymmetric split.** Left 55%: eyebrow in small-caps Muted
   Steel; headline in Satoshi 600 with ONE inline plate photo embedded at
   type-height between words (`rounded-2xl`, ~1.1em tall) — the signature
   move, replacing the current full-bleed hero image; blurb ≤2 lines; the
   optional `badge` renders as a gold-hairline pill. One primary CTA: gold
   pill → `/menu`. ⚖ Engine allows one primary CTA; the required secondary
   route `/plans` becomes a ghost pill, visually subordinate (hairline, no
   fill) — a real action, not "learn more" filler. Right 45%: tall food
   photograph in a `rounded-3xl` frame with a floating Smoked Glass macro
   badge. Mobile: image stacks below headline; inline photo drops to a
   leading thumbnail.
2. **Serviceability slot** — desktop only (`hidden sm:block`), Smoked Glass
   bar, gold MAP affordance; mobile relies on the Header's copy (do not
   duplicate).
3. **§02 Qualification chips** — horizontal snap rail of hairline pills.
4. **§04 Protocols grid** — 2-column zig-zag (not 3-equal), Royal Indigo tier
   badges, each card food-photo-led.
5. **§04b Marketplace** — horizontal snap-scroll rail of product cards,
   monospace prices.
6. **§09 Assessment stepper** — one gold action per screen-state, progress as
   a thin gold line, never a text wall.
7. **§09b Recipes bridge → §05–07 proofs** — alternating offset split panels;
   macros proof uses monospace tabular figures on Graphite cards.
8. **§03 B2B / §04 Telehealth / §05 Logistics / §03 Agitation** — quieter
   rhythm, Royal Indigo tint washes distinguish the B2B band.
9. **§10 FAQ** — single-column accordion, hairline dividers, no cards.

**Wiring contract (Phase 3, enforced before commit):** page stays a Server
Component; sections receive existing props only (`hero` is the sole prop
surface); `ServiceabilityBar`, `CartProvider`, `MiniCartBar`,
`MobileBottomNav` are consumed, never reimplemented; CTAs are `next/link`
hrefs; no `useState` introduced at page level; all copy/pricing flows from
`lib/heroContent.ts` — Stitch placeholder text is stripped on arrival.
