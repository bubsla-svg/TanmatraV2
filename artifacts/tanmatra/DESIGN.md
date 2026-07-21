---
name: Tanmatra
description: Clinical wellness and nutrition commerce — a dark, saffron-lit storefront with a monospace clinical data layer.
colors:
  saffron: "#fbbf24"
  saffron-on: "#402d00"
  cyan: "#34daff"
  sage: "#7d9e7e"
  macro-protein: "#8fb996"
  macro-carbs: "#cbb07a"
  macro-fat: "#d9a488"
  success: "#93b59b"
  error: "#dc8773"
  warning: "#d8b45e"
  info: "#7fa3b3"
  nn-bg: "#131313"
  nn-surface: "#1f1f1f"
  nn-surface-high: "#2a2a2a"
  nn-on-surface: "#e2e2e2"
  nn-secondary: "#c6c6c7"
  nn-outline: "#9c8f79"
  nn-error: "#ffb4ab"
  ink-900: "#0b0c0e"
  ink-800: "#141619"
  ink-700: "#1b1e22"
  bone: "#f2f0e9"
  mute: "#8b9099"
typography:
  display:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 1.2rem + 2.4vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
  data:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  serif:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(2rem, 1.4rem + 3vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "normal"
rounded:
  input: "11px"
  btn: "12px"
  card: "16px"
  sheet: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
  "3xl": "48px"
  "4xl": "64px"
components:
  button-primary:
    backgroundColor: "{colors.saffron}"
    textColor: "{colors.saffron-on}"
    rounded: "{rounded.btn}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.nn-surface}"
    textColor: "{colors.nn-on-surface}"
    rounded: "{rounded.btn}"
    padding: "0 16px"
    height: "44px"
  chip:
    backgroundColor: "{colors.nn-surface}"
    textColor: "{colors.nn-secondary}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "34px"
  chip-selected:
    backgroundColor: "{colors.nn-surface}"
    textColor: "{colors.saffron}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "34px"
  card:
    backgroundColor: "{colors.nn-surface}"
    textColor: "{colors.nn-on-surface}"
    rounded: "{rounded.card}"
    padding: "16px"
  input:
    backgroundColor: "{colors.nn-surface}"
    textColor: "{colors.nn-on-surface}"
    rounded: "{rounded.input}"
    padding: "0 12px"
    height: "44px"
---

# Design System: Tanmatra

## 1. Overview

**Creative North Star: "The Calm Clinic at Night"**

Tanmatra is a clinical wellness storefront that reads like a well-lit kitchen after dark: a deep near-black canvas, one warm saffron light that marks every action, and a disciplined monospace layer that makes nutrition numbers feel measured rather than marketed. The signature theme is dark. The mood is credible, precise, calm, and human — food you can trust because the interface never oversells it. Warmth comes from the saffron action color, the appetite of real dish photography, and plain-language copy, never from decoration.

The system explicitly rejects the sterile hospital-EMR look, the alarmist red-everywhere wellness-app look, and the trend-driven supplement-brand gradient look. It is not a generic food-delivery marketplace, not a luxury restaurant brand, and not a SaaS dashboard. Every clinical claim is attributed to a named dietitian; every number is honest to kitchen-level precision; every price comes from the server. Restraint is the register: one accent, one action per screen, progressive disclosure everywhere except safety information, which is always visible.

The palette is layered, not singular. A **Clinical-Dark base** (ink canvases, semantic macro and alert colors, tonal saffron/sage/clay/stone scales) provides the token foundation. The **Nocturnal Nourishment (NN)** layer — the `.tnm2` skin — sits on top and governs every live customer money-path surface (menu, dish, cart, checkout, subscriptions). Saffron `#fbbf24` is the single unified action color across both, exposed as `--action`.

**Key Characteristics:**
- Dark by default; deep near-black canvas, warm off-white text.
- Exactly one accent — saffron — and exactly one primary action per screen.
- A monospace clinical layer (JetBrains Mono) reserved for numbers, so data reads as measured.
- Token-only color; raw hex is a lint-blocking defect.
- Safety information (FSSAI marks, allergens) is exempt from minimalism and always shown.

## 2. Colors

A near-black clinical canvas lit by a single saffron action color, with a restrained semantic vocabulary for clinical data and alerts. Two coordinated dark layers share one accent.

### Primary
- **Saffron** (`#fbbf24`, `--color-nn-primary`, surfaced as `--action`): The one action color. Every primary button, active filter chip, selected state, add-to-cart affordance, price, and focus ring. On a saffron fill the label is dark ink (`--color-nn-on-primary` `#402d00`), never white. This is the whole brand's warmth; treat it as scarce and load-bearing.

### Tertiary
- **Electric Cyan** (`#34daff`, `--color-nn-tertiary`): A tertiary data accent, not a CTA and not a glow. Approved only for data highlights, informational emphasis inside clinical readouts, and active data-series indication. Sparingly.

### Secondary / Semantic
- **Sage** (`#7d9e7e`, `--color-clinical-sage`): The "verified / healthy / approved / suitable" semantic accent — dietitian-reviewed badges, strong-goal-match, in-cart stepper counts. Never a decorative brand green.
- **Macro triplet** — Protein (`#8fb996`), Carbohydrates (`#cbb07a`), Fat (`#d9a488`): The clinical data palette for macro charts, legends, and readouts. The same macro is the same color on every surface, always.
- **Alerts** — Success (`#93b59b`), Error (`#dc8773`), Warning (`#d8b45e`), Info (`#7fa3b3`): The Clinical-Dark base semantic set (`--color-*-theme`). On live `.tnm2` surfaces the error role resolves to `--color-nn-error` (`#ffb4ab`) with caution/alert tints (`#d97706` / `#dc2626`); use the token, not the hex.

### Neutral
- **NN canvas (live money-path):** background `#131313` (`--color-nn-bg`), surface `#1f1f1f`, raised `#2a2a2a`, primary text `#e2e2e2` (`--color-nn-on-surface`), secondary `#c6c6c7`, hairline outline `#9c8f79`. **This is the canvas of every customer commerce screen.**
- **Clinical-Dark base (non-`.tnm2` surfaces):** ink-900 `#0b0c0e`, ink-800 `#141619`, ink-700 `#1b1e22`, bone text `#f2f0e9`, mute `#8b9099`. Used by the legacy Tailwind/clinical utility surfaces and remapped to NN under `.nn-clinical`.

### Named Rules
**The One Saffron Rule.** Saffron is the only accent that marks action. If two things on a screen are saffron, one of them is not really the primary action — demote it. Cyan and sage never stand in as a second CTA color.

**The Two-Layer Rule.** A `.tnm2` (customer) surface draws its canvas, text, and alerts from `--color-nn-*`; a base Tailwind surface draws from `--color-ink-*` / `--color-*-theme`. Never hardcode one layer's canvas hex (`#0b0c0e`) onto the other layer's surface (`#131313`). Consume the token; the skin resolves it.

**The No-Legacy Rule.** Gold `#D4AF37` and blue `#6BA3C8` are retired. They are absent from the codebase and must never return. Saffron and cyan only.

## 3. Typography

**Display / Body Font:** Inter Variable (with Inter, system-ui fallback)
**Clinical Data Font:** JetBrains Mono Variable (with JetBrains Mono, ui-monospace fallback)
**Accent Serif:** Instrument Serif (with Georgia fallback) — editorial accent headings only

**Character:** One workhorse humanist sans (Inter) carries the entire interface — headings, nav, body, buttons, labels, prices. A single monospace (JetBrains Mono) is the clinical signal, and its scarcity is the point: the moment you see tabular figures, you know you are reading data, not copy. Instrument Serif appears rarely, as an editorial accent. All three are self-hosted via `@fontsource` with `font-display: swap`; no external font CDNs.

### Hierarchy
- **Display** (Inter 700, `clamp(1.75rem, 1.2rem + 2.4vw, 2.75rem)`, line-height 1.2, `-0.02em`): Page and hero headings. Ceiling stays modest — this is a clinical product, not a poster.
- **Title** (Inter 600, 16px, line-height 1.25): Card titles, dish names, section headers.
- **Body** (Inter 400, 16px min on mobile, line-height 1.5): All prose. Reading measure 60–75ch for long-form.
- **Label** (Inter 600, 11px, `0.06em`, often uppercase): Chip text, eyebrows, meta.
- **Data** (JetBrains Mono 500, ~13px, line-height 1.4, `tabular-nums`): Every macro, calorie, price, order ID, and clinical metric.

### Named Rules
**The Mono-Is-Data Rule.** JetBrains Mono is forbidden for headings, body, navigation, and marketing copy. It appears only on numbers and codes. Diluting it dilutes the clinical signal.

**The Tabular Rule.** Every price and every numeric column uses `font-variant-numeric: tabular-nums` (via `.tnm-data`, `.mono`, `.price`). Figures must not jitter as they change.

**The No-Third-Family Rule.** Inter, JetBrains Mono, Instrument Serif. A serif display for body or UI was evaluated and rejected; do not reintroduce one.

## 4. Elevation

Elevation is tonal first, shadow second — appropriate to a dark canvas where drop shadows are nearly invisible on near-black. Depth is carried by the surface step (`bg #131313` → `surface #1f1f1f` → `raised #2a2a2a`) plus a hairline border at low-alpha white (`rgba(255,255,255,0.06)` / `0.12`, the `.tnm2 --ln` / `--ln2` tokens). Shadows are reserved for genuinely floating surfaces (sheets, overlays, the saffron add-button) and are soft and layered, never a hard 1px-border-plus-heavy-shadow "ghost card."

### Shadow Vocabulary
- **Raised** (`0 1px 2px rgba(0,0,0,.35), 0 4px 8px rgba(0,0,0,.22)`, `--shadow-raised`): Cards that lift on hover.
- **Overlay** (`0 2px 4px rgba(0,0,0,.4), 0 8px 14px rgba(0,0,0,.32)`, `--shadow-overlay`): Popovers, dropdowns.
- **Sheet** (`0 -6px 14px rgba(0,0,0,.4)`, `--shadow-sheet`): Bottom sheets rising from the edge.
- **Saffron glow** (`0 4px 16px color-mix(saffron 32%)`): The floating add-button only — the one place a colored glow is earned.

### Named Rules
**The Tonal-First Rule.** On dark, hierarchy is the surface step and the hairline, not the shadow. Never rely on a drop shadow alone to separate a card from the canvas.

## 5. Components

The live component vocabulary is the `.tnm2` class layer. Radii: input 11px, button 12px, card 16px, sheet 24px, pill 999px. One radius per component — never mixed within a card.

### Buttons
- **Shape:** 12px radius (`--radius-btn`); full-pill (999px) for chips and small tags.
- **Primary** (`.btn-p`): Saffron fill (a subtle `#FFD75A → #fbbf24` vertical gradient), dark-ink label (`#402d00`), 44px tall. Exactly one per screen or section.
- **Ghost / Secondary** (`.btn-g`): Surface fill, primary-text label, hairline border.
- **Floating Add** (`.addb`): A saffron pill anchored to a dish image's bottom edge; the one element carrying a saffron glow. Swaps in place to the quantity stepper (`.stepb`, sage count) once the item is in the cart — no navigation.
- **States:** Every button ships default, hover, `:focus-visible`, `:active` (a `scale(.96)` compression), disabled, and loading. A disabled button that gates on missing input must state what is missing.

### Chips
- **Style** (`.chip`): Fully-rounded glass pill — `color-mix(#fff 5%)` fill, hairline border, muted-secondary text, 34px tall, 8px backdrop blur.
- **Selected** (`.chip.on`): Saffron-tinted fill (`--safd`), saffron border and text. Used for active filters, quick-filters, and the category scroll-spy rail (`.catspy`), where the active pill also carries `aria-current="location"`.

### Cards
- **Corner:** 16px (`--radius-card`).
- **Background:** Surface `#1f1f1f` on the `#131313` canvas; hairline border, no heavy shadow at rest.
- **Dish card** (`.dcard`): The signature commerce card — fixed-aspect dish image, FSSAI mark, veg/GI tags, dish name, one macro/price line, and a floating add-button. Detailed macros, allergens, and clinical context live on the dish page (progressive disclosure).

### Inputs
- **Style** (`.inp` / `.selchip`): Surface fill, 11px radius, muted placeholder (never a placeholder-as-label). Native `<select>` is themed as a chip (`appearance: none` + a Phosphor caret) so it keeps the mobile wheel picker while matching the chip language.
- **Focus:** A 2px saffron `:focus-visible` ring at 2px offset, scoped to `.tnm2` controls. On a saffron or cyan fill the ring switches to off-white so it stays visible.

### Navigation
- **Global chrome:** desktop `Header`, mobile `BottomNav`, grouped Eat / Plan / Track / Community / Account. Sticky clusters (the menu header, `--z-sticky: 30`) pin so re-filtering never scrolls the user back to the top. A global ⌘K command palette registers every customer route.

### Signature Component — Macro Ribbon
`.ribbon` renders a dish's macros as a compact JetBrains-Mono readout (KCAL · P · C · F) with tabular figures and stated units. When macros are provisional it reads "macros being verified" at the same height — no layout shift, no false precision.

### Named Rules
**The In-Place Rule.** Variant, protein, and quantity changes swap in place under 100ms with zero navigation. A full page reload on a variant change is a defect.

## 6. Do's and Don'ts

### Do:
- **Do** source every color from a token and run `lint:colors`; a raw hex, rgb(), or arbitrary Tailwind color in `src` is a blocking defect (only `index.css` and `theme.css` are exempt).
- **Do** use saffron `#fbbf24` (`--color-nn-primary` / `--action`) as the single primary action, exactly one per screen (§2.3 of the product contract).
- **Do** render every macro, calorie, price, and code in JetBrains Mono with `tabular-nums` and stated units (g, kcal).
- **Do** give every interactive `.tnm2` control the 2px saffron `:focus-visible` ring — a missing ring is a known past defect, treated as equal to a lint failure.
- **Do** carry the FSSAI veg/non-veg marks (≥14px) on every dish card, dish page, cart line, and order line, and keep allergens always-visible on the dish page.
- **Do** trace every money figure to a server quote and format with `Intl.NumberFormat('en-IN')`; the client displays, it never computes.
- **Do** reserve final dimensions on every image, card, and skeleton (CLS ≤ 0.05); the shell renders first — no route paints blank.

### Don't:
- **Don't** use legacy gold `#D4AF37` or legacy blue `#6BA3C8`. They are retired and absent; saffron and cyan are the only brand accents.
- **Don't** hardcode the Clinical-Dark canvas (`#0b0c0e`) or bone text (`#f2f0e9`) on a live `.tnm2` surface — those use `--color-nn-bg` (`#131313`) and `--color-nn-on-surface` (`#e2e2e2`). Two layers, one accent.
- **Don't** use cyan `#34daff` as a CTA or a decorative glow; it is a tertiary data highlight only.
- **Don't** use sage as an unrestricted decorative green; it means "verified / healthy / approved."
- **Don't** set JetBrains Mono on headings, body, navigation, or marketing text; its scarcity is the clinical signal.
- **Don't** render false macro precision ("23.47g protein") — whole numbers only, honest to kitchen variance.
- **Don't** hide allergen or FSSAI information behind hover, accordion, or tap; safety is exempt from progressive disclosure.
- **Don't** render silent hardcoded fallback data on a failed fetch; show honest error microcopy ("We can't load the menu right now. Retry.").
- **Don't** reach for a modal as the first thought, a display font in a UI label, or a serif for body/headings — the product register is earned familiarity, not flavor.
- **Don't** ship the AI tells: no colored side-stripe borders, no gradient text, no ghost card (1px border + heavy shadow), no over-rounded cards (>16px), no decorative eyebrow above every section.
