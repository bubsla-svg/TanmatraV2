# Native-Feel Storefront Plan

**Status:** proposal · **Baseline:** `main` @ `d822151` (2026-08-13) · **Scope:** `artifacts/storefront` only

Strategy context: the web storefront is the stepping stone; a store-shipped native app
is the milestone (`docs/NATIVE-ONBOARDING-PORT-PLAN.md` covers that track separately).
This plan closes the gap in between — making the **existing** storefront read and feel
like a native app on a phone. Everything here also compounds toward the milestone: an
installable, transition-smooth, jank-free web app is what a future WebView shell or
PWA wrapper would ship anyway.

Method: this is a code walkthrough with evidence, not a checklist transplant. Every
"missing" claim below was verified against the tree at the baseline SHA; every
"already done" claim cites where. The predecessor document
(`docs/WEB-APP-ENHANCEMENT-PLAN.md`, hereafter **WAEP**) covered responsive/perf/DS
ground broadly — several of its findings have since been fixed, and this plan does
not re-propose them (§1). Where an open WAEP item overlaps, this plan references its
section instead of duplicating it.

---

## 1. Already native-grade — the baseline to protect

This storefront is much further along than a generic "make the site feel native"
checklist assumes. None of the following needs work; regressions here are what
`layout-vrt`, `nav-contract`, and `ghost-ui` e2e specs exist to catch.

| Behaviour | Evidence |
|---|---|
| Safe-area handling everywhere: `viewportFit: "cover"` + `env(safe-area-inset-*)` on every fixed bar (bottom nav, buy bars, MiniCartBar, sticky CTAs, toasts) | `app/layout.tsx:88-96`; grep hits across 15+ components; WAEP's "confirmed bug" — since fixed |
| Dynamic `theme-color`: light default flipped to the dark canvas **before first paint** on redesigned routes | `app/layout.tsx` `STITCH_ROUTE_SCRIPT` |
| No pull-to-refresh reload, no rubber-band chrome reveal, no double-tap-zoom delay, no gray tap flash | `globals.css:268-276` (`overscroll-behavior-y: none`, `touch-action: manipulation`, transparent `-webkit-tap-highlight-color`) |
| No iOS zoom-on-input-focus: 16px minimum on every text-accepting control | `globals.css` "16px Minimum Input Rule" block |
| Dynamic-viewport units complete: 0 `min-h-screen`/`h-screen` remnants, 31 `dvh` uses | WAEP's "confirmed gap" — since swept |
| Bottom nav with native tab-bar physics: scroll hide/reveal with hysteresis, `inert` when hidden, hidden while sheets are open | `components/MobileBottomNav.tsx`; `e2e/specs/nav-contract.spec.ts` |
| Sheets are real modal drawers with drag handles and contained overscroll; **platform back-gesture closes overlays instead of leaving the page** | `components/ui/drawer.tsx` (Vaul), `components/ui/useOverlayHistory.ts` — the back-gesture behaviour is rarer than any other item in this table |
| Press feedback: `active:scale-[0.98]` pattern across 55 files incl. the shared Button | grep |
| Focus rings only for keyboard (`:focus-visible`), reduced-motion collapse, smooth anchor scrolling | `globals.css:238-266` |
| Offline honesty: shell-only service worker that **never** caches `/api/*`, `/checkout*`, `/account/*`, plus a network-status toast | `public/sw.js` (header comment is the contract), `components/NetworkStatusToast.tsx` |
| Correct mobile keyboards + autofill: `inputMode="numeric"`/`tel`, `autoComplete="tel"`/`postal-code`, and OTP with `autoComplete="one-time-code"` + `pattern` + `maxLength` | `components/checkout/PhoneAuth.tsx:236-254`, `components/account/AddressForm.tsx`, `components/corporate/CorporateLeadForm.tsx` |
| Touch targets: 44px utility + 48px stricter class for money-path controls | `globals.css:300-309` |
| Render-skip containment utility for heavy rails (`.cv-auto` with intrinsic-size fallback) | `globals.css:325-336` |
| `next/image` on the hot paths via `SafeImage` (DishCard, DishThumbnail, OrderBump, TrialStart); Sentry client tracing already sampled down to 0.15 | grep; `sentry.client.config.ts:9` — both were open WAEP items, since fixed |

**Protect this section.** Most "make it feel native" advice found in the wild would
re-implement rows of this table worse.

---

## 2. Tier N1 — Identity & shell (the "it's a website" tells)

These are the giveaways visible before a single interaction: browser chrome around
the page, a font that pops in, an offline story that 404s.

### N1.1 No web app manifest — not installable, never standalone  **[the #1 tell]**

- **Tell:** the URL bar and browser chrome are permanently visible; no Add-to-Home-
  Screen install prompt; a home-screen shortcut opens as a browser tab, not an app.
- **Evidence:** no `app/manifest.ts`, no `.webmanifest`, no `metadata.manifest`, no
  `metadata.appleWebApp` anywhere (`grep manifest|appleWebApp app/layout.tsx
  next.config.ts` → only unrelated `routes-manifest` comments). `public/` contains
  exactly three files — two brand JPGs and `sw.js`. **No app icons exist at all.**
- **Fix:** `app/manifest.ts` (Next metadata route) with `display: "standalone"`,
  `name`/`short_name` ("Tanmatra"), `start_url: "/"`, `background_color`/
  `theme_color` from `lib/stitchRoutes.ts`'s `THEME_COLOR` (import, don't hand-copy),
  plus generated icons: 192/512 PNG + a maskable variant + 180px `apple-touch-icon`,
  and `metadata.appleWebApp` (`capable: true`, `statusBarStyle: "default"`; revisit
  `black-translucent` only after testing scroll-under). Icon generation from the
  brand wordmark is part of this task — there is no existing asset to point at.
- **Effort:** M (S for the manifest, the icons are the real work). **Risk:** low —
  affects only users who install; browser behaviour unchanged. Verify standalone
  back-navigation on iOS before shipping (overlay back-gesture already handled by
  `useOverlayHistory`; page-level back in standalone relies on edge-swipe).

### N1.2 `sw.js` falls back to an `/offline` route that does not exist  **[bug, not polish]**

- **Tell:** go offline, tap a link → instead of the designed offline page, the user
  gets whatever the precache stored for a 404 — or the browser error page.
- **Evidence:** `public/sw.js:29` `const OFFLINE_URL = "/offline"` and `/offline`
  leads `PRECACHE_ROUTES`; `git grep -l offline -- app/` matches only `layout.tsx`
  (a comment). **No route renders `/offline`.** The worker's `allSettled` precache
  (deliberately not atomic, `sw.js:79-81`) means installation survives — which is
  exactly why this has been silently broken rather than loudly.
- **Fix:** add a fully static, chrome-less `/offline` page (the `(focus)` route
  group renders no header/nav — right fit), tokens-only, zero data fetches, with a
  retry affordance. **Bump `VERSION` in `sw.js`** so existing installed workers
  re-precache — without the bump, browsers that already ran the old install keep
  the bad cache entry indefinitely.
- **Effort:** S. **Risk:** minimal; the page is static by construction.

### N1.3 Satoshi loads as a render-blocking third-party CSS import  **[font pop-in]** — **Shipped 2026-08-13**

- **Tell:** first paint on a cold mobile connection shows fallback glyphs, then the
  whole page's type swaps (`display=swap` FOUT) — apps never do this. Also chains
  first render on `api.fontshare.com` DNS+TLS.
- **Evidence:** `app/globals.css:1` —
  `@import url('https://api.fontshare.com/v2/css?f[]=satoshi@...&display=swap')` —
  the very first line of the main stylesheet. Contrast: JetBrains Mono is already
  self-hosted via `next/font` (`app/layout.tsx:46-51`), so the pattern to match
  exists in the same file. Strengthened during the coherence sweep
  (`docs/audit/COHERENCE-SWEEP-2026-08-13.md` addendum): a live network trace
  measured `api.fontshare.com` taking **~12.8s** to fail closed
  (`net::ERR_CONNECTION_RESET`) when unreachable — this was the actual mechanism
  behind that sweep's route-timeout deaths, on every route, not just plan pages.
- **Fix (shipped):** self-hosted via `next/font/local` — same four static weights
  the CDN request asked for (400/500/700/900, normal style only, matching
  `f[]=satoshi@900,700,500,400`), `display: "swap"`, exposed as `--font-satoshi`
  and wired into `--font-sans` the same way `--font-mono` already wraps
  `--font-jetbrains-mono`. The `@import` is deleted from `globals.css:1`.
  Licensing was resolved definitively, not inferred: Fontshare's official
  download package bundles the verbatim Free Font EULA
  (`app/fonts/satoshi/LICENSE.txt`) — §01 Grant of License explicitly permits
  free commercial/personal use "in any media (including Print, Web, Mobile,
  Digital, Apps...) at any scale, at any location worldwide"; only modification
  and standalone redistribution of the font itself are prohibited, neither of
  which applies to self-hosting these files to render this site's own text.
  Verified post-fix with a live network trace on both a light and a dark
  (Stitch) route: zero requests to `fontshare.com`, and `document.fonts`
  confirms the self-hosted faces genuinely reach `status: "loaded"` for every
  weight the page actually renders.
- **Effort:** S–M. **Risk:** low; visual output identical, loading behaviour better.

---

## 3. Tier N2 — Screen-to-screen continuity (pages vs. screens)

The storefront's individual screens behave natively; the seams *between* them are
where it feels like a website.

### N2.1 No transition between routes — navigations cut, apps slide

- **Tell:** tapping a dish card swaps the entire screen in one frame (or worse, via
  N2.2, after a blank pause). Native navigation pushes/pops with motion that tells
  you where you are in the stack.
- **Evidence:** no `viewTransition` flag in `next.config.ts` (grep), no
  `::view-transition` CSS anywhere.
- **Fix (staged):** enable Next's View Transitions support and start with a fast
  (~150–200ms) cross-fade via `::view-transition-old/new(root)` CSS. Add an explicit
  `@media (prefers-reduced-motion: reduce)` opt-out — the existing global animation
  collapse in `globals.css` does **not** reach view-transition pseudo-elements.
  Directional slide (menu → dish pushes left, back pops right) is a later, separate
  step; it needs per-route transition names and real design intent. Browsers without
  support degrade to today's instant swap — pure progressive enhancement.
- **Effort:** S for cross-fade, M for directional. **Risk:** low (experimental flag,
  but failure mode is "no transition", which is the status quo).

### N2.2 Skeleton coverage is 2 routes out of ~50

- **Tell:** tap → nothing happens → whole page appears. The dead frames between tap
  and paint are the single biggest "web" feel on slow connections, and the absence
  of reserved layout boxes is also a CLS source.
- **Evidence:** exactly two `loading.tsx` files exist — `app/(global)/menu/` and
  `app/(global)/account/orders/` (Glob). WAEP flagged zero; two have landed since —
  the pattern is established, the coverage isn't.
- **Fix:** extend `loading.tsx` skeletons to the hot navigation targets first:
  `dish/[slug]`, `/plans`, `/care` + condition pages, `/account` hub, `/trial`,
  `/checkout` entry. Skeletons must reserve real layout geometry (card heights,
  image aspect boxes) — a centered spinner is not the idiom; the two existing files
  are the reference.
- **Effort:** M (mechanical but many files; each is small under the 400-line cap).
  **Risk:** minimal.

### N2.3 Menu filters and search don't survive back-navigation

- **Tell:** filter to Veg, search "bowl", open a dish, swipe back — chips and query
  are reset. A native list screen would be exactly where you left it. (Scroll
  position mostly restores; the *state* doesn't.)
- **Evidence:** `components/menu/PersonalizedMenu.tsx` holds chip / advanced-filter
  / search state in `useState`; client component state does not survive the
  unmount/remount of back-navigation.
- **Fix:** lift chip + search (and the filter sheet's committed state) into URL
  `searchParams` via `router.replace(..., { scroll: false })`. This is the ECC
  URL-as-state pattern, and it makes filtered views shareable/bookmarkable for free.
  Keep the sheet's *draft* state local; only committed filters belong in the URL.
- **Effort:** M. **Risk:** low; needs a small e2e (filter → dish → back → filters
  intact) added to the menu specs.

---

## 4. Tier N3 — Scroll & render jank (measured or structural)

### N3.1 The 116-dish menu grid paints everything, everywhere

- **Tell:** the heaviest browsing surface builds layout for ~116 cards up front;
  low-end Android scroll suffers first.
- **Evidence:** `PersonalizedMenu.tsx` maps every dish into the grid; the `.cv-auto`
  containment utility exists (`globals.css:325-336`) but is applied to horizontal
  rails, not the menu grid.
- **Fix:** apply a vertical-grid variant of the same containment to menu cards
  (`content-visibility: auto` + `contain-intrinsic-size` matching DishCard's real
  box) so offscreen cards skip layout+paint. No virtualization library — the CSS
  containment approach is already the house pattern, and it keeps find-in-page and
  SEO-irrelevant concerns simple.
- **Effort:** S. **Risk:** low; verify no scroll-anchor jumping with the intrinsic
  size set correctly (the `.cv-auto` comment documents exactly this trap).

### N3.2 Blur budget: up to three simultaneous backdrop-filters over scrolling content

- **Tell:** compositing cost. On `/menu` with items in the cart, a mid-range Android
  phone is blurring the sticky header (`backdrop-blur`), the bottom nav
  (`backdrop-blur-xl`), and the MiniCartBar (`backdrop-blur`) on every scrolled
  frame.
- **Evidence:** `components/Header.tsx:36`, `MobileBottomNav.tsx:145`,
  `cart/MiniCartBar.tsx:53`, plus `backdrop-blur-md` buy bars on PDP/checkout.
- **Fix:** measure first (DevTools frame timeline on a throttled profile), then cap
  concurrent blurs per screen at one: the bottom nav keeps it (it's the identity
  piece); MiniCartBar and buy bars move to near-opaque token surfaces (their
  `--glass` backgrounds already carry high alpha — the blur is barely visible
  behind them and is the cheapest thing to drop).
- **Effort:** S–M after measurement. **Risk:** subtle visual change; screenshot
  both themes (`layout-vrt` spec) before/after.

### N3.3 Finish the image discipline (WAEP §"Images", still the long pole)

- Status moved since WAEP: `SafeImage`/`next/image` now covers DishCard,
  DishThumbnail, OrderBump, TrialStart, and `images.unoptimized` is gone from
  `next.config.ts`. Remaining, in order: audit `sizes` props against real rendered
  widths (wrong `sizes` silently downloads desktop-width images on phones);
  `priority` on the PDP hero + LCP candidates; explicit dimensions/aspect boxes
  anywhere still un-reserved. The structural half — dish photography being served
  through the **legacy Cloud Run service** via the `/images/*` rewrite — is
  WAEP's recommendation and `docs/DOMAIN-CUTOVER.md`'s open question; it caps how
  fast images can ever be and stays on that track, not this one.
- **Effort:** S (audit) + upstream decision. **Risk:** low.

### N3.4 Bundle trims that still stand from WAEP

- Two icon libraries ship together (`lucide-react` + `@heroicons/react` — the
  latter sanctioned by DS-0 for Astryx templates, so this is now a *dedupe over
  time* item, not a removal); `motion` imported statically by 2 files is a
  `next/dynamic` candidate. Neither is a "native tell" by itself; both are tap-to-
  paint latency. Reference: WAEP §"Current bottlenecks". **Effort:** S. **Risk:** low.

---

## 5. Tier N4 — Fit & finish (small tells)

| # | Tell | Fix | Effort |
|---|---|---|---|
| N4.1 | Long-press on chrome (header links, tab labels) can select text / show iOS callout | Sweep `.select-none-ui` (already defined, used by MobileBottomNav) across Header cluster, tab labels, drawer titles — chrome only, never content or prices | S |
| N4.2 | Long-press a dish photo → browser image-save sheet | `select-none-ui`'s `-webkit-touch-callout: none` on `SafeImage`'s wrapper for product imagery | S |
| N4.3 | Sharing a dish means copying the URL from the browser bar | `navigator.share` button on the PDP (title + `/dish/[slug]` URL), rendered only when the API exists — the native share sheet is a strong "app" signal on both platforms | S |
| N4.4 | Autocorrect fighting inputs that aren't prose (voucher code is already handled with `autoCapitalize="characters"`) | Audit name/address/search inputs for `autoCorrect`/`autoCapitalize`/`spellCheck` appropriateness | S |
| N4.5 | Status-bar area in future standalone mode | After N1.1 lands, verify notch-area colour against `THEME_COLOR` on device; revisit `statusBarStyle` | S (blocked by N1.1) |

---

## 6. Tier N5 — Screen-level defects (on-device screenshot audit, 2026-08-13)

Two batches of owner-supplied phone screenshots (dish drawer / PDP / cart /
checkout, then account sheet / care / plan auth gate / FAQ disclaimer). Every
finding below was verified against code or measured against a live build
before being filed — screenshots raised the question; the tree answered it.

### Mechanical — root-caused, PR-sized

- ~~**N5.1 Checkout buries the consent it asks for.**~~ **Retracted
  2026-08-13, same day, after rigorous re-test.** The original "0px scroll-end
  clearance" claim was itself a measurement bug: `document.querySelector("main")`
  found `(focus)/layout.tsx`'s `<main>` (safe-area padding only, by design —
  see that file's own doc comment) and missed that the actual clearance lives
  one level deeper, on `page.tsx`'s `<section className="...pb-44">` (176px).
  Re-tested with a seeded cart, the form filled exactly as the owner's
  screenshot showed, and a scroll-*settle* loop (a single-shot `scrollTo`
  can read `scrollHeight` before late layout settles and undershoot the true
  bottom — see `docs/audit/COHERENCE-SWEEP-2026-08-13.md`'s addendum for the
  full mechanism, found via the sibling N6.1 finding retracting the same
  way): the consent checkbox clears the bar by **60px**, the fine print by
  **13px**, measured *before* scroll even reached true maximum. `pb-44`
  (176px) does exceed the bar's real height (103px) with room to spare, as
  designed. No occlusion on `main` today.

  **Kept as a forward action despite the retraction:** the underlying pattern
  — a hand-guessed padding constant that happens to exceed today's bar
  height, with nothing enforcing that inequality — is still fragile. A
  longer `blockedReason` line, a wrapped line at a larger accessibility font
  size, or a future control added to the bar could each grow it past 176px
  with no warning. The fix worth shipping is a self-measuring clearance
  primitive (`ResizeObserver` on the bar, feeding the scrolling ancestor's
  padding) that makes the inequality correct *by construction* instead of by
  luck — framed as hardening against a real, plausible failure mode, not as
  a fix for a confirmed-broken today. See the coherence-sweep addendum for
  the parallel note on `/legal`.
- **N5.2 The ₹50 → ₹112 ambush.** `CartDrawer.tsx` contains no delivery or
  threshold signal (grep-verified) while checkout renders "Add ₹450 more for
  free delivery" — a +124% fee reveal on the final screen, with the softening
  nudge one screen too late. Fix: threshold hint in the cart drawer, fed by the
  same server-owned numbers checkout already gets (never client-derived).
- **N5.3 The PDP is a room with no door.** `/menu` renders zero `/dish/*`
  links — cards open the drawer, and the only path onward is the small "Open
  full page" text link in the drawer footer (`DishDrawer.tsx:98`). Fix is a
  product call on mechanism (card long-press? title link? drawer CTA
  promotion?) but the reachability gap itself is not debatable.
- **N5.4 The "description" is the ingredient list, twice.** The PDP subtitle
  renders `longDescription || description` — which is literally
  "ingredient – qty" text — then the Ingredients accordion repeats the same
  list below (`app/(focus)/dish/[slug]/page.tsx:65` vs `:101`). The drawer's
  variant is char-truncated mid-word ("Almond milk / low, and more.") and no
  storefront code generates that string — it is baked into the API-side
  content, so the fix is data-side: real descriptions, or derive the subtitle
  from ingredient *names* only, cleanly joined.
- **N5.5 "Full macronutrient breakdown" contains two rows** (Fat, Fiber —
  `page.tsx:87-98`), fewer macros than the summary strip above it. Microcopy
  overpromise; either add the full table or rename the accordion.
- **N5.6 The floating price ledger's underlap band.** `sticky bottom-4` +
  95%-alpha background (`page.tsx:118`, measured 16px gap) lets content
  slivers scroll through the strip beneath the card — designed as a float,
  perceived as a glitch. Either anchor `bottom-0` opaque, or keep the float
  and mask the gap.
- **N5.7 One dish, three number dialects.** Drawer: 4-up chips, "~3 g P".
  PDP: 3-up row, "~3g", Fat demoted to an accordion. "8g (natural)" vs
  "~2 g". En-dash on the PDP subtitle vs em-dash in the drawer for the same
  ingredient–qty pairs. Fix: every macro/quantity string renders through one
  formatter in `lib/format.ts`, unit-tested, both surfaces consuming it.
- **N5.8 Crowding nits.** Cart line prints ₹50 twice at qty 1 (unit price +
  line total); checkout truncates "Activated Charcoal S…" beside its stepper —
  wrap to two lines instead.
- **N5.9 The dark scrim is mathematically invisible.** `--scrim`'s dark arm is
  `rgba(0,0,0,0.6)` layered over `#0a0a0a` surfaces
  (`lib/themes/tanmatraBridge.css:92`) — modals on dark routes barely dim
  their background, so sheets don't read as modal (owner shot: account sheet
  over /menu with the header still fully vivid). Fix at the token: a
  perceptible dark arm (higher alpha, subtle blur, or a white-tinted scrim),
  verified across all three consumers (drawers, ⌘K, address switcher) in
  `layout-vrt` both themes.
- **N5.10 "SECURE UPI CHECKOUT" on the OTP step.** `components/FocusHeader.tsx`
  renders the label on the identity gate, where the only transaction is an SMS
  code (owner shot: "Start your Desk Fuel plan"). Make the label stage-aware
  or drop it from the auth step — a trust label that misdescribes the moment
  costs trust.
- **N5.11 The auth gate answers none of the buyer's questions.** The plan
  sign-in step renders a phone field in ~65% empty canvas with no plan name
  context beyond the heading, no price, no recap — the customer is asked for
  their number before being reminded what they're buying. Checkout's CURRENT
  ORDER card is the existing pattern; render a compact plan recap above
  `PhoneAuth`.
- **N5.12 Rails built for two items.** `/care` renders two
  `HorizontalSnapRail`s (`NeedStateRail.tsx`, `ConditionRail.tsx`) of ~2 cards
  each; the only scroll affordance is the second card clipped mid-word
  ("Keep my sug…", "Type 2 Diab…"), and the two rails use different card
  anatomies (title+subtitle vs bare label). With n ≤ 3, stack full-width;
  reserve rails for rails-worth of content.

### Decision items — filed to the owner, not PR-able as-is

- **N5-D1 The funnel's semiotics** (both owner remarks stand): commerce routes
  force-dark pre-paint regardless of theme preference, surfaces run
  #050505–#171717, microcopy is uppercase `tracking-widest` `text-3xs`,
  numerals are mono — the stack reads tactical console, not lunch. Options
  ladder: stop force-darking commerce routes (smallest change — honor the
  user's preference), warm the dark food surfaces, or food-forward light
  merchandising. Palette is governance-gated; this is an owner call.
- **N5-D2 Add-on merchandising ratio.** ₹399–549 pantry jars recommended
  against a ₹50 smoothie (8–11× cart value). Needs a server-side relevance /
  price-ratio rule; the server owns recommendations like it owns amounts.
- **N5-D3 The Account tab is a legal link farm.** The bottom-nav Account sheet
  holds 2 account destinations and 9 company/legal links as visual peers —
  Grievance Redressal sits beside My Orders. Legal belongs in the footer and
  an account-settings page; the tab sheet should be account *actions*. IA
  change → owner sign-off.
- **N5-D4 The disclaimer needs a copywriter and an RD.** The title
  "MANDATORY MEDICAL TREATMENT & DIETARY DISCLAIMER"
  (`components/landing/Section10FaqAccordion.tsx`) parses as mandating
  medical treatment; the body's "GLP-1 hormone receptor agonist therapy" is
  garbled (the term is "GLP-1 receptor agonist"); dense legalese in a warning
  card mid-funnel. Required disclosure, wrong execution — clinical-governance
  adjacent, so copy changes route through owner/RD review.
- **N5-D5 The left-edge clip — parked, not closed.** Owner screenshots show
  the PDP's entire text column clipped by its first characters. Not
  reproducible on `main`: measured `scrollWidth == viewport` with zero
  offending elements at 320/342/390px. Either the deployed build predates a
  fix or it is device-specific; close it by comparing the live `/api/build`
  sha against `main` (the DOMAIN-CUTOVER verification trick) before hunting
  further.

### Competitive reference (owner-supplied, 2026-08-13)

A walkthrough of a competitor's ordering app (Mother's Kitchen India — not in
this monorepo; verified by string search) supplied the countercase to N5-D1:
warm palette, real food photography, and human copy, wrapped around template
jank. Two of its patterns are directly worth adopting here: **taxes and
delivery itemized on the order form before checkout, with the full payable
total in the CTA label** ("Add to Cart — ₹103.95") — the exact shape of the
N5.2 fix — and a busy-state CTA that keeps the amount visible ("Adding… —
₹103.95"). The contrast is the argument for N5-D1 in one frame: warmth is
what sells food, discipline is what earns trust, and each app currently has
only one of the two.

---

## 7. Deliberate non-changes

Named so nobody "fixes" them later:

- **Pinch-zoom stays enabled.** No `maximum-scale=1`, no `user-scalable=no` — the
  16px input rule already prevents the zoom that annoys people; disabling zoom
  wholesale is an accessibility regression, not a native feel.
- **No JS swipe-back hijacking.** Overlay back-gesture handling via history entries
  (`useOverlayHistory`) is the ceiling; simulating iOS edge-swipe page transitions
  in JS reliably feels *worse* than the browser's own.
- **The service worker's money-path hard line stands.** Offline improvements happen
  around it, never through it (`sw.js` header comment is the contract).
- **`overscroll-behavior-y: none` is a trade already taken** — it kills browser
  pull-to-refresh by design. If PTR is ever wanted on `/menu`, it would be a
  deliberate in-page implementation, not a revert of this rule.

---

## 8. Sequencing and verification

Suggested order — each row is one PR-sized concern per the working agreement.
Actual shipping order diverged at #3: N1.3 went first, out of turn, because the
coherence sweep's network trace gave it the freshest and strongest evidence
(a measured 12.8s render-blocking hang) of anything in this tier — see its
entry in §2 for the shipped fix. N1.2 and N1.1 remain open, in original order.

| Order | Item | Why this order |
|---|---|---|
| 1 | N1.2 offline route + SW version bump | It's a bug; smallest diff; completes an already-shipped feature |
| 2 | N1.1 manifest + icons | The single biggest perceived jump; unblocks N4.5 |
| 3 | N1.3 self-hosted Satoshi — **shipped 2026-08-13, out of turn** | First-paint stability; independent of everything |
| 4 | N2.2 skeleton coverage (hot paths) | Pairs naturally with 5 |
| 5 | N2.1 view-transition cross-fade | The two together transform perceived navigation |
| 6 | N2.3 menu state → URL | Contained to menu components + one e2e |
| 7 | N3.1 menu grid containment | One CSS utility + class application |
| 8 | N3.2 blur audit → cap | Needs measurement first |
| 9 | N3.3/N3.4 image + bundle finish | Ongoing discipline items |
| 10 | N4.x sweep | Batch of small diffs |

Verification per tier: all seven lint gates + unit suite as always; `layout-vrt`
both themes for anything visual (N1.1, N2.1, N3.2); a new e2e for N2.3 (filter
survival) and one for N1.2 (offline page renders, chrome-less); Lighthouse/CWV spot
checks on `/menu` and `/dish/[slug]` before/after N1.3, N2.2, N3.1 — noting WAEP's
finding that no CI perf gate exists yet (its §"CI perf gates" item remains open and
is worth folding into whichever of these PRs first moves a perf number).
