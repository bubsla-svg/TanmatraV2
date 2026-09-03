# Design reference — delivered storefront revision (Replit build, 2026-09)

Visual and composition reference for `docs/MOBILE-FIRST-CX-BRIEF.md`. **Design only.** Nothing here is product truth: routes, data, prices, ratings, copy and flows in these files are mock and are not to be ported. The production counterpart for every file is listed in the brief's "Delivered reference implementation → production counterpart" table.

## Provenance

- Source: `Tanmatra-UX-refresh.zip` (owner export of the Replit workspace, 2026-09-03), artifact `artifacts/tanmatra-storefront` — a standalone Vite 7 + React 19 + Tailwind v4 + wouter app, **not** a fork of `artifacts/storefront`. The workspace was cut from a 2026-07-28 base and never contained the Next.js storefront.
- Exported here: the six hand-written files (`src/index.css`, `src/App.tsx`, `src/components/storefront-shell.tsx`, `src/components/dish-card.tsx`, `src/hooks/use-storefront.tsx`, `src/lib/catalog.ts`, `src/pages/storefront-pages.tsx`) and `package.reference.json`. The 55 files under `src/components/ui/*` are stock shadcn/ui and are not copied. `artifacts/mockup-sandbox` in the export is Replit's empty preview canvas and carries no design.
- No Replit skills (`.local/skills/*`) exist in the export; they are platform-side. The brief's skills column already points at this repo's `agent-skills/skills/*` and `.claude/skills/*`.
- These files are excluded from every tsconfig and lint gate by location; the knowledge-graph extractor indexes them as leaf modules with no edges into `artifacts/storefront`.

## Token extraction (from `src/index.css`)

Values are HSL triplets as written in the source; production consumes them through `lib/themes/tanmatra.css` `light-dark()` tokens (brief, Foundations 0).

| Token | Light | Dark | Role in the revision |
|---|---|---|---|
| `--background` | `38 42% 94%` | `164 25% 12%` | page surface (warm cream / deep green) |
| `--foreground` | `164 25% 17%` | `38 42% 94%` | body ink |
| `--card` / `--card-border` | `40 45% 97%` / `35 25% 84%` | `164 22% 16%` / `164 16% 25%` | cards, bottom tab bar |
| `--primary` / `--primary-foreground` | `164 33% 27%` / `38 42% 94%` | `31 61% 53%` / `164 25% 12%` | primary buttons, ticker, footer, active tab, cart toast |
| `--secondary` | `37 29% 87%` | `164 16% 25%` | hero wash, mobile-nav chips, hover fills |
| `--muted` / `--muted-foreground` | `37 29% 89%` / `164 10% 43%` | `164 16% 21%` / `38 16% 73%` | secondary text, inactive tabs |
| `--accent` / `--accent-foreground` | `31 61% 53%` / `38 42% 94%` | `31 61% 53%` / `164 25% 12%` | amber: hover state of primary CTA, badge counts, nav underline, star, outline colour |
| `--destructive` | `7 58% 46%` | `7 58% 52%` | — |
| `--sage` / `--sage-ink` / `--sage-deep` | `88 25% 82%` / `94 24% 20%` / `93 20% 34%` | `91 20% 29%` / `88 32% 91%` / `88 25% 72%` | "clinical signal" chips: Fresh today, dish badges |
| `--border` / `--input` / `--ring` | `35 25% 82%` / same / `164 33% 31%` | `164 16% 25%` / same / `31 61% 53%` | hairlines, focus ring |
| `--radius` | `1rem` (sm −4px, md −2px, lg 1rem, xl +4px) | | cards `rounded-2xl`, pills `rounded-full`, tab bar `rounded-2xl` |
| `--shadow-soft` / `--shadow-lift` | `0 18px 50px rgba(39,55,45,.08)` / `0 18px 34px rgba(39,55,45,.14)` | | card hover, tab bar, toast |
| Type | `DM Sans` 400–700 (sans/body), `Fraunces` 500–700 opsz 9..144 (`.font-display`), `Space Mono` 400/700 (`.font-data`, prices) | | Google Fonts `@import` |
| Motion | `rise-in` .65s cubic-bezier(.2,.7,.2,1) with `.stagger-1…4` (70 ms steps); `float-soft` 5 s; `prefers-reduced-motion` collapses all to .01 ms | | |
| Texture | `.grain::after` — fixed, z-60, 3.5 % SVG fractal-noise overlay | | |
| Scale | header 76 px; max-width 1240; section padding `py-20 sm:py-28`; card art `aspect-[1.12]`; card title 22 px / 1.1; mobile tab bar `h-16` inset 12 px, tabs 48 × 64 | | |

## Contrast audit (WCAG, computed from the values above)

| Pair (light) | Ratio | Verdict |
|---|---:|---|
| foreground on background / card | 11.4 / 12.1 | pass |
| primary on background; primary-foreground on primary (**the primary CTA**) | 6.82 | pass |
| sage-ink on sage (chips) | 7.91 | pass |
| sage-deep on background | 5.42 | pass |
| primary-foreground on destructive | 4.83 | pass |
| muted-foreground on background / card (`text-sm` descriptions, inactive tabs) | 4.17 / 4.43 | **fails 4.5 body text**; passes at ≥ 18 px/14 px bold only |
| accent-foreground on accent (CTA hover fill, badge counts) | 2.54 | **fails** |
| accent as text on background / card (`text-accent` star row, `text-accent` footer labels) | 2.54 / 2.70 | **fails** |
| border on background (hairlines) | 1.32 | below 3:1 for UI boundaries; the revision relies on shadow/fill, not lines |

Dark mode passes every text pair (lowest 4.75, accent on card); `primary-foreground on destructive` is 3.52 (large-only); borders 1.65.

**Consequence for the tokens PR** (brief, Foundations 0 — gate is ≥ 4.5:1 body, 3:1 large, primary button ≥ 4.5:1):

- The primary CTA is green-on-cream and passes; keep `--primary` as the button token. Do **not** make the amber `--accent` the button fill — that repeats the failure of the current gold (2.01:1).
- Where amber carries text or a filled control at light-mode weight, it needs `31 61% 37%` or darker (4.63:1 with cream text and as text on cream). At `53%` it is decorative only: underlines, icon fills, focus outline.
- `--muted-foreground` moves to `164 10% 41%` (4.51:1) or the dish-description size moves up; either satisfies the gate, the first keeps the composition.
- Hairline borders stay decorative; component boundaries that must be perceivable (inputs, quantity steppers, the tab bar) get shadow or fill as the revision does.

## Design → production: what the reference shows that the brief overrides

These are design-only observations; every one is already governed by a rule in the brief or a shipped behaviour in `artifacts/storefront`. Listed so the restyle does not carry them across.

| In the reference | Production rule that wins |
|---|---|
| Header actions and the Add / favourite buttons are `h-10`/`h-11` (40–44 px); Add is 40 px | 44 px minimum, 48 px on money-path controls (`.touch-target-min`) |
| Three type families (DM Sans, Fraunces, Space Mono) via Google Fonts `@import` | Two families through the existing `next/font` pipeline in `app/layout.tsx` (which already loads a mono face); the `.font-data` role maps onto it rather than adding a third download |
| Bottom tab bar: Home · Menu · Plans · Bag, always visible, `/cart` is a route | `components/MobileBottomNav.tsx` tab set and scroll hide/reveal stay; cart is the Vaul drawer, `/cart` is a recorded non-route |
| Mobile header opens a 3-chip grid nav on hamburger | `HeaderShell` / `Header` location trigger stays visible (Law 1); no hamburger nav is added |
| `DishCard`: no macros, hard-coded `4.8 ★`, `dish-art` CSS placeholder plate, "Fresh today" chip on every card, "/ serving" price suffix | Macros row on every card (Law 8); ratings only from `GET /dish-reviews/{slug}`; photos via `components/ui/SafeImage.tsx`; badges only from the catalog response; price suffix from the server quote |
| Ticker "NOW SERVING NOIDA · NEXT-DAY DELIVERY ON ORDERS BEFORE 8 PM"; footer "Delivery across Noida", "hello@tanmatra.in", "© 2024" | Service area, cutoff, contact and legal copy come from the shipped components and `lib/heroCampaign.ts`; none of this copy is ported |
| `.grain` fixed noise overlay at z-60 above everything | Allowed as a token if it clears the contrast gate on every pair it sits over and `lint:tokens`; it must sit below sheets, toasts and the Razorpay canvas (Law 2) |
| Theme persisted in `localStorage('tanmatra-theme')` with a header sun/moon toggle | The existing theme toggle and `theme-toggle.spec.ts` keep working; storage key unchanged |
| Hover-driven affordances (`hover:-translate-y-1`, underline-on-hover nav) | Pressed state within the same tap; nothing depends on hover |
| Routes `/`, `/menu`, `/dish/:slug`, `/plans`, `/about`, `/cart` only | The full screen map in the brief; the reference has no checkout, account, onboarding or trust screens — those are restyled from the tokens and the card/section grammar, with no 393 px render to pixel-match against |

## Pixel-match scope

The reference was recorded at desktop width and has no mobile renders. Screens with a reference composition: home, menu, dish detail, plans, about. Everything else pixel-matches nothing and is graded on tokens, spacing rhythm, type scale and the ten-laws table only. Record this in the divergence ledger (`docs/pixel-pipeline.md` S6) rather than inventing a target.
