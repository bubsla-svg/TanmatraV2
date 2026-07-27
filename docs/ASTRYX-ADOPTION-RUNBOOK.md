# Astryx adoption runbook — stages 3–5

For the engineering agent continuing the DS-0 Astryx Design System adoption in
`artifacts/storefront`. Stages 1–2 are done and pushed; this document is the
state, the invariants, the traps already sprung once, and the remaining work.
Read §2 and §3 before writing any code — every item in them was learned by
breaking something.

---

## 1. Where things stand

Branch: `claude/astryx-spike-theme` (PR **#434**, open against `main`).
Owner decisions already made — do not re-litigate them:

- **Astryx adoption is approved.** The storefront palette lock is lifted;
  CLAUDE.md records the split (legacy SPA still locked).
- **Full Astryx accent as configured**: light mode uses `#7F6921` gold fills
  with white ink; dark keeps `#D4AF37`. Owner saw the before/after and chose it.
- **Full component adoption, JS cost accepted** — including `/menu`, PDP and
  checkout. The ~2× JS on commerce routes was measured, presented, and accepted.
- **Templates wherever possible**, including checkout and auth — but staged,
  with money-path tests green at every step (§3).

Landed so far:

| Stage | Commit | What |
|---|---|---|
| 0 | `3f043409`+`d0067292` | Spike: theme package, `/styleguide-astryx`, contrast tests; gothic dep dropped; CLAUDE.md palette decision |
| 1 | `e1612495` | Whole-app retheme via token bridge (no component edits) |
| 2 | `81560b84` | `DishCard` + `MenuGrid` on Astryx primitives; bridge value-pinned after the shadowing bug |

Remaining (the job):

| Stage | Surfaces | Templates/blocks |
|---|---|---|
| 3 | `components/Header.tsx`, `BottomNav.tsx`, `Footer.tsx` | `shell-top-nav` page template; `TopNav`, `MobileNav`, `LayoutFooter` blocks |
| 4 | Lead/contact forms (`CorporateLeadForm`, `LeadForm`, `NotifyMeForm`, `WaitlistFields`), account settings pages | `contact-form`, `settings-sidebar`; `FormLayout`, `Field`, `TextInput` |
| 5 | Checkout + PhoneAuth — **chrome only, logic untouched** | `payment-form`, `login-card` |

Also open: `/styleguide-astryx` is marked "throwaway" in the PR body — once
stages 3–5 land, fold anything still useful into `/styleguide` and delete it.

---

## 2. Astryx facts, all learned empirically

**Where things live.** The component library is `@astryxdesign/core` (123
export subpaths — `Button`, `Card`, `TopNav`, `MobileNav`, `FormLayout`, …).
The templates ship inside the CLI package (43 page templates + 156 blocks),
and the **official catalog with visual previews is
<https://astryx.atmeta.com/templates>** — browse there to pick by eye; the
site and the pinned CLI (0.1.8) carry the same catalog. The site is a
JS-rendered SPA, so fetch/curl gets an empty shell — use a real browser, or
the CLI locally, which is authoritative for the installed version anyway.

**Use the CLI workflow, not node_modules archaeology** (run from
`artifacts/storefront`, where `@astryxdesign/cli` is a devDependency):

```bash
pnpm exec astryx template --list --type page     # catalog: display name + description
pnpm exec astryx template --list --type block    # the 156 building blocks
pnpm exec astryx search <need> --type template   # ranked search; each hit prints its
                                                 # exact inject command, e.g.
                                                 # "Checkout Form → pnpm exec astryx template payment-form"
pnpm exec astryx template <name> --skeleton      # layout skeleton with spacing/nesting
                                                 # annotations — the fastest way to read
                                                 # a template's composition
pnpm exec astryx template <name> <path>          # inject the full source at <path>
```

**The 3-step study workflow — run it for EVERY surface before writing code:**

1. `astryx template --list` (or `astryx search <need> --type template`) —
   find a related page pattern to use as reference.
2. `astryx template <name> --skeleton` — study the layout structure: the
   annotated component tree with spacing and nesting.
3. `astryx component <Name>` — read the docs for **every component the
   skeleton uses** before using it. This is not just a props table: it
   carries anatomy, and do/don't best-practice rules that the design system
   expects you to follow (e.g. Card: "not the default layout tool — don't
   wrap page sections in cards, don't nest cards"). Flags: `--props` (table
   only), `--source`, `--showcase` (example code), `--blocks` (related
   example blocks).

Then implement. **Verbatim adoption is sanctioned** (owner decision,
2026-07-27 — "we need the design system as it is rendering"): inject with
`astryx template <name> <path>` and keep the template's composition and
styling as shipped. The former blockers were revoked to make that true —
the `.tsx` cap is now 400 (templates run ~300), the `"use client"`
justification requirement is gone, the palette-class and sage-interactive
lint rules are gone, and `@heroicons/react` is installed so template imports
compile as-is. What still must change in injected source is DATA, not
design: replace placeholder products/prices with our server-fed data (the
fabricated template prices must never render), and mind the two server-side
invariants in §3. Display names differ from inject names ("Checkout Form"
is `payment-form` — trust the arrow in the search output). Decomposing big
pages is still good practice where it costs nothing, but it is no longer a
gate and never a reason to deviate from the template.

Also available when useful: `astryx component --list` (all components by
category), `astryx doctor` (integration sanity check).

**371 of 501 built modules are client components — and the directive hides.**
`'use client'` sits on **line 3**, under a copyright header. `head -2` and
naive greps miss it; this was gotten wrong twice before checking
`head -6 dist/<C>/<C>.js`. Assume any Astryx component is a client component
until proven otherwise (`Stack` is one of the few server-safe ones).

**A server component may render client primitives without becoming one.**
This is the load-bearing pattern of stage 2 and the reason `DishCard` and
`MenuGrid` kept their data access server-side with no `"use client"` of their
own. Preserve it on every surface that is currently a server component: compose
Astryx primitives *from* the server file, never add `"use client"` to it.

**`@astryxdesign/core/astryx.css` is mandatory.** `tanmatra.css` only
*overrides* component styles; the geometry (Grid columns, Stack gaps, Card
padding) is in the base sheet. Without it, components render unstyled — the
menu came out as a one-column stack. Already imported in `app/layout.tsx`;
don't remove it, don't reorder it (§3, bridge).

**No polymorphic `as` prop on Card or Grid** (Text has one). Where a semantic
element matters — and the e2e locators target semantic elements, not classes —
wrap in the semantic tag with `className="contents"`:

```tsx
<article className="contents"><Card …>…</Card></article>
```

Grid renders a `<div>`; recreate list semantics with `role="list"` /
`role="listitem"` (see `MenuGrid.tsx`).

**Never import `@astryxdesign/core/tailwind-theme.css`.** Its Tailwind
namespace collides with ours on names that mean opposite things (`accent` is
gold there, a neutral here). A test pins this.

**Useful prop notes:** `Card padding={0}` for image-bleed cards; `Text
hasTabularNumbers` is the house `.text-clinical-data` equivalent — required on
every price and macro; `Text maxLines={n}` replaces `line-clamp-n`;
`Grid columns={{minWidth: n}}` for breakpointless responsive columns
(160 keeps two columns on a 375px phone).

---

## 3. Invariants — break these and the PR does not merge

**The token bridge is value-pinned. Keep it that way.**
`lib/themes/tanmatraBridge.css` maps every raw token (`--gold`, `--ink`, …) to
a concrete `light-dark()` tuple. It must stay **unlayered** and imported
**after** `astryx.css` + `tanmatra.css`. Do NOT "clean it up" to read
`var(--color-accent)` etc.: Tailwind v4's theme layer emits `:root`
definitions for those same names bound to our *neutrals*, its layer is
declared last, and the result is gold buttons painted white-on-white — that
exact bug shipped for one local build in stage 2. `astryxBridge.test.ts`
enforces all of this plus tuple-sync with `tanmatraTheme.ts`; if you change a
colour, change `tanmatraTheme.ts` first, rebuild the theme CSS, then mirror
the tuple, and the test will hold you to it.

**Money path.** The server owns every amount. The browser never sends,
computes or defaults a price; checkout receives `keyId` from the server's
order response. Stage 5 adopts `payment-form` **as chrome around the existing
logic** — the handlers, the quote reconciliation and the Razorpay adapter do
not change. If a template field would carry an amount the client typed or
derived, it does not get wired. After ANY change under `components/checkout/`
or `lib/planCheckout*`, run the money suites (§5) before pushing.

**Auth islands, not redirects.** Gated surfaces render, their call 401s, and
`<PhoneAuth onVerified={reload}/>` swaps in place. The `login-card` template
is a full-page login screen — take its *visual* composition into PhoneAuth's
card, never its page-level structure, and never introduce a redirect to
`/login`. The OB-6 spec (`cuj-onboarding-audit.spec.ts`) exists to catch
exactly this; its public-route sweep asserts no `#pa-phone` and no
`autocomplete=one-time-code` input on catalog routes.

**REVOKED for the storefront (2026-07-27, recorded in CLAUDE.md):** the
sage-never-interactive rule, the palette-class ban, the 150-line `.tsx` cap
(now 400), the `"use client"` justification requirement, the Lucide-only
icon rule, and the ECC anti-template policy. Astryx variants and templates
render as designed. `lint:tokens` still bans raw colour literals in
components/app — colours live in theme files.

> ### ⚠️ The one caveat: gold stays the only action colour
>
> Adopt every template verbatim **except its primary-action colour.** Where a
> template paints a primary CTA in its own accent — Astryx's default primary,
> a blue/green variant, a coloured submit — repoint it to gold
> (`--gold` / `bg-gold`, `--gold-ink` for the label). Everything else in the
> template keeps the colour it shipped with: status badges, coloured Cards,
> success/warning/error states, charts, decorative fills. Those are
> categorisation and signal, not action, and they are explicitly in scope for
> verbatim adoption.
>
> The reason is recognition, not taste. Across ~40 routes a customer learns
> one thing — the gold pill is the button — and that association is worth more
> than any single template's palette. It also keeps the retheme coherent: the
> Astryx accent tuple (`#7F6921` light / `#D4AF37` dark) is already wired to
> `--gold`, is already AA in both modes as fill and as text, and is the one
> colour the whole app agrees on.
>
> **This is a review caveat, not a gate.** It is deliberately not re-added to
> `lint:tokens` — a build-breaking rule here is exactly the kind of blocker
> that was just removed, and the check would be unreliable anyway (it cannot
> tell a primary CTA from a secondary or a link). Hold it in review: when a
> surface lands, the primary actions on it should be gold. Sage remains
> permitted on interactive elements — the sage-never-interactive rule is
> genuinely revoked; only the *primary action* colour is constrained.

**File caps (current).** `.tsx` ≤ 400, everything else ≤ 300, and **no `@/`
imports inside `lib/`** (relative only — the bare node test runner can't
resolve the alias; `lint:filecap` fails the build on it — this one is
correctness, not design governance, and stays).

**Test reach.** Every new `*.test.ts` must be reachable by a workflow glob or
`lint:test-reach` fails. Storefront `lib/**/*.test.ts` is already covered by
the existing glob — put new tests there and you're fine.

---

## 4. Stage playbooks

### Stage 3 — nav shell

1. `pnpm exec astryx template shell-top-nav --skeleton`, then inject it and
   the `TopNav*` / `MobileNav*` / `LayoutFooter` blocks into a scratch path
   to read (§2 loop). Check the catalog site for near variants
   (`shell-nav`, `shell-side-nav`) before committing to one.
2. `Header.tsx` is currently a server component with a client CommandMenu
   island — keep that split. Compose `TopNav` primitives from the server file.
3. `BottomNav.tsx` is the mobile IA (Eat / Plan / Track / Community /
   Account). `MobileNav` is a hamburger pattern — adopt its styling, NOT its
   interaction model. The bottom tab bar is a product decision, not a skin.
4. Footer → `LayoutFooter` composition; keep the legal links and canonicals.
5. Watch the file cap — the shell templates are big; decompose into
   `components/nav/*` parts under 150 lines each.
6. Verify: e2e has nav assertions in several CUJ specs; the full mobile
   project must stay 16/0.

### Stage 4 — forms + settings

1. `pnpm exec astryx template contact-form --skeleton` and
   `form-two-column --skeleton` for the composition; build the fields from
   `FormLayout` + `Field` + `TextInput` + `FieldStatus` for
   `CorporateLeadForm`, `LeadForm`, `NotifyMeForm`, `WaitlistFields`.
2. These forms are rate-limited public writes — do not touch the submit
   handlers or the honeypot/burst-guard logic, only the field chrome.
3. Keep every `aria-label` and the `role="alert"` error pattern; the specs
   query by role/label.
4. Settings pages follow `settings-sidebar`; account surfaces are auth
   islands (§3).

### Stage 5 — checkout + auth chrome

1. Smallest diffs of the whole adoption. `payment-form` ("Checkout Form" on
   the catalog site) styles the existing `AlacarteDetails` /
   `CheckoutIdentity` / plan review; `login-card` styles `PhoneAuth`'s card.
   Read both via `--skeleton` first; note payment-form's card-number/CVV
   fields are for its fake gateway — ours come from Razorpay's widget and do
   NOT get rebuilt as our inputs.
2. Zero handler changes. Zero new fields. Zero redirects.
3. Run per-step, not just at the end:
   money-unit glob + `planCheckout.test.ts` + full mobile e2e.
4. If a step can't be made to fit those constraints, stop and report rather
   than bending an invariant — scaling down is the owner's call.

---

## 5. Verification loop (every stage, in this order)

```bash
# from repo root
pnpm run typecheck                                              # 0 errors
node --experimental-strip-types scripts/lint-filecap.ts artifacts/storefront
node --experimental-strip-types scripts/lint-tokens.ts  artifacts/storefront
pnpm run lint:test-reach

cd artifacts/storefront && node --test --import tsx "./lib/**/*.test.ts"   # 292+ pass

# real production build + serve — dev mode hides client/server boundary bugs
rm -rf /home/user/Wellness-Foods/artifacts/storefront/.next     # ABSOLUTE path (stale .next trap)
pnpm --filter @workspace/storefront run build
PORT=3115 pnpm --filter @workspace/storefront run start &
E2E_BASE_URL=http://127.0.0.1:3115 pnpm exec playwright test \
  --config artifacts/storefront/e2e/playwright.config.ts --project=mobile     # 16 passed / 9 skipped
```

Then look at it: screenshot `/` and the changed surface in BOTH modes (drive
the theme by seeding `localStorage.theme` in an init script — setting the
attribute post-load races next-themes' hydration), and probe painted pixels,
not tokens: sample `.bg-gold` elements' computed background/color and check
the contrast ratio ≥ 4.5:1. Expected: `5.32:1` light, `8.84:1` dark.

Sandbox quirks: broken dish images are the missing `IMAGE_UPSTREAM` (prod
proxies `/images/*`) — not a defect. A `pkill next-server` in the same Bash
call as a build intermittently kills the build too (exit 144) — pkill first,
build in a separate command. Playwright must run from the repo root.

Money suites (stages 4–5, after any checkout/forms change):

```bash
cd artifacts/storefront && node --test --import tsx ./lib/planCheckout.test.ts ./lib/addons.test.ts
# CI equivalents: verify.yml money-unit + money-integration must be green on the PR
```

## 6. Ship protocol

- Commit per stage to `claude/astryx-spike-theme`, push
  `git push -u origin <local>:claude/astryx-spike-theme` — it updates #434.
- Commit messages: what changed, what was preserved deliberately, what broke
  during the work and how it was verified. No model identifiers in anything
  pushed.
- CI on #434: `storefront` is the gate that matters (build + lint gates +
  49-file suite + served-build e2e). `gates`/`e2e` (tanmatra-scoped) will skip
  on storefront-only diffs — that is path filtering, not a failure.
  `bulkhead-smoke` fires when `pnpm-lock.yaml` changes and has flaked once on
  a Docker Hub pull timeout — re-run before diagnosing.
- Merging #434 and deploying are the owner's calls. Deploys are manual
  `workflow_dispatch`; the `only_storefront` input rolls just the storefront
  service. No migrations are involved in any of stages 3–5.
