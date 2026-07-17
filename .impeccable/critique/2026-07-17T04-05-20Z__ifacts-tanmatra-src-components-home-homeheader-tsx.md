---
target: home header + hero (Zomato-style redesign)
total_score: 25
p0_count: 2
p1_count: 2
timestamp: 2026-07-17T04-05-20Z
slug: ifacts-tanmatra-src-components-home-homeheader-tsx
---
# Critique — Home Header + Hero (Zomato-style redesign)

Method: dual-agent (A: design review · B: detector/browser evidence). Target: `artifacts/tanmatra/src/components/home/HomeHeader.tsx` + `HomeHero.tsx`, live at `/` (390×844 + 1280×800, chromium).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Avatar shows logged-in gold for anonymous users; flickers grey→gold mid-load |
| 2 | Match System / Real World | 3 | "Clinical Nutrition Engine", "Healthy Mode" — internal jargon on first screen |
| 3 | User Control and Freedom | 3 | City sheet dismissible + Esc works; its default close target is 16×16px |
| 4 | Consistency and Standards | 2 | Three conflicting nav vocabularies (header / dock / docs); trust tiles look identical to program buttons; **every button's Tailwind bg/border/color/font utilities are stripped by an unlayered CSS reset** |
| 5 | Error Prevention | 3 | Pincode disclaimer sets expectations; auth flicker undermines it |
| 6 | Recognition Rather Than Recall | 2 | No logo/wordmark anywhere in header — brand only inside hamburger sheet |
| 7 | Flexibility and Efficiency | 3 | Search-first entry + concrete rotating hints; but search tap dumps intent |
| 8 | Aesthetic and Minimalist Design | 2 | Hero: double-bezel glass shell, two look-alike 2×2 grids, food at 7% opacity |
| 9 | Error Recovery | 2 | Network/500 on preferences silently renders false logged-in state |
| 10 | Help and Documentation | 3 | City-sheet serviceability microcopy is exactly right |
| **Total** | | **25/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** Borderline — a designer clocks it in ~10s, not instantly. Header is Zomato-literate and restrained. The hero is where tells cluster: tiny uppercase 0.2em-tracked eyebrow badge ("CLINICAL NUTRITION ENGINE" + Sparkle), gradient-clipped headline span, glassmorphic card-in-card-in-card shell, two consecutive visually identical 2×2 icon-chip grids, center-stacked badge→image→headline→CTAs→grid template. Most damning for a food product: the food itself is one 144px medallion + a 7%-opacity blurred wash — the hero of a meal service contains almost no appetizing food.

**Deterministic scan:** exit 2, 1 finding — `gradient-text` at `HomeHero.tsx:77` (`bg-clip-text` + gradient on "engineered for you."). True positive; matches the absolute-ban list. No false positives.

**Visual overlays:** not injected — evidence was gathered via screenshots, computed styles, and pixel-sampled contrast instead (fallback signal; no live-server overlay run).

## Overall Impression

The header is genuinely competent — measured 44px targets on all five controls, honest aria-labels, working reduced-motion guard, stable 121px height through the scroll transition. But the fold has two show-stoppers the eye alone half-misses: the CSS cascade is eating the styling off every button (the primary CTA renders as a dark ghost instead of amber-on-black), and the avatar lies about auth state. The single biggest opportunity: let food carry the hero and collapse the ornament.

## What's Working

1. **HomeHeader execution.** All five controls exactly 44px, truthful aria-labels ("Cart, 0 items", "Search dishes — opens the menu"), localStorage try/catch, glass-on-scroll verified (rgba 0.92 + blur 24px), zero horizontal overflow at 390px and 320px, reduced-motion guard verified working under emulation.
2. **City sheet content design.** Selected-state check, 48px rows, "Exact serviceability is confirmed at checkout by pincode" — right expectation at the right moment.
3. **Conversion-literate search hints.** '"high-protein bowl"', '"diabetic-friendly dinner"' teach the catalog's vocabulary instead of generic placeholder text. All measured contrast passes WCAG AA (11 nodes checked, worst 5.34:1).

## Priority Issues

**[P0] Unlayered CSS reset strips Tailwind utilities from every button in the `.tnm2` scope.**
- Why: `theme.css:13` `:where(.tnm2 button){…background:none;border:none;color:inherit;font:inherit…}` is imported unlayered in `root.tsx:26`, so it beats Tailwind v4's `@layer utilities` regardless of `:where()` zero specificity. Browser-verified: the hero primary CTA declares `bg-[var(--tnm-action)] text-black font-bold text-sm` but computes transparent bg, grey text, 400/16px; the header search "field" loses its surface and border entirely; secondary CTA, program chips, and city selector all affected. The same class string on a fresh div renders correctly — the rules exist, they lose the cascade on buttons.
- Fix: wrap the theme.css reset in a layer that loses to utilities (e.g. `@layer base`), or import theme.css into Tailwind's layer order. One-line root cause; verify every `.tnm2` surface after.

**[P0] False logged-in avatar for anonymous/errored sessions.**
- Why: `HomeHeader.tsx:39` derives `isLoggedIn = !unauthorized && !loading`, and the preferences context only sets `unauthorized` on a literal 401 — network failure or 500 renders a gold "Your account" avatar for a user with no account, flickering grey→gold mid-load. A lying identity signal on the first screen of the funnel.
- Fix: derive auth from an explicit session signal; treat unknown/loading as logged-out.

**[P1] Search tap discards search intent.**
- The highest-intent element navigates to `/menu` with search closed — user meets skeletons and a quiz banner, then must find search again. Fix: `/menu?search=1` opening the input focused, seeded with the visible hint.

**[P1] Program chips advertise conditions but all open the same generic quiz.**
- `HomeHero.tsx:20-25` defines per-chip `planSlug` ("pcos-balance"…) that `onClick` ignores — "PCOS Care" opens the same intake as "Weight Loss" at a medically sensitive moment. Fix: route to `/plans/:planSlug` or pre-seed the quiz.

**[P2] Hero suppresses the product; ornament fills the space.**
- Food at 7% opacity + one 144px medallion; nested bezels shrink the content column to ~274px at 390px, wrapping the H1 to three lines with a widow ("you."). Plus the detector-confirmed gradient text. Fix: one appetizing photograph at readable brightness carries the hero; delete the outer bezel; solid headline color; two-line cap at 390px.

**[P2] Bottom dock renders on desktop and collides with the fold.**
- Full-width translucent dock at 1280px hides half the hero CTAs; on mobile ghost text bleeds through; its IA (Home/My Plans/Track Data/Healthy Mode) contradicts both the hamburger and the documented Eat/Plan/Track/Community/Account grouping. Fix: hide ≥md; reconcile nav vocabularies.

**[P2] React hydration mismatch on load (console error).**
- Client-only state (localStorage city, rotating hint index) diverges from SSR output in `HomeHeader.tsx:45-55`. Fix: defer client-only values to a post-mount effect.

## Persona Red Flags

**Casey (one-thumb mobile):** all five header controls in the top 108px — hardest reach zone; the thumb-zone dock has no order-starting action; search tap → /menu with keyboard closed → second hunt; "Help Me Choose" sits 75px above the dock, fat-finger risk onto "My Plans" which bounces logged-out users to login.

**Jordan (first-timer):** no brand name/logo on the first screen — can't tell what site this is without opening the hamburger; gold avatar implies an account they never made; "PCOS Care" tap → generic 5-question quiz; three near-synonymous groupings ("Clinical Health Programs" chips, "Recommended programs" rail, "My Plans" dock) within two screens.

**Sam (screen reader/keyboard):** no skip link — 6 Tabs to reach "Browse Menu"; no designed `:focus-visible` on any header/hero control (UA default only, on near-black); two `<h1>`s (sr-only + visible); trust tiles are static divs visually identical to focusable program chips. Positives: honest aria-labels, hint rotation not live-announced, reduced-motion respected.

## Cognitive Load

4 of 8 checklist failures: single focus (four competing zones in one shell), one-decision-at-a-time and ≤4-options (the "start ordering" decision has 7–11 visible options on the mobile fold), progressive disclosure (programs + trust disclosed before the first choice). Chunking/grouping/hierarchy/working-memory pass.

## Minor Observations

- City-sheet default close button 16×16px; sheet disclaimer 11px white/40 ≈ 3.9:1 (fails AA for that size).
- Header tagline truncates mid-word at 390px ("delivered fre…", `HomeHeader.tsx:120`).
- Header `z-[800]` sits above the sheet scrim — header stays bright while the sheet is open (layering glitch).
- Duplicate close buttons in hamburger sheet (`SheetClose` + shadcn built-in); cart badge clips at 3 digits (cap "99+"); `ShoppingBag` vs `ShoppingCart` icon split; hint interval runs on hidden tabs; logged-out hamburger links to auth-walled `/meal-planner`; no delivery ETA anywhere in the fold; `--tnm-action` is #F4C430 at :root but #fbbf24 inside `.tnm2` (token drift); `<html class="light">` on a dark page.
- Hero images lack width/height attrs but space is CSS-reserved — no CLS risk. No failed network requests; hero JPG loads (788×760).

## Questions to Consider

1. If the food photography were at full brightness, would the page still need the words "Healthy meals"? The hero argues with typography because the imagery isn't allowed to.
2. Who is the fold for — the patient ("PCOS Care") or the biohacker ("Clinical Nutrition Engine")? The registers alternate line by line; neither persona gets a complete sentence.
3. Why does a 3-city product open with a city *selector* instead of a delivery *promise*? "Delivering to Noida in 25–40 min" does more work in the same pixels.
