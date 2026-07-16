# Agent Brief — Port the 16 Stitch gap-screen designs to production

**Mission:** Bring each of the 16 §9 gap routes up to its **Nocturnal Nourishment Stitch
design**, preserving all existing logic, data wiring, and honest-health-data rendering.
This is a **port/redesign of already-working screens**, not a build from scratch and not
the one-line reskin — these screens have no `.tnm2.nn` shortcut; they need their markup
brought to the design. Depth lives in `docs/stitch-nn-integration-playbook.md`
(this is Mode C-lite). This brief is your operating order.

## Inputs (everything you need is in the repo)
- **Design references:** `docs/stitch-designs/` — one PNG per screen (customer + admin),
  plus **source HTML for the 5 admin consoles** (`docs/stitch-designs/admin/*.html`).
- **The index:** `docs/stitch-gap-designs.md` — maps each design → route → the exact live
  component to align → device (mobile/desktop) → reference file.
- **The NN system:** `artifacts/tanmatra/src/index.css` (`@theme` NN tokens
  `--color-nn-*`), the `.tnm2.nn` skin in `tanmatra-v2/theme.css`, and the reference NN
  implementations `tanmatra-v2/StitchMenu.tsx` / `StitchDishDetail.tsx` /
  `StitchAllergenGate.tsx` (production-honest NN components — copy their patterns).

## 0. Coordination (do not repeat the force-push incident)
- Your own branch per batch: `claude/nn-port-<batch>` cut fresh from `main`. Do **not**
  push to `claude/tanmatra-ux-clinical-audit-2nsutp`.
- **Never force-push a branch with an open PR.** Non-fast-forward push → `git pull
  --rebase origin <your-branch>` and retry. (See the playbook's hardened §1.)

## 1. Start (baseline must be green)
```bash
git fetch origin && git checkout -B claude/nn-port-a origin/main
pnpm install
pnpm run typecheck && pnpm --filter @workspace/tanmatra run build
```

## 2. Per-screen port loop
1. Open the reference PNG (and admin HTML) from the index. Open the live component.
2. **Bring the component's presentation to the design** using NN tokens and classes:
   - Colours: NN tokens only (`text-nn-primary`, `bg-nn-surface`, `var(--color-nn-*)`,
     `color-mix(... var(--color-nn-*) ...)`). **No raw hex** outside `index.css`.
   - Type: Inter (headline/body), Geist caps for labels; tabular numerals for all data.
   - Shape: glass surfaces, 8px+ radii, amber primary + glow, cyan tertiary accents.
   - Reuse the `.nn` component classes and the StitchMenu/StitchDishDetail patterns.
3. **Touch presentation only.** Do not change routes, handlers, state shape, API calls,
   or the meaning of any copy. If the design implies a data field the record can't back,
   **do not invent it** — render the honest state instead (see §3).
4. If the design needs real structural/behavioural change (new data, new flow), that's a
   genuine Mode-C build — **stop and flag it to the owner**, don't fake it.

## 2b. Pre-audit designs: trust elements are suspect until verified
The original canvas designs predate the honesty standard, and QA
(`stitch-design-qa.md`) found fabricated reviewers, "RD APPROVED" stamps, fake
analytics, and unbacked process steps in them. **Rule: never port a badge,
statistic, reviewer name, certification, or pipeline step verbatim — bind it to a
real record or delete it.** Six designs were already fixed on the canvas; use the
corrected references in `stitch-designs/qa-fixed/` (pdp-trust, gyms-landing,
plans-landing-v2, fitness-clubs-lp, tracker-preparing, success-confirmation) —
NOT their older canvas versions.

## 3. Honest health-data rules (non-negotiable — the designs already encode these)
- **Allergens** fail closed: empty/unreviewed = "unverified", never "safe/none".
- **Macros** hidden when provisional, `~`/"Est." when estimated. No number the record
  can't back.
- **Compliance / moderation / application states** fail closed: `unchecked`, `pending`,
  `unverified` render as warning states, never rolled into "passing/approved".
- **Approvals** show a real reviewer + date, or none — never a blanket "verified" badge.
- **Prices** from the record (paise); no `₹NNN` literals. No fabricated ratings, review
  counts, savings %, or member counts — data-bound only.
- Use **Tanmatra** branding — the admin designs say "NutriCore"; that is Stitch's
  invention, not the brand.

## 4. Verify before every push (all green, no exceptions)
```bash
pnpm run typecheck
pnpm --filter @workspace/tanmatra run lint:colors
pnpm --filter @workspace/tanmatra run lint:prices
pnpm --filter @workspace/scripts run verify-honest-claims
pnpm --filter @workspace/tanmatra run build
```
**Screenshot proof (mandatory, and do it right):** dynamic `:param`/auth routes need an
**SPA-fallback server** and a **real param**, or you get a blank page (this bit the reskin
batch). Serve `build/client` with SPA fallback, hit the real route
(e.g. `/challenges/<real-slug>`), wait for hydration, confirm `.tnm2.nn`/NN chrome renders
with no page errors. Screens needing live data will show their NN-skinned loading/empty
state — that is acceptable proof the port renders; note it. Preinstalled Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` — never run `playwright install`.

## 5. Push + PR
`git push -u origin claude/nn-port-a` → **draft** PR to `main`, title
`feat(nn): port <screens> to their Stitch designs`, body listing each screen with its
before/after screenshot. Merge gate: `gates` job green (a lone `e2e` hydration failure is
a known non-regression). **Do not merge — the owner approves each design port.**

## 6. Suggested order (by CUJ value; group ~4–6 per PR)
1. **A — money/commerce:** `/subscription/bridge`, `/vouchers`, `/challenges/:slug`,
   `/account/billing`
2. **B — legal/info:** `/refunds`, `*` (404)
3. **C — corporate/RD:** `/rd-partners`, `/rd-partners/apply` (5-step),
   `/office-lunch/:id`, `/corporate/:slug/lunch-planner`
4. **D — RD console:** `/rd-console` (2 tabs)
5. **E — admin consoles (desktop, HTML in repo):** menu-engineering, compliance,
   moderation, support-tickets, rd-applications
6. **F — Mode-B holdouts** (`clinical-*`-rooted pages the `.nn` skin can't reach;
   per-page NN token work, design references exist): `pages/GymsLanding.tsx`
   (use `qa-fixed/gyms-landing.*`), `pages/MorningFitnessLanding.tsx` (use
   `qa-fixed/fitness-clubs-lp.*` — new design), `pages/SubscriptionPlansLanding.tsx`
   (use `qa-fixed/plans-landing-v2.*`), plus shared chrome:
   `components/cart/StickyCheckoutBar.tsx`, `components/layout/Footer.tsx`,
   `components/layout/SegmentToggle.tsx`, `components/layout/ErrorBoundary.tsx`.

## Hard rules
- Port ≠ rewrite of logic. Presentation to the design; behaviour untouched.
- Honest data survives every port (§3). `verify-honest-claims` must stay green.
- A blank/broken screenshot is a finding to fix, not to skip. Silence ≠ success.
