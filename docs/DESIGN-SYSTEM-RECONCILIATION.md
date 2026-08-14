# Design-system reconciliation — Astryx × Stitch-74

**Status: adopted (owner directive, 2026-08-13).** This is the decision record
for how the storefront's two design programmes coexist, what owns what, and the
order in which the duplicate stacks collapse. It exists because the two
programmes were documented in complete mutual isolation — the Astryx adoption
runbook never mentions Stitch markers, the Stitch manifest never mentions
Astryx — and that isolation shipped a real break: the Astryx PDP rebuild
(dc80404) silently dropped screen 5.5's `data-screen-id`, CI stayed green, and
only a manually-run e2e spec caught it a commit later.

## The four-layer ownership model

Each layer has exactly one owner. A conflict between layers is resolved by this
table, not by whichever file was edited last.

| Layer | Owner | Concretely |
|---|---|---|
| **1 · Tokens** | **Astryx** | `astryx theme build` → `lib/themes/tanmatra.ts` (extends stoneTheme) is the palette; `lib/tokens/src/tokens.css` bridges into Tailwind v4. The three brand hues are the dark-mode values; light-mode counterparts exist where dark fails contrast (`#7F6921` gold). Gold remains the ONLY action colour — the one surviving design caveat from the DS-0 revocations. |
| **2 · Primitives** | **Astryx canonical, legacy frozen** | `@astryxdesign/core` components are the canonical implementation of every concept they ship (census below). Legacy locals (`components/ui/*`, `components/primitives/*`, raw elements) are FROZEN: no new call sites, no new features. They are retired concept-by-concept per the migration order — never big-bang (73 importers of `ui/button.tsx` is a repo-wide diff with zero visible payoff; users see pixels, not imports). |
| **3 · Composition** | **Stitch decides WHAT, Astryx decides HOW** | The Stitch-74 screen programme (docs/stitch/stitch-screen-manifest.json) defines which screens and states exist, their triggers, transitions and close behaviours. Astryx templates/blocks are the sanctioned way to BUILD those screens — adopting them verbatim is the goal (CLAUDE.md DS-0), except the primary-CTA colour, which is repointed to gold. |
| **4 · Identity** | **Stitch, enforced** | `data-ui-generation="stitch-74"` + `data-screen-id` + `data-screen-state` on each screen's root survive EVERY rebuild, template adoption included. Enforced statically by `scripts/lint-stitch-markers.ts` (CI: storefront.yml) — see below. |

**The rule that prevents the next dc80404:** an Astryx template adoption
replaces a screen's *markup*, never its *identity*. Port the three `data-*`
attributes onto the new root before anything else, the way dc80404 should have.
The gate makes forgetting this a build failure instead of a silent break.

## Layer-4 enforcement: `lint:stitch-markers`

Until 2026-08-13 the markers had **zero** enforcement: the e2e suite that keys
on them (`e2e/specs/stitch-runtime/*`) runs in no workflow, and the two manifest
verifiers (`tools/verify-stitch-manifest.mjs`, `verify-stitch-wiring.mjs`) never
read source files. The new gate closes exactly that gap:

- **Selects** manifest entries with `proof.renderChain === "verified"` **or**
  `proof.sourceDefinition === "verified"` (55 today). The OR is load-bearing:
  the wiring verifier's defect backstop keys on `sourceDefinition` only, so a
  `renderChain`-keyed gate could be silenced by a one-word manifest edit with
  no defect filed (verified empirically during design).
- **Requires** `data-screen-id="<promptId>"` (or the computed-attribute form)
  in the **concatenated** source of the entry's `routeEntryPoint` +
  `implementationComponent` + `controllerComponent`. Concatenated, not
  per-file: 18 of 55 screens keep the marker in a component, not the page, and
  12.6/12.7 split id and attribute across two files.
- **Does not gate** `data-screen-state` (state strings already drift: 14.2
  emits `no-match`, manifest says `no-matching-meals` — reconciling that is
  manifest work).
- **Runs both directions.** Forward: every verified screen's id must exist in
  source. Reverse: every id in source must be declared by a manifest entry —
  which catches an invented or mistyped id, a class the forward sweep is blind
  to (it only looks for ids the manifest already lists). It shipped
  one-directional because of the single orphan `MOB-10-Home-Dark` in
  `Section01ClinicalHero.tsx`, an id predating the manifest's naming scheme;
  that marker has since been retired in favour of the route root's real 5.1,
  and the reverse sweep turned on. Comments are stripped before matching in
  both directions: a commented-out marker renders nothing and must not satisfy
  the forward sweep, and an id quoted in an explanatory comment must not trip
  the reverse one.
- **Baseline** `scripts/stitch-marker-baseline.txt` seeded with the single
  honest gap (10.9, `DEF-10.9-FEEDBACK-001`); shrink-only, stale entries fail.
- **Scope**: presence-in-source only. A marker on a never-rendered branch still
  passes — runtime reachability remains the (currently unscheduled)
  `test:stitch-runtime` suite's job.

## Duplicate-stack census and migration order

Full census (module-graph walk, 527 files, 2026-08-13): the storefront imports
17 Astryx modules across 25 files. Adoption is **bimodal** — forms ~80%
migrated, the PDP fully migrated, everything else 0%. Verdicts per concept:

**DUPLICATE (both stacks live) — retire the local, in this order (by reach):**

| # | Concept | Local reach to retire | Astryx side live today |
|---|---|---|---|
| 1 | card | inline `border border-line`+`bg-surface`: 369 sites / 175 files | `Card` ×3 (checkout) |
| 2 | badge/chip | inline chip pattern: 93 sites / 59 files | `Badge` ×3 (PDP) |
| 3 | input/textfield | raw `<input>` 56/34 + `<textarea>` 6/6 | `TextInput` ×13, `Field` ×12, `TextArea` ×4, `NumberInput` ×7 |
| 4 | select | raw `<select>`: 9 sites / 6 files | `Selector` ×8 |
| 5 | checkbox | raw `type="checkbox"`: 5 sites / 5 files | `CheckboxInput`/`CheckboxList` ×3 |
| 6 | accordion | `FaqAccordion` (4) + `Section10FaqAccordion` (1) | `Collapsible`/`Group` ×3 (PDP) |
| 7 | divider | `<hr>` ×1 + inline `border-t border-line` | `Divider` ×4 (PDP) |

**LOCAL-ONLY (Astryx equivalent unused or absent) — frozen, migrate opportunistically:**
button (`ui/button.tsx` 72 importers + 210 raw `<button>`), skeleton
(17 importers), drawer/bottom-sheet (vaul `ui/drawer.tsx` — Astryx ships no
bottom sheet; this one is **permanent-local**), modal/dialog (5 files raw
Radix), toast, empty-state, tabs, spinner, avatar, icon-button,
command-palette, bottom-nav (**Astryx-absent, permanent-local**).

Migration discipline: one concept per PR, visually verified at 390px, markers
intact (the gate now enforces that part). Prefer migrating a concept when a
surface is being touched for CRO/product reasons anyway — a migration with no
visible payoff queues behind one with.

**Dead code (0 importers, confirmed by graph walk)** — deleted as part of this
reconciliation where verification allows: `components/ui/badge.tsx`,
`components/primitives/Accordion.tsx`, `components/account/AccountDrawer.tsx`,
`components/menu/ProductDetailView.tsx` (pre-Astryx PDP), plus the
pre-Astryx PDP satellite cluster (`menu/DishBuyBar|DishGallery|DishPairing|
DishReviews|DishThumbnail|PdpAddToCart`) and other zero-importer files listed
in the census. `/styleguide` is the load-bearing importer for most of
`components/primitives/` — it documents a parallel stack the product never
adopted, and follows the primitives out as they retire.

## The seam ledger (visual audit, 390×844, production build, 2026-08-13)

What "seamless" concretely requires, ranked by visibility. Consistent already:
Satoshi everywhere; `#D4AF37`/dark-ink action colour without exception.

1. ~~**The app is two apps.**~~ **FIXED.** 5 routes painted `#0a0a0a` and 4
   painted `#f3f3f5` in one session; Menu → Care flipped black→white. Dark is
   the brand canvas: `/care`, `/account`, `/legal`, `/faq` and their families
   joined the allowlist. Verified at 390×844 — all seven report body `#0a0a0a`
   with header and nav resolving to the same `#171717`, and an explicit
   "light" toggle choice still wins.
2. ~~**The bottom nav is welded dark.**~~ **RESOLVED by (1)** — there are no
   light customer routes left for it to clash with.
3. ~~**Card radius is route-dependent**~~ **FIXED.** 28px on /menu, 34px on
   /dish and /plans, 22px on /care and /account, five values on `/` alone — so
   walking menu → dish → plans → care changed the corner of the same concept
   three times. A card now carries `rounded-card`, a SEMANTIC token
   (`--radius-card`, = 28px) rather than another t-shirt step, because the
   numbered names say nothing about *what* is being rounded and a card got
   whichever step its author reached for.

   The rule the token encodes is a three-step ladder, not one value: a **card**
   is `rounded-card`; a block **inside** a card keeps a numeric step and a
   smaller one (a nested corner must be tighter than its parent or it looks
   like it is bulging out); **controls** — inputs, chips, pills — are not cards
   and keep their own. That distinction is why this was not a blanket sweep:
   of 350 elements carrying the card signature, the ones left alone include
   buttons (`inline-flex … py-3.5 font-bold`), a textarea, and the dish-image
   frames nested inside cards.

   Verified by measuring computed `border-radius` per route at 390×844, with
   the page scrolled through first so `content-visibility` sections actually
   lay out (without that step the measurement reports phantom values for
   unrendered sections). Every top-level card on `/`, `/menu`, `/dish`,
   `/plans`, `/care`, `/legal` and `/faq` is now 28px; the only other values
   left are nested blocks at 22px, correctly tighter than their parents.

   Still open from this item: the `2px` veg-dot bracket value wants a token,
   and `rounded-full` vs Astryx's `999px` are two spellings of one pill.
4. **8 gold-CTA geometries across 4 routes.** **Decision: primary CTA = Astryx
   Button (gold-repointed), pill, one height scale (44 standard / 56 pay-bar)**
   — adopted per surface with the button-concept migration. *Open.*
   Note the audit's "5 routes have no primary action" is **not** all defect:
   /menu's action is the per-card Add (outline at list density is the category
   convention), and /plans' outline trial CTA is deliberately secondary to the
   goal router — same words as /trial's gold pill, but a different job on a
   different page. Only the geometry spread is being unified.
5. ~~**Same four goals, two components**~~ **FIXED.** /plans rendered them as
   `<button>`s at 34px with a gold arrow and no subtitle; /care as `<a>`s at
   22px with a subtitle and no arrow — same words, same `routerPlans()`, same
   destination, two components, so a fix to one silently skipped the other.
   Both now render `components/plans/GoalCard.tsx`, which keeps the better half
   of each: a real `<Link>` (middle-click, open-in-new-tab and prefetch work
   again, and the destination shows on hover) over button + `router.push`; the
   plan name as a subtitle, so an answer says what it routes to; the gold
   arrow; and the funnel event — which **only /plans emitted**, leaving /care's
   identical taps invisible to the scoreboard. A `source` prop separates them,
   so the two entry surfaces can be compared instead of silently pooled.

   /care's goal rail is a `stack` to match /plans (those labels wrapped to
   three lines in a two-column cell once the card gained its subtitle and
   arrow); the conditions stay a grid, their labels being one short word.
   `HorizontalSnapRail` became **`CardSection`** in the process: it now carries
   three layouts, and the old name meant every new caller inherited a
   horizontal scroller whether the content wanted one or not.
6. Lower severity, tracked: eyebrow tracking 0.3px vs 2.4px; `/plans` has no
   visible h1 (its `h1` is `sr-only` and the visible headline is an `h2`); h1
   scale is 4 sizes × 2 weights. The audit's "translucent-bar ghosting" is
   **not** a clearance bug — `(global)/layout.tsx` already pays
   `pb-[calc(8rem+env(safe-area-inset-bottom))]`; what it saw is mid-scroll
   content behind a 90%-opaque glass bar, which is the intended treatment.

Shipped alongside, from the same 390px pass but outside the audit's axes:

- **Bottom sheets cap at 88dvh.** The dish quick-view filled the whole
  viewport, so it read as a page swap, the scrim had nothing to act on, and no
  "outside" remained to tap. Fixed in the shared primitive, not by darkening
  `--scrim` (whose dark-in-both-arms invariant is deliberate and tested).
- **Menu cards tell dishes apart.** The catalog derives `description` from a
  dish's first three ingredients, which across a family are the shared base —
  Aglio Olio Veg/Chicken/Prawns printed one identical line. `dishCardSummary()`
  drops pantry staples so the differentiating ingredient reaches the card.

## What this supersedes

- The mutual silence between `docs/ASTRYX-ADOPTION-RUNBOOK.md` and
  `docs/stitch/*` — both now point here for the interaction contract.
- Any reading of DS-0's "adopt templates verbatim" that includes replacing a
  screen root without re-attaching its Stitch markers.

What it does **not** touch: the money-path rules (server owns every amount),
auth-islands, PHI encryption, `lint:test-reach`, and the gold-only action
colour — all explicitly out of scope for both programmes, per CLAUDE.md.
