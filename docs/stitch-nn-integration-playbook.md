# Stitch → Nocturnal Nourishment Integration Playbook

**Audience:** an engineering agent rolling the **Nocturnal Nourishment (NN)** design
across the Tanmatra app, screen by screen, without regressing the money path or the
honest health‑data guarantees.

**Golden rule:** this is a *reskin*, not a rewrite. The live `.tnm2` screens are already
dark, token‑driven, and amber‑accented. You change the **visual layer** (CSS tokens +
a class), never the handlers, data flow, or copy that a record can't back.

---

## 0. Source‑of‑truth files (read these first)

| File | What it is |
|------|------------|
| `docs/stitch-design-coverage.md` | The CUJ → Stitch coverage map + gap list. Tells you **which** screens have a design and which are gaps. |
| `artifacts/tanmatra/src/index.css` (`@theme`) | The NN design tokens: `--color-nn-bg`, `--color-nn-primary`, `--color-nn-surface`, … **Single source of truth for colour.** |
| `artifacts/tanmatra/src/tanmatra-v2/theme.css` | The `.tnm2` design system **and** the `.tnm2.nn` skin (the token remap + glass/roundness refinements). |
| `artifacts/tanmatra/src/tanmatra-v2/StitchMenu.tsx`, `StitchDishDetail.tsx`, `StitchAllergenGate.tsx` | Reference NN components already wired to live data. Copy their patterns. |
| `artifacts/tanmatra/src/lib/menuData.ts` | Honest‑data helpers: `getAllergenDisclosure`, `macrosAreProvisional`, `DISHES`, `getDishBySlug`. |
| `CLAUDE.md` + `docs/AGENT_WORKING_AGREEMENT.md` | Repo conventions, lint gates, verify‑before‑push checklist. |

---

## 1. Sync the local workspace with the remote

```bash
# From the repo root.
git fetch origin                       # get all remote refs
git checkout main
git pull origin main                   # fast‑forward local main
pnpm install                           # install/refresh deps (pnpm only; npm/yarn are rejected)

# Establish a clean baseline BEFORE touching anything:
pnpm run typecheck
pnpm --filter @workspace/tanmatra run build
```

If `typecheck` or `build` is red on a clean `main`, **stop and report** — do not start
work on a broken baseline.

> Retry any `git fetch/pull/push` up to 4× with exponential backoff (2s, 4s, 8s, 16s)
> on network errors only.

### Branch

Do all work on the designated feature branch, cut from the latest `main`:

```bash
git fetch origin main
git checkout -B claude/tanmatra-ux-clinical-audit-2nsutp origin/main
```

One concern per PR. A single reskin (one screen, or one tightly‑related cluster like
`cart` + `checkout`) is one PR.

---

## 2. Pick the integration mode for the screen (decision tree)

Look the screen up in `docs/stitch-design-coverage.md`, then:

- **Mode A — Reskin an existing `.tnm2` screen.** The route, data, and CUJ already
  work; you only apply the NN look. **This is the default and covers the vast
  majority of the sweep** (menu, dish, cart, checkout, account, orders, …).
- **Mode B — Promote a `/stitch/*` preview to a live route.** Only for the 3 built
  previews (`StitchMenu`, `StitchDishDetail`, `StitchAllergenGate`). ⚠️ These are
  **design showcases** (4‑dish menu, fixed demo dish, partial controls). Do **not**
  point a live money‑path route at one without rebuilding it to feature‑parity first.
  Prefer Mode A for the live routes.
- **Mode C — Build a new NN screen** for a *design‑ahead* item (Stitch design exists,
  no route yet — e.g. Meal Review & Rating, trend dashboards). New component + route +
  chrome wiring + data hooks.

---

## 3. Mode A — reskin an existing `.tnm2` screen (the main task)

The `.tnm2.nn` skin already exists in `theme.css`. It **rebinds** the `.tnm2` tokens
(`--bg`, `--s1`, `--saf`, …) to the NN palette and layers glass surfaces, larger radii,
pill chips, a glass sticky app bar, and a solid amber Add button. Applying it to a
screen is usually **one line**.

### Steps

1. **Find the screen's root element** and add `nn` to its class list:

   ```tsx
   // before
   <div className="tnm2" style={{ ... }}>
   // after
   <div className="tnm2 nn" style={{ ... }}>
   ```

   Discover all candidate screens and which already have the skin:

   ```bash
   cd artifacts/tanmatra/src/tanmatra-v2
   grep -rlE 'className="tnm2'      *.tsx   # all .tnm2 screens (~39)
   grep -rlE 'className="tnm2 nn'   *.tsx   # already skinned
   ```

   If the root lives in a shared sub‑component the screen renders, add `nn` where that
   screen's outermost `.tnm2` is (the `pages/*.tsx` wrapper usually delegates to the
   `tanmatra-v2/*` component — add it there).

2. **Screenshot it** (§9). Most screens are done at step 1 because everything is
   token‑driven.

3. **Only if something looks off**, add a *scoped* refinement under `.tnm2.nn` in
   `theme.css` — never edit the base `.tnm2` class (that would hit every screen). All
   colours must be NN tokens or `color-mix(... var(--color-nn-*) ...)`; **no raw hex**
   outside `index.css`. Example (the real fix shipped for the menu's Add button):

   ```css
   .tnm2.nn .dimg { overflow: visible; }  /* let the floating amber pill show in full */
   ```

4. Re‑screenshot until it matches the NN language (dark charcoal, amber primary, glass,
   rounded, Geist/Inter type).

**Never** change markup structure, handlers, state, routes, or copy in a Mode‑A reskin.
If a screen seems to *need* structural change to look right, that's a Mode‑C rebuild —
stop and flag it.

---

## 4. Wiring reference (routes, elements, data, CUJs)

Mode A needs none of this (the wiring already exists). Modes B/C do.

- **Routes:** `artifacts/tanmatra/src/routes.ts` (file‑based React Router v7). Add
  `route("path", "pages/Foo.tsx")`. Give full‑screen NN pages `export const handle = { chrome: false }`.
- **SEO/meta:** the `pages/*.tsx` file is a thin wrapper that sets `meta`/JSON‑LD and
  delegates to the `tanmatra-v2/*` component. Keep that split.
- **Cart (money path):** use the **production** store, never `stitchCartStore`:

  ```ts
  import { useCartStore } from "@/lib/cartContext";
  const addItem = useCartStore((s) => s.addItem);
  const count   = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  // map a DishData -> Omit<CartItem, "lineId">:
  addItem({ dishId: d.id, slug: d.slug, name: d.name, image: d.image ?? "",
            basePrice: d.price, unitPrice: d.price, quantity: 1, kitchen: d.kitchen,
            isVeg: d.isVeg, rdVerified: d.rdVerified,
            macros: { protein: d.macros.protein, carbs: d.macros.carbs, fat: d.macros.fat,
                      fiber: d.macros.fiber, calories: d.macros.calories },
            customizations: [] });
  ```
- **Allergen / clinical profile:** `usePreferences()` from `@/lib/preferencesContext`
  (`preferences.allergens: string[]`). The provider wraps every route.
- **Catalog:** `useMenuCatalog()` (live + `STATIC_DISHES` fallback), `getDishBySlug`,
  `DISHES` from `@/lib/menuData`.
- **New customer routes must also be registered** in the global chrome (per `CLAUDE.md`):
  `components/layout/Header.tsx`, `components/layout/BottomNav.tsx` (IA groups: Eat /
  Plan / Track / Community / Account), and `components/CommandPalette.tsx` (⌘K).
- **Icons:** Phosphor (`@phosphor-icons/react`) on NN surfaces; motion via
  `@/lib/motion` (`SPRING`, `FADE_IN_UP`, `PANEL_SLIDE`, `BACKDROP`).
- **CUJ integrity:** the browse → dish → cart → checkout → track flow must stay whole.
  After any money‑path reskin, click through Add → Cart → Checkout in the screenshot
  run and confirm the item reaches the cart.

---

## 5. Honest health‑data rendering — the non‑negotiables

These are CI‑enforced and must survive every reskin/build:

- **Allergens** via `getAllergenDisclosure(dish)`. An empty/unreviewed list is
  **"unverified — held for safety"**, *never* "safe/none" (fail‑closed).
- **Macros** hidden when `macrosAreProvisional(dish)`; prefix `~` / label "Est." when
  `dish.macrosEstimated`. Never render a number the record can't back.
- **No unbacked "RD Verified" badge.** `rdVerified` may drive sort/filter logic but must
  not render as a per‑dish trust claim (no reviewer record exists).
- **No fabricated stats** — ratings ("4.9★"), review counts, health‑outcome promises,
  or `new Date()`‑stamped "last updated" freshness.
- **Prices** from the dish record (paise) — no `₹NNN` literals.
- **Colours** from tokens — no hex outside `index.css`.

---

## 6. Mode C only — build a new design‑ahead screen

1. Fetch the Stitch screen's HTML (design reference) and translate 1:1 into a React
   component under `tanmatra-v2/`, using NN tokens + the `nn`/`.tnm2.nn` classes or the
   Tailwind `nn-*` utilities (see `StitchMenu.tsx` for the vocabulary).
2. Wire real data (cart, preferences, catalog) per §4 — no demo/hardcoded values.
3. Add the route (§4), the chrome entries, and hook it into its CUJ (e.g. a "Rate meal"
   entry from `/orders` or `/track`).
4. Uphold §5 throughout.

---

## 7. Verify before push (do all of it)

```bash
# From repo root unless noted.
pnpm run typecheck
pnpm --filter @workspace/tanmatra run lint:colors           # no hex outside index.css
pnpm --filter @workspace/tanmatra run lint:prices           # no ₹NNN literals
pnpm --filter @workspace/scripts  run verify-dish-integrity
pnpm --filter @workspace/scripts  run verify-allergen-gate  # G9 fail‑closed engine
pnpm --filter @workspace/scripts  run verify-honest-claims  # no unbacked RD badge
pnpm --filter @workspace/tanmatra run build                 # SPA + prerender
```

### Visual proof (required for any visual change)

Serve the build and screenshot the route with the preinstalled headless Chromium.
**Do not** run `playwright install`.

```bash
# 1) serve the built client
cd artifacts/tanmatra/build/client && python3 -m http.server 4178 & cd -

# 2) screenshot script — place it INSIDE artifacts/tanmatra so @playwright/test resolves
cat > artifacts/tanmatra/__shot.mjs <<'EOF'
import { chromium } from "@playwright/test";
const OUT = process.argv[2], URL = process.argv[3];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 430, height: 1600 }, deviceScaleFactor: 2 });
await p.goto(URL, { waitUntil: "networkidle", timeout: 45000 }).catch(()=>{});
await p.waitForTimeout(1200);
await p.screenshot({ path: OUT, fullPage: false });
await b.close(); console.log("shot ->", OUT);
EOF
node artifacts/tanmatra/__shot.mjs /tmp/shot.png "http://localhost:4178/menu/"
rm -f artifacts/tanmatra/__shot.mjs        # never commit the temp script
```

Open the PNG, confirm the NN look **and** that honest copy (macro ribbons, `KCAL·EST`,
allergen states, "Personalize…") still renders. Attach the screenshot to the PR.

> The `/menu` cards read from `STATIC_DISHES` when no API is present, so the screenshot
> works offline. Console 404s for the API/images are expected and harmless.

---

## 8. Commit, push, PR, merge

```bash
git add <changed files>
git commit -m "feat(<screen>): restyle live /<route> to the Nocturnal Nourishment design"
git push -u origin claude/tanmatra-ux-clinical-audit-2nsutp
```

- Open a **draft** PR against `main`. If a PR template exists
  (`.github/pull_request_template.md`), mirror its headings; otherwise write:
  what/why, the one‑line class change, the invariants preserved, the verification list,
  and the screenshot.
- **CI gate to merge:** the **`gates`** job (Quality gates) must be `success`. A lone
  **`e2e`** hydration failure is a known non‑regression and does **not** block; any
  `gates` failure does — pull the failed job log and fix.
- Merge only after the owner approves the look (visual changes) and `gates` is green.
- If the branch's PR was already merged, restart the branch from the latest `main`
  (`git checkout -B <branch> origin/main`) before the next screen — never stack new work
  on merged history.

---

## 9. Worklist — screens to reskin (Mode A), ordered by CUJ value

Regenerate the live list with the grep in §3. Suggested order (money path first):

1. **Done:** `Menu.tsx`
2. **Money path:** `Dish.tsx`, `Cart.tsx`, `Checkout.tsx`, `Orders.tsx`, `Track.tsx`
3. **Convert/subscribe:** `Subscribe.tsx`, `Subscriptions.tsx`, `Premium.tsx`, `Protocol.tsx`
4. **Account/clinical:** `Account.tsx`, `Addresses.tsx`, `Preferences.tsx`
5. **Discovery/community:** `Home.tsx`, `Marketplace.tsx`, `MarketplaceItem.tsx`, `Recipes.tsx`, `RecipeDetail.tsx`, `Rewards.tsx`, `Challenges.tsx`, `ChallengeDetail.tsx`
6. **Dietitian:** `RdDirectory.tsx`, `RdProfile.tsx`, `RdPlans.tsx`, `RdPlanDetail.tsx`, `Appointments.tsx`, `CheckoutAppointment.tsx`, `Team.tsx`, `TeamMember.tsx`
7. **Corporate/group:** `Corporate.tsx`, `CorporateInvite.tsx`, `CorporateLunchPlanner.tsx`, `OfficeLunch.tsx`, `GroupOrder.tsx`
8. **Auth/legal:** `Login.tsx`, `Faq.tsx`, `Terms.tsx`, `Privacy.tsx`, `Refunds.tsx`

Each entry is: add `nn` → screenshot → (refine if needed) → verify (§7) → one PR.
Batch tightly‑coupled screens (e.g. `Cart` + `Checkout`) into a single PR; keep
unrelated screens in separate PRs.

---

## 10. Guardrails (stop‑and‑ask)

Escalate to the owner (don't guess) when:

- a screen can't reach the NN look without structural/markup change (it's a Mode‑C
  rebuild, not a reskin);
- a reskin would alter the money path, a data contract, or any honest‑data behaviour;
- a `/stitch/*` preview is proposed for a live route without a feature‑parity rebuild;
- a CI gate other than `gates`/`e2e` is failing in a way tied to your change.
