# Tanmatra — Prototype → Production Wiring Guide v1

Scope: how `tanmatra-pdp-plan-first.html` (canonical 9-frame PDP) and `tanmatra-storefront-prototype.html` (7-screen money path + subscription core) become shipped code in `chan8822/Wellness-Foods`. Governing stack: CRO System Spec §0–§20, Amendment Set 01 (A1–A4), Implementation Checklist v1.2, Stitch Brief §1–§5. Where this doc conflicts with those, they win.

---

## 0 · Artifact inventory & frame coverage

| Artifact | Covers | Frames wired / spec'd |
|---|---|---|
| `tanmatra-pdp-plan-first.html` | `/dish/:slug` deep reference | 9 / 9 |
| `tanmatra-storefront-prototype.html` | `/` `/menu` `/dish` (condensed) `/subscribe` `/cart` `/checkout` `/track` | ~46 / 101 (Wave 1+2) |

Wired in the storefront app: home 5/5 · menu 4 (skeleton, default, filtered, empty-filter) · PDP condensed 4 (gated, unlocked, allergen, oos) · builder 8/11 (4 steps × states, review, commit-success; missing: mandate-disclosure detail, VPA-continuity, error) · cart 4/5 · checkout 13/15 (missing: guest-welcome interstitial, scheduled-slot edge on review) · track 6/8 + zen 3/4 (missing: cancelled-refund, error-lost-order, zen-fallback-link). Every state is reachable organically or via the ⚙ FRAMES strip; `route-slug--state` names in the dev strip match the Stitch output contract, so Stitch boards and these prototypes reconcile 1:1.

Not covered (build from Stitch Wave 2/3 seeds against these patterns): `/account/addresses` (7 frames), trial bridge (A2), RD consult, wellness tracker, admin.

## 1 · Ground rules (non-negotiable, from the spec stack)

1. `.tnm2` is the sole consumer design system. Legacy System-A imports on storefront routes fail CI.
2. Zero literals in components: no hex/rgb/hsl (stylelint gate), no `₹[0-9]` price literals, no geography strings. Named-hex grep additionally rejects the superseded homepage palette `#FAF8F3 #1F6B4F #DCC9A3 #2E7D32`.
3. Every numeral renders JetBrains Mono via the `tnm-data` utility (`font-variant-numeric: tabular-nums`) — this is what makes the 120 ms digit cross-fades CLS-0.
4. Standard Four states on every data screen; skeletons occupy the exact final boxes.
5. Macros gated on PDP only; open ribbons everywhere else. Saffron is the sole action hue. Caution/alert always icon + text. Trust strip is one quiet line directly above Pay. No cure claims.

## 2 · Route & component mapping

`routes.ts` is the live manifest; `App.tsx` is a dead router diverged by 15 routes — **quarantine or delete it in the first PR** so nothing new lands there by accident. All work below lands in `tanmatra-v2/` components behind `routes.ts` entries.

| Prototype screen | Repo target | Action |
|---|---|---|
| Home (two doors, serviceability, proof, resume) | tnm2 Home component | Restructure per Homepage v1.1 (Checklist §2); keep 11 live sections' data hooks |
| Menu (skeleton grid, filters, healthy mode) | tnm2 Menu | Port skeleton pattern (W4); wire filters to Petpooja categories; `?healthy=1` param already live |
| PDP plan-first | tnm2 Dish | Replace current à-la-carte PDP with gated layout; variant swap becomes in-place state, not navigation (kills the 1.2–1.6 s reload) |
| Subscription builder | `CorporateLunchPlanner`-adjacent tnm2 builder | New component; desktop = sequential stepper + persistent summary rail (spec), mobile = this prototype's flow |
| Cart (ghost-math bill) | tnm2 Cart | Bind bill lines to server quote (W1); AOV rail from top-seller list |
| Checkout 3-step | `Checkout.tsx` (2,599 LOC) | Refactor **inside** the existing component — it's the heaviest built asset; impose the Review→Delivery→Payment stepper, keep its Razorpay plumbing, add W1 |
| Track + zen | tnm2 Track | Zen ships as post-checkout default with fallback link (frame pending) |

## 3 · State contracts

- `goalFitProfile` `{goal, allergens[]}` — persisted per account (server) with local cache; `unlocked` is derived (`profile != null`), never stored separately. One selector `allergenClash(dish, profile, mods)` feeds chip, ingredient flag, CTA message, and Add-block — exactly one source of truth, as in the prototype.
- `cart[]` holds display prices only. **No client price ever reaches an order.**
- `builder` state is throwaway until commit; commit creates a `plan` entity (W2).
- `co` (checkout) is a state machine: `step ∈ {review, delivery, payment}` × `phase ∈ {phone, otp, address, pay, processing, failed}`. The prototype's machine is the spec — port transitions verbatim.

## 4 · Wiring workstreams

**W1 · Server price authority — P0, blocks everything else money-shaped.**
`POST /orders/quote` and `POST /orders/create` recompute totals from the server catalog (Petpooja-synced) + tax table (5% prepared food / 18% where applicable) + delivery rules + voucher validation. Razorpay order amount = server figure, full stop. Client totals are display-only; on mismatch the client blocks Pay with the alert pattern demoed in the prototype (⚙ → price-tamper). Wire the existing audit harness's mutating tests against staging into CI as the regression gate.

**W2 · Subscription commerce layer.** Petpooja has no recurring primitive. New entities: `plan {id, cadence, mealsPerDay, pref, perMealQuote, slots[], pauses[], swaps[]}` + Razorpay mandate for weekly/6-week cadences. Endpoints: create (explicit CTA + disclosure — nothing converts silently, per A2), pause, skip, swap. Trial bridge honors A2: same-VPA offered as labeled default, never silently reused; telemetry `trial_bridge_viewed/cta/outcome`.

**W3 · Coach anonymous fix.** The endpoint 401s for anon users behind an enabled input — silent failure. Either issue an anon session token scoped to the open dish, or render the input in a locked state with a sign-in affordance. An enabled control that swallows input is prohibited (same class as the old checkout P0).

**W4 · CLS port.** The 0.44–0.48 menu CLS is card-grid mount-after-paint. Port the prototype pattern: grid container + fixed-height card skeletons render in the same paint as the shell; cards hydrate into identical boxes; images reserve 1:1 aspect. Budget: menu CLS < 0.1 measured on the throttled Playwright harness from the CWV audit.

**W5 · Token bind.** Swap the placeholder hexes (`--tnm-surface-ink/-2/-3`, `--tnm-sage`, `--tnm-caution`) to `theme.css` values — saffron `#E89A3E` confirmed, alert `#DC8773` per brief §1. Then turn on the literal lint + named-hex grep. Also fix the two silent failures from the design audit: define `--color-alert-*` (or migrate ConflictsPanel to `--tnm-alert`) and add `:focus-visible` rings to storefront primitives — the prototypes ship both; diff against them.

**W6 · Route hygiene + prerender.** Add `/cart /checkout /subscribe /dish/* /meal-planner /rd*` to the prerender list (kills cold-load blank screens). Register new screens in `routes.ts` only. Delete the dead `App.tsx` router and the stranded `StitchClinicalOverview.tsx` (wired-or-deleted rule).

## 5 · Sequencing

| Sprint | Ships | Why first |
|---|---|---|
| 1 | W1 + W6 + quarantine App.tsx | Money integrity and no blank transactional screens before any redesign traffic |
| 2 | PDP plan-first (both artifacts as spec) + W4 menu skeleton + W5 tokens/focus | The 28.1%→46% menu-to-cart lever lives here |
| 3 | Builder + W2 plan layer + trial bridge (A2) | Subscription is the pillar; needs W1 live |
| 4 | Checkout stepper refactor + track/zen + W3 coach + `/account/addresses` | Heaviest refactor last, on a stabilized base |

## 6 · Definition of done

- Grep gates clean (rules §1.2) on every storefront PR.
- Playwright harness green: price-authority mutation tests (staging), disabled-Pay-reason present with no address, OTP flow, allergen clash renders on flagged profile, menu CLS < 0.1 at 375×812 throttled, variant swap < 200 ms in-place.
- Telemetry live: `gate_unlock`, `add_to_plan`, `builder_commit`, `trial_bridge_*`, `pay_blocked_price_mismatch`.
- Open decisions D2–D5 from Checklist v1.2 remain unresolved — pull and close them before Sprint 3 task cut; nothing here presupposes their outcome.

## 7 · Prototype literals that must bind before ship

Dish prices other than ₹155 (ACS), the 1,400+ orders proof figure, per-meal quotes (₹133/₹179/₹149-class — `[quote]`, server-priced), delivery-fee threshold ₹199, voucher TNM50, slot times, rider/testimonial copy. All are marked in-source with `PROTO`/`quoted` comments; none may survive as literals past the lint gate.

---

## 8 · Stitch reconciliation (project `9545397915295144685`, pulled via MCP 2026-07-18)

The project holds **196 screens** under a Stitch-authored design system, "Nocturnal Nourishment" — pure-black `#131313` base, Material-dark scheme, amber `#fbbf24` primary, Inter + Geist, glassmorphism, 8px grid. That system is a **fork from locked `.tnm2`** and is treated as inspiration-only: structure and tactility harvested, token values rejected.

**Adopted into the prototypes (re-tokened to `.tnm2`):**

| Stitch screen (id) | Idea taken | Landed as |
|---|---|---|
| Premium PDP Hero (`b66eb854`) | Hero scrim, title-on-image, glass chips | Storefront PDP hero overlay — glass chips carry **only non-gated** info (RD badge, allergen label) |
| PDP Macro Analysis (`a1eee790`) + DS gauges | 2 px circular macro gauges, status-toned arcs | Ring strip in the unlocked Goal Fit panel, both files |
| Clinical Allergen Gate (`06df1304`) / Ack Sheet (`59ae510c`) | Explicit consent interstitial; safe action is primary | Allergen acknowledgment sheet on any Add with an active clash; acknowledgment "logged for kitchen visibility" |
| Menu Asymmetric (`f013ee65`) | Editorial featured card, nested radii 24/14, image-overlaid chips | Featured "Dietitian's pick" first card on `/menu`; rest stay compact conversion rows |
| Duration Redesign (`ec34fe9d`) | Strike-through base + savings tag on commitment tiers | Builder duration cards — 6-week shows struck weekly base + SAVE %, trial tagged INTRO (per-meal figures remain `[quote]`) |
| Trial Recap & Upgrade Bridge (`1ab5af58`) | Recap stats → offer → dual explicit CTA + disclosure | New trial-bridge sheet (dev strip), A2-conformant: explicit tap, VPA offered never silently reused |
| Order Tracker OFD (`c3286840`) | Oversized mono ETA, rider call affordance | `/track` header + rider card call button |
| Kinetic ZenTracker (`00e1e135`) | Layered concentric rings + rotating conic arc | Zen mode rebuilt (CSS conic-gradient arc, breathing core) |
| DS "Tactile Buttons" | Diffused primary-glow shadow + top-edge inner highlight | `.btn-primary` in both files, glow recolored to saffron `rgba(232,154,62,.25)` |

**Rejected, with reason:** amber `#fbbf24` family and Material error `#ffb4ab` (locked palette wins; error stays `#DC8773`); Geist label face (Inter + JetBrains Mono is locked); pure-black base; kcal/GI glass chips **on** the PDP hero (violates Law 5 macro gating — chip treatment kept, macro content stripped); cart-as-drawer (route parity with live `/cart` retained); bottom-border-only inputs (filled fields keep stronger mobile affordance on the money path).

**New grep gate:** extend the named-hex rejection list with the Stitch export palette — `#fbbf24 #f9bd22 #ffe1a7 #ffb4ab #131313` — so pasted Stitch code exports can't leak its tokens into the repo. Stitch HTML exports are reference-only; anything wired must pass §1.

**Board ↔ frame parity:** Stitch already holds Standard-Four variants this guide listed as pending — `9803e70e` menu-skeleton, `3cc7f5e4` home-loading, `77f8f3c3` dish-loading, `8b4f1eff` zen-skeleton, `31bf5566` cart-empty, `82e90575` cart-min-nudge, plus `87dac518` saved-addresses and full RD-partner/admin consoles. Reconcile §0's coverage table against the live board before commissioning any Wave-3 generations — a meaningful share of "pending" frames already exists and only needs re-tokening.

**Full extraction (2026-07-19):** the complete board adjudication now lives in `stitch-asset-register.md` (cluster-level canonical picks, harvest ledger, compliance findings, copy bank, route matrix) with row-level data in `stitch-screen-census.csv`. Highlights: the plan-management suite (`175/23/153/190/7`) is harvested and wired as `/plans` in the storefront prototype — planner with goal gauges, macro-capped swap sheet, credit-forward skip with undo, pause governance. The grep list is finalized empirically: `#fbbf24 #f9bd22 #ffe1a7 #131313 #e2e2e2 #c6c6c7 #d3c5ac #454747 #34daff #ffb4ab`. Two new export gates beyond re-tokening: **re-brand** (screen 58 shipped as "NUTRIENG") and **re-currency** (`$` on 40/49/58) — plus the claim-language scan in register §4. Four gates, in order: token → brand → currency → claims.
