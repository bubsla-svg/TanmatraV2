# Tanmatra Frontend — UX/UI Audit

**Benchmark:** Uber Eats (order-in-3-taps habit loop, nothing blanks / nothing jumps, every touch answers, native-app feel).
**Scope:** `artifacts/tanmatra` — live customer money path + chrome + secondary surfaces. Date: 2026-07-21.
**Method:** direct code inspection + grep quantification across 277 `.tsx` files.

---

## Verdict

This is **not** a broken or generic frontend — the craft is real (premium dark system, tabular-nums clinical data, 44px tap targets, spring press states, CLS-reserved skeletons, branded 404, zero `window.alert`, zero dead links). It does **not** need a rewrite.

The gap to Uber Eats is four concrete things, in priority order: **(1) money-path keyboard/focus accessibility is broken, (2) the app runs two parallel design systems that drift, (3) mobile viewport uses `100vh` (iOS jump), (4) loading/error-state coverage is thin.** All are fixable in place.

## Scorecard vs Uber Eats

| Surface | Grade | Note |
|---|---|---|
| Design tokens & discipline | A− | 4 raw hex total; tabular-nums everywhere; motion tokens mirrored JS/CSS |
| Core primitives (Button, BottomNav) | A− | focus rings, 44px coarse targets, active indicators, spring press |
| Money-path screens (`tnm2`) visual craft | B+ | premium, pixel-tuned — but its own separate system |
| Money-path **accessibility** | **D** | no focus rings on inputs/buttons; keyboard users stranded at checkout |
| System consistency | C | two design systems + three icon libraries |
| Mobile robustness | C+ | `100vh` (111×) vs `dvh` (12×); bottom-stack offsets *are* coordinated (good) |
| Loading / empty / error states | B− | App family (Orders*/Rewards/Marketplace/Wellness) is state-complete; gaps are specific: Orders loading/error, Appointments swallows errors, partner landings |
| Content polish | B− | Title Case headers pervasive; a few AI cliches |

---

## CRITICAL

### C2 — Fabricated pricing & menu items on partner landing pages (honesty-rule violation)
`SubscriptionPlansLanding.tsx:413,502` invent strikethrough "was" prices (`perDelivery + 50`, `perDayPrice * 1.2`) to fake a discount — a dark-pattern fake MRP. `:469` renders fabricated fallback dishes ("Signature Bowl", "Clinical RD Super salad") with magic macros (`|| 450`, `|| 25`). `GymsLanding.tsx:122` states "70% of results come from nutrition" as unsourced fact.
- This directly violates the app's own no-fabricated-numbers honesty rule (which the rest of the app respects).
- **Fix (S, mostly deletion):** remove invented strikethroughs; guard the carousel to real catalog dishes only; delete/attribute the stat.

### C3 — Literal stock photos on partner heroes (the #1 "generic AI site" tell)
`GymsLanding.tsx:152`, `MorningFitnessLanding.tsx:141` ship `images.unsplash.com/...` hero photos with generic alt and no dimensions.
- **Uber Eats gap:** never ships stock photography; this instantly breaks the one-system feel and causes CLS.
- **Fix (S):** swap for real kitchen/dish imagery (as the app uses) or the clean landing family's photo-free hero; add explicit dims.

### C1 — Money-path controls have no keyboard focus ring
The live money path (Menu, Dish, Cart, Checkout, Subscribe — 58 `.tnm2` files) is styled by `tanmatra-v2/theme.css`, which has **0 `:focus-visible` rules in 444 lines**, and `theme.css:19` sets `.tnm2 input { outline:none }` with no replacement. So `.btn` (`:70`), `.chip` (`:82`), `.opt` (`:147`), `.inp input` (`:171`), the custom switch `.sw` (`:156`) and all icon buttons show **nothing** on keyboard focus.
- **Uber Eats gap:** every control has a visible focus state; theirs is keyboard- and screen-reader-complete on the pay flow. Ours fails WCAG 2.4.7 on the checkout/OTP/address inputs specifically.
- **Fix (S, additive, zero visual risk in mouse use):** one block in `theme.css`:
  ```css
  .tnm2 :is(button,a,input,.chip,.opt,.iconbtn,.qbtn,.sw):focus-visible{
    outline:2px solid var(--saf); outline-offset:2px; border-radius:8px;
  }
  ```

---

## HIGH

### H1 — Two parallel design systems that drift
Chrome + admin + `components/ui/*` = **Tailwind v4 + shadcn/Radix + Phosphor-React + Framer Motion**. The money-path screens = **`.tnm2` vanilla CSS** (`theme.css`) + Phosphor **icon-font**. They have *separate* buttons, inputs, cards, skeletons, switches. `Menu.tsx` = 35 `.tnm2` classes vs 19 Tailwind. Any design change must be made twice and silently drifts.
- **Uber Eats gap:** one system, edge-to-edge consistency.
- **Fix (M, no rewrite):** declare `.tnm2` the money-path canon and Tailwind/shadcn the chrome/admin canon; document the boundary in `CLAUDE.md`; the tokens are *already* unified (`theme.css:29` rebinds `.tnm2` vars to NN tokens). Converge components opportunistically, not in a big-bang.

### H2 — Three icon systems shipping at once
Phosphor-React (34 files), **Lucide (66 files)**, Phosphor icon-font (599 `<i className="ph-…">`). Bundle bloat + inconsistent stroke weights. `CLAUDE.md` says Phosphor for new customer surfaces, but Lucide dominates.
- **Fix (M):** money path stays on icon-font; migrate new customer surfaces Lucide→Phosphor-React; retire Lucide from customer routes (keep only in legacy admin if needed).

### H3 — `100vh` on a mobile-first app
`100vh`/`h-screen`/`min-h-screen` appears **111×**; `dvh` only **12×**. `theme.css:40` `.stage`, `not-found.tsx:18`, etc. On iOS Safari the address bar makes `100vh` overshoot → content clips / bottom CTA hides.
- **Uber Eats gap:** rock-solid full-height on mobile.
- **Fix (S–M):** sweep `100vh`→`100dvh`, `min-h-screen`→`min-h-dvh`, `h-screen`→`h-dvh`.

### H4 — Loading/error coverage is thin
`Skeleton` used 14× but `isLoading/isPending` 71× → most loads spin or blank. `isError` only 15× → many fetches are silent on failure. The `.tnm2 .skel` shimmer (`theme.css:95`) exists but is underused.
- **Uber Eats gap:** nothing ever blanks; failures are explicit and recoverable.
- **Fix (M):** add skeletons + inline error states to the top data routes first — Orders, Track, Rewards, Marketplace, RdDirectory, Appointments.

---

## MEDIUM

### M1 — Title Case headers everywhere
`Razorpay Secure Checkout`, `The Fuel Menu`, `Select Your Program`, `Confirm Medical Safety Profile`, `First Delivery Date`… Modern apps (and the redesign rulebook) use sentence case. **Fix (S):** sentence-case headings.

### M2 — AI cliches in copy
"seamless" ×3 (`LocationPickerFlow.tsx:952`, `GymsLanding.tsx:167`, `SubscriptionBridge.tsx:231`), "elevate" (`Corporate.tsx:80`). **Fix (S):** plain, specific copy.

### M3 — Icon-only-button label coverage uneven
Header/BottomNav label their icon buttons well (`aria-label`, `aria-hidden` on glyphs). The `.tnm2` appbar back/search/cart (`Menu.tsx:536–546`) and `.iconbtn`/`.qbtn`/`.glass` need the same sweep — icon-font `<i>` must be `aria-hidden`, the button must carry `aria-label`. **Fix (S–M):** audit + label.

---

## Foundations deep-dive (tokens, type, primitives, z-index)

Verified against `index.css`, `tanmatra-v2/theme.css`, `components/ui/*`, `layout/*`, `root.tsx`. Several are **invisible, zero-risk bugs** — the highest-ROI class of fix.

| Sev | Finding | Evidence | Fix |
|---|---|---|---|
| **HIGH** | Button/Badge **border tokens are undefined** in this app — `--primary-border`, `--button-outline`, `--secondary-border`, `--destructive-border`, `--badge-outline` exist only in `mockup-sandbox`/`agents`, so outline/secondary/default borders silently resolve to `currentColor` instead of the intended hairline | `ui/button.tsx:15,22,25`, `ui/badge.tsx:24` (undefined in `index.css`) | Copy the 6 `-border` token lines from `mockup-sandbox/src/index.css` into `index.css` `:root`/`.dark`. Pure addition. |
| **HIGH** | The **display serif and clinical mono are never loaded** — `--font-serif:'Instrument Serif'` renders as **Georgia**, `--font-mono:'JetBrains Mono'` renders as **system mono**, everywhere (dish titles, sheet titles, every price/macro). Only Inter is imported. | `root.tsx:28,38`, `index.css:234,236` | Add `@fontsource/instrument-serif` + `@fontsource-variable/jetbrains-mono`; preload the serif (mirror the Inter preload). Tokens already point at them. |
| **HIGH** | Primary amber is **three different colors** that shift with OS theme — nav pill `#fbbf24`, BottomNav active tab `--tnm-action`→`#E9A847`, shadcn `--primary hsl(36 78% 60%)`. Desktop Header active pill and mobile BottomNav active tab **don't match**. Root cause: `defaultTheme="light"` + `enableSystem` on a dark-only app. | `Header.tsx:70`, `BottomNav.tsx:345`, `index.css:19,60,84`, `root.tsx:304` | Alias `--action`/`--tnm-action`/`--primary` → `--color-nn-primary`; set `defaultTheme="dark"`. Token-only. |
| **HIGH** | Z-index scale (`--z-base…--z-tooltip`) is defined but **used almost nowhere** — live code uses `z-[900]`, `z-[800]`, `9999`, inline `70/71`. `StickyBottomBar z-[900]` sits **above** CartDrawer's panel (`zIndex:71`) → real stacking collision. | `index.css:272` (defined), `StickyBottomBar.tsx:113`, `CartDrawer.tsx:238` | Replace raw values with `var(--z-*)`; give the sticky bar a layer below cart/modal. Mechanical. |
| MED | No shared **quantity stepper** — MenuCard's is `w-8 h-8` (32px, under 44px, no coarse bump); CartDrawer's `.qbtn` is a separate 44px Lucide version. Two looks, one under-target, on the most-tapped control. | `menu/MenuCard.tsx:271`, `theme.css:79` | Extract one `<QuantityStepper>` (44px, `press-spring`, tabular count); use in both. |
| MED | Stale retired **`#D4AF37` Clinical gold** still ships in the glow keyframe and the "canonical" focus-ring utility → off-brand | `index.css:290,446` (`rgba(212,175,55,…)`) | Swap both to `color-mix(in srgb, var(--color-nn-primary) …)`. |
| MED | Base `Skeleton` is a generic `animate-pulse` block, not shaped to content — while `.tnm2` has a *nicer* shimmer (`.skel`) and hatch placeholder (`.plc`) that aren't shared | `ui/skeleton.tsx:9` vs `theme.css:95` | Promote the `.tnm2 .skel` shimmer into shared `Skeleton`; ship composed card-shaped skeletons. |
| LOW | Desktop Header nav links have **no `focus-visible` ring** (rely on UA default) while Button/Input do | `Header.tsx:65` | Add `focus-visible:ring-2 ring-[var(--color-nn-primary)]/50`. |

**Confirmed foundations strengths (Uber-Eats-grade, keep):** motion scale mirrored CSS↔JS with real spring physics + reduced-motion honored in 4 places; varied intentional radius ladder; thorough tabular-nums; Button/Input hover+active+focus+coarse-target stack; CartDrawer manual focus-trap + scroll-lock + undo-toast.

---

## Discovery funnel deep-dive (Home / Menu / Dish)

Verified against the live `tanmatra-v2` screens. This is where the Uber-Eats *habit loop* is won or lost, and it's the strongest ROI area.

| Sev | Finding | Evidence | Uber Eats gap | Fix |
|---|---|---|---|---|
| **HIGH** | Category/filter rail is **not sticky** — scans away, so re-filtering 100+ dishes means scrolling to top | `theme.css:85` `.chiprow` (only the 56px `.appbar` sticks) | UberEats pins the category rail; filters always one tap away | Wrap the `.chiprow`s in `position:sticky; top:56px` + same blur bg. Pure CSS. |
| **HIGH** | Quick-add has **no in-cart lifecycle** and **auto-opens the cart drawer** on every tap → breaks the "add many, keep scanning" loop | `Menu.tsx:314` (`handleQuickAdd`→`openCart()`), unused `.addb.in` `theme.css:110` | UberEats: tap → button morphs to −/qty/+ stepper *in place*, browsing uninterrupted | Port the stepper already written in dead `MenuCard.tsx:270`; apply `.addb.in`; drop `openCart()` from quick-add |
| **HIGH** | Menu page renders **no persistent "View cart" bar** — only the small top badge signals cart while scanning | `StickyBottomBar` mounted on Home (`Home.tsx:148`) but not `Menu.tsx` | The UberEats hallmark: persistent "View cart • N • ₹total" on the menu | Mount `<StickyBottomBar context="homepage" />` at end of `Menu.tsx` (ships together with killing the auto-drawer above) |
| **HIGH** | Homepage LCP hero: `loading="eager"` but **no** `fetchpriority`, **no** width/height, **no** AVIF/WebP srcset | `HomeHero.tsx:58` | UberEats first paint is priority-hinted, sized, next-gen | Add `fetchPriority="high"` + dims + `<picture>` (repo already has `localDishSrcset`/`unsplashSrcset` helpers) |
| MED | Combo card lists dishes as a joined string + adds all at once — **not** the spec's single card → `Dialog` of constituent dishes each linking `/dish/:slug` | `Menu.tsx:727` | UberEats meal-deal opens a detail sheet per item | Wrap in shadcn `Dialog`; render `included[]` as `<Link to="/dish/:slug">` rows; keep add as the CTA |
| MED | PDP **blurs base calories/protein** behind assessment completion — hides basic nutrition pre-assessment | `Dish.tsx:567,730` (`macrosUnlocked` gate) | UberEats shows nutrition freely | Show base calories/protein unblurred; gate only the *personalized target %* overlay |
| MED | "Chef's Pick" badge is stamped programmatically on the first RD-verified dish — fabricated merchandising, conflicts with the app's own honesty rule | `HomeFeaturedMeal.tsx:14,54` | — | Relabel to a truthful data-backed tag (e.g. "Dietitian-verified") or back it with a real flag |
| MED | Dead-code cluster: polished cards unused while plainer inline cards ship (confuses future work) | `menu/MenuCard.tsx`, `home/MetaDishCard.tsx`, `HeroCarousel.tsx`, `CategoryBadges.tsx`, `TrustHeader.tsx`, `dish/DishNutritionCard.tsx`, `WhyThisMealPanel.tsx`, `MacroOverlay.tsx` | — | Wire the better cards in (stepper, `MetaDishCard`) or delete |

**Confirmed strengths here (Uber-Eats-grade, keep):** in-place PDP variant swap with scroll preservation, no reload (`Dish.tsx:138`); menu image pipeline — AVIF/WebP `<picture>` + explicit 92×92 dims + `onError` fallback (`Menu.tsx:1259`); CLS discipline (reserved bundle skeleton, fixed-height rows); server-verified-only reviews; single-column sectioned list for fast scanning; PDP always-visible sticky add bar (`Dish.tsx:972`).

---

## Checkout & plan flow deep-dive (Cart / Checkout / Subscribe) — the 3-tap benchmark

The money path is **engineered far better than it is choreographed**: idempotency-keyed finalize, verify-before-confirm, UPI recovery poller, honest "nothing was charged" copy, real `MoneyPathErrorBoundary`, and a best-in-class segmented OTP. The gap to Uber Eats is entirely in the *tap economy at the pay stage*.

| Sev | Finding | Evidence | Uber Eats gap | Fix |
|---|---|---|---|---|
| **HIGH** | **~5 taps to pay.** Returning user with saved address: "Review & Pay" → a bespoke **Confirm Payment** dialog re-listing the total → "Confirm & Pay" → Razorpay modal → *then* pick UPI → pay. Two app-owned confirmations stacked before payment. | `Checkout.tsx:2486→2750→2862` | UberEats: one tap on a saved method pays | For returning users with address+slot, "Review & Pay" calls `handleConfirmedPayment` directly (skip the dialog); keep the dialog only for guests/first order. Removes 1 tap + 1 screen from **every** repeat order. |
| **HIGH** | **UPI never appears until the 3rd surface** — no native UPI-intent express; all method choice delegated to the generic Razorpay modal; the drawer's express-UPI button was removed; `prefill` sets only `contact`, no method priority | `Checkout.tsx:1367`, `CartDrawer.tsx:1029` | UberEats puts UPI/express as the top, first, one-tap option | Config-only: pass Razorpay UPI-intent config (`config.display` ordering / `method`) so UPI is first. Biggest India-habit-loop win, no refactor. |
| **HIGH** | The **charge-gate modals are hand-rolled** `position:fixed` overlays — no `role="dialog"`, no `aria-modal`, no focus trap, no Escape. The final pay gate is invisible to keyboard/SR users. | `Checkout.tsx:2549,2750`; `Subscriptions.tsx:703` | UberEats pay sheet is a proper focus-trapped dialog | Reuse the already-imported shadcn `Dialog` (`Checkout.tsx:22`) or copy CartDrawer's correct pattern (`CartDrawer.tsx:229`). |
| MED | The 3-step **stepper is decorative** — stepped flow shipped disabled (`mobileStep={null}`), so the progress bar gates nothing over a single-scroll form; `isSteppedContinue`/`handleMobileContinue` are dead | `Checkout.tsx:1747,1032,2543` | UberEats progress reflects real state | Wire the stepper or downgrade to a passive hint and delete the dead machinery (shrinks the 3178-line monolith). |
| MED | The **"total" means 4 different things** across surfaces — sticky bar = subtotal; drawer = subtotal+GST+delivery (no discount); cart page = grandTotal *with* first-order discount; checkout = razorpayTotal. First-order users see a discounted total on the cart page but not in the more-used drawer. | `StickyCheckoutBar.tsx:132`, `CartDrawer.tsx:1038`, `Cart.tsx:257`, `Checkout.tsx:2417` | UberEats keeps one stable running total | Unify the "total" semantic (or label each explicitly); reflect the discount in the drawer. |
| MED | **~180px of fixed bottom chrome on `/checkout`** — BottomNav stays visible + `V2MobilePayBar` + globally-mounted AI FABs (`z-50`); Support FAB can overlap "Review & Pay" | `Checkout.tsx:2968`, `SupportAgent.tsx:30`, `CoachAgent.tsx:217` | UberEats checkout is chrome-light; the pay CTA owns the bottom | Hide BottomNav + AI FABs on `/checkout` (StickyCheckoutBar already hides there). |
| MED | Subscribe **payment-failure banner has no `role="alert"`** — a failed subscription payment is silent to screen readers (Checkout does this right) | `Subscribe.tsx:1689` | — | Add `role="alert"`. One line. |

**Confirmed strengths (keep):** money-path resilience (re-entry guard, idempotency key pinned across retries, 12s abort, verify-before-confirm, UPI recovery poller, cancel-unpaid-on-failure); segmented guest OTP (WebOTP, numeric inputMode, paste distribution, per-box `aria-label`, `role="alert"`); CartDrawer (focus-trapped `role="dialog"`, `aria-live` steppers, ghost-item free-delivery projection, non-dead-end empty state); one-tap resume/reactivate in Subscriptions; calm honest copy (no "Oops!"/exclamation overload).

---

## Secondary surfaces — three families, one outlier

Secondary surfaces are **three internally-coherent systems wearing one palette**. (1) The **clean landing family** (`MetabolicLandingView`, `CareLandingView`, `CorporateWellnessView`) is a genuine system — shared `LandingTopBar`, eyebrow→h2→card rhythm, Phosphor, saffron CTAs, real billing prices. (2) The **app family** (`Orders`, `Rewards`, `Marketplace`, `Appointments`, `Wellness`, `Challenges`) is mature and **state-complete** (this is where the "states thin" grep signal is misleading — these surfaces have exemplary loading/error/empty/unauth coverage). (3) The **partner-landing family** (`SubscriptionPlansLanding`, `GymsLanding`, `MorningFitnessLanding`, `RdPartnersLanding`) is the outlier that fails the bar.

| Sev | Finding | Evidence | Fix |
|---|---|---|---|
| **HIGH** | Partner-landing family reintroduces a **whole second design language** — Lucide icons + `font-serif` heroes + shadcn `<Card>` + gradient blobs + 3-equal-column rows + a white CTA (vs saffron everywhere) | `SubscriptionPlansLanding.tsx:6,160,174`, `GymsLanding.tsx:8,121`, `RdPartnersLanding.tsx:6` | Swap Lucide→Phosphor, drop serif heroes, adopt the clean family's card idiom + saffron CTA |
| MED | `white/[0.08]` (a Tailwind class) pasted into **raw `<style>`/inline `style`** → invalid CSS, borders silently don't render (tab container, `<select>`, theme radios) | `Appointments.tsx:46`, `MarketplaceItem.tsx:291`, `Account.tsx:414` | Use `rgba(255,255,255,0.08)` / `var(--ln)` in raw-CSS contexts |
| MED | Hardcoded hex gradients assembled via string-concat (`"#" + "0a151b"`) to **evade the no-hardcoded-color lint gate** | `SubscriptionPlansLanding.tsx:164,189,204,219` | Move to `@theme` surface-gradient tokens |
| MED | Literal markdown asterisks render as visible `*` to users (`*Boiled Egg Plates*`) | `MorningFitnessLanding.tsx:180` | Remove or wrap in `<em>` |
| MED | `Orders` has a rich empty state but **no loading/error path**; `Appointments` swallows load errors (`/* ignore */`) so failure renders as "No messages yet. Say hi!" | `Orders.tsx:76`, `Appointments.tsx:569` | Add skeleton + error/retry to match the rest of the app family |

**Confirmed strengths (keep):** app-family state coverage is a genuine strength — `Rewards`, `Marketplace` (error+retry), `Wellness` (optimistic rollback), `Challenges`, `Appointments`, `StreakRings` are model surfaces; `LandingFaq` avoids the accordion cliché (always-open); clean family is honesty-forward with real billing prices and `aria-pressed`/`role="radiogroup"` a11y.

---

## Already good — do not spend time here
- **Primitives:** `button.tsx` (focus-visible ring, 44px coarse targets, hover-elevate/press-spring), `BottomNav.tsx` (`aria-current`, active bar, cart badge `aria-label`, safe-area padding).
- **Discipline:** only 4 raw hex in all TSX; `tabular-nums` 96×; motion tokens mirrored CSS↔JS (`lib/motion.ts`); `prefers-reduced-motion` honored (`theme.css:430`, 28 refs).
- **Robustness basics:** 0 `window.alert`, 0 `to/href="#"` dead links, branded helpful 404, CLS-reserved fixed-height placeholders in `.tnm2` (`.plc`, `.mscore`, `.preason`), coordinated bottom-stack offsets (`--bottom-nav-height`/`--bottom-cta-height`/`--safe-bottom`).
- **Honesty rules respected:** no fabricated ratings/bestseller tags.

---

## Fix roadmap (definitive, max ROI / low risk first)

### Tier 1 — same-day, near-zero-risk (do these first)
| # | Fix | Source | Why it's free |
|---|---|---|---|
| 1 | Define the missing `-border` tokens in `index.css` | Foundations | Un-breaks every outline/secondary/default Button+Badge border; pure addition |
| 2 | Add `.tnm2 :focus-visible` block | C1 | Restores keyboard focus on the entire money path; additive |
| 3 | Load `Instrument Serif` + `JetBrains Mono` | Foundations | Unlocks the intended display serif + clinical mono everywhere; no component edits |
| 4 | Delete fabricated prices/dishes/stat + Unsplash stock heroes | C2, C3 | Honesty-rule + brand; mostly deletion |
| 5 | `role="alert"` on Subscribe failure banner | Checkout | One line; SR parity with Checkout |
| 6 | Fix `white/[0.08]`-in-raw-CSS borders (3 sites) | Secondary | Restores silently-missing borders |
| 7 | Collapse amber to one token + `defaultTheme="dark"` | Foundations | Header pill and BottomNav tab finally match |
| 8 | Retire stale `#D4AF37` gold (2 sites) | Foundations | Off-brand glow + focus ring |
| 9 | Sentence-case headers + kill "seamless/elevate" cliches | M1, M2 | Copy only |

### Tier 2 — 1–2 days, low-risk, high UX payoff (the Uber-Eats habit loop)
| # | Fix | Source |
|---|---|---|
| 10 | **Skip the redundant "Confirm Payment" dialog for returning users** — removes a tap + a screen from every repeat order | Checkout |
| 11 | **UPI-first Razorpay config** (config-only) — surfaces one-tap UPI | Checkout |
| 12 | **Sticky filter rail + persistent Menu "View cart" bar + in-place add stepper + kill the auto-drawer** — restores the browse→add loop | Discovery |
| 13 | Hide BottomNav + AI FABs on `/checkout` | Checkout |
| 14 | `100vh`→`100dvh` sweep (111 sites) | H3 |
| 15 | Charge-gate modals → shadcn `Dialog` (focus-trap the pay gate) | Checkout |
| 16 | Adopt the `--z-*` scale; fix StickyBottomBar-over-CartDrawer collision | Foundations |

### Tier 3 — deliberate / structural
| # | Fix | Source |
|---|---|---|
| 17 | Unify the partner-landing family to the design system (Lucide→Phosphor, drop serif/stock/gradient) | Secondary |
| 18 | Unify the "total" semantic across cart surfaces | Checkout |
| 19 | Add loading/error states to the specific gaps (Orders; Appointments error-swallowing) | Secondary |
| 20 | Extract one shared `<QuantityStepper>` (44px) | Foundations |
| 21 | Document the two-system boundary in `CLAUDE.md`; retire Lucide from customer routes | H1, H2 |
| 22 | Combo card → single card + `Dialog` of constituent dishes (spec compliance) | Discovery |

Tier 1 is a single focused session, near-zero regression risk. `CLAUDE.md` is also stale (claims the retired `#D4AF37` "Clinical Dark" palette) — update it during #21.

_Note: `CLAUDE.md` is stale — it still claims a locked "Clinical Dark" `#D4AF37` palette. The app already migrated to "Nocturnal Nourishment" (saffron `#fbbf24` + sage). Update it alongside item 6._
