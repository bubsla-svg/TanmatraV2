# Legacy SPA dead code — measured, then deleted

**Status: measured 2026-08-20, EXECUTED 2026-08-20.** This is the record of
what was removed and how it was made safe. Keep it: the two traps in
"What nearly went wrong" are not specific to this sweep, and the next person
reaching for the import graph as a deletion oracle will hit both.

`artifacts/tanmatra` lost its customer routes on 2026-07-26 and became an
internal Admin ERP + RD console. The components those routes used were left in
place. 298 of them are now gone.

## The measurement

Forward reachability over the import graph (`.kg/graph.json`), from the real
entrypoints only: `src/routes.ts`, every `routes/` and `pages/` file it names,
`entry.client` / `entry.server` / `root.tsx`, and the package-root configs — 32
roots in all. Test files are deliberately **not** roots: a component reached
only by its own test is still dead.

| | modules |
|---|---:|
| in `artifacts/tanmatra` | 437 |
| reachable from the 26 admin/RD routes | **119** |
| unreachable | **318** |
| … of those, under `src/` (the deletion scope) | 302 |
| … deleted | **298** |

The 16 unreachable modules **outside** `src/` were kept. They are unreachable
from `routes.ts` by construction, not dead: the e2e harness
(`e2e/playwright.config.ts`, `e2e/fixtures.ts`, the archived specs),
`scripts/generate-sitemap.mjs`, `server/static-server.mjs` and its test, and
`public/sw.js` — which `entry.client.tsx` registers by URL string, so no import
graph will ever show an edge to it.

Deleted source, by area — the shape a customer-route removal leaves behind:

```
77  pages/           54  tanmatra-v2/      25  lib/         15  components/
14  components/home  11  services/          9  primitives/   7  landing/
 5  plans/            5  checkout02c/       5  cuj/          3  checkout/
 3  track/            3  fixtures/          3  mocks/        2  dish/
```

## What nearly went wrong

Two things, both in the direction that deletes something load-bearing.

**1. Every test file looks orphaned, because nothing imports a test.**

Reachability marked all 40 test files under `src/` dead — necessarily, since a
test is a leaf. Taking that at face value would have deleted six tests whose
*subject survives*, including two on the money path (`cartMath`'s GST rates via
`checkoutLedger.test.ts`, and `rdPlans.pricing.test.ts`). CI would have stayed
green: the tests would simply have stopped existing.

The rule reachability cannot express, and the one that actually governs:

> **Delete a test only when the module it tests is also being deleted.**

Four were restored on that basis — `adminConsoles`, `aiRunFailure`,
`internalSurfaces`, `rdPlans.pricing`. Two stayed deleted because their subject
genuinely died and the coverage moved rather than vanished: `checkoutLedger`
(penny invariant now in the api-server money suite) and `planMacroGuard`
(ported to `artifacts/storefront/lib/`, where 16 tests now cover it).

To check this for yourself: for each test you are about to delete, resolve its
imports and ask whether any of them survive. Six did.

**2. A glob that matches nothing exits 0.**

Before the restore, the deletion took `src/**/*.test.ts` to zero files.
`node --test` on a zero-match glob prints `# tests 0` and **exits 0** — so
`verify.yml`'s money-unit step would have reported success while running
nothing at all. That is strictly worse than a red build. The step now carries a
note: if it ever drops to zero files, delete the step rather than leave a no-op
that reads as passing coverage.

## The two hazards that did NOT bite, and how that was established

**The graph can be wrong in the deletion-unsafe direction.** A *missing* edge
makes live code look orphaned — that is how `components/CommandPalette.tsx`
came back unreachable in the first sweep while `components/layout/Header.tsx`
(live admin chrome) reaches it through `lazy(() => import(...))`. Literal
dynamic imports resolve as of #94; paths built from variables or template
strings still do not, and neither does a runtime registry.

Bare-basename grepping is too noisy to act on — it returned 265 of 318 hits,
including a match inside a JPEG's bytes. Three precise checks were run instead,
scoped to files surviving *inside* the package (a storefront `SafeImage` cannot
resolve to an SPA one):

| check | result |
|---|---|
| a surviving file imports a candidate by a specifier that RESOLVES to it | **0** |
| a surviving file has a non-literal `import()` — template or variable | **0** |
| a surviving file names a candidate inside a path-shaped string | **0** |

The middle one is the load-bearing result, and it was confirmed independently
with `rg 'import\s*\(\s*[^'"\s]'` over the package: every dynamic import in the
SPA is a string literal, so #94's extractor resolves all of them.

**This package is load-bearing for the live site.** The storefront's
`IMAGE_UPSTREAM` proxies `/images/*` through this service, so a deletion that
breaks its build blanks the photos of the 46 live dishes served that way — of
95; the other 49 carry absolute Unsplash URLs and would be unaffected
(measured 2026-08-20). CSS is not in the
graph at all — only `.ts`/`.tsx` — so a stylesheet imported solely by a dead
component would appear in no reachability output. Checked by hand: every `.css`
in the package (`src/index.css`, `src/tanmatra-v2/theme.css`, the three
Phosphor sheets) is imported by `src/root.tsx`, which is live, so nothing was
orphaned. Nothing under `public/` was touched — only files under `src/` were
candidates, and the deletion was file-by-file, never by directory.

## What moved

- **Tests: 163 → 28.** 36 of the 40 test files tested customer-route code that
  went with them; the other two subjects moved (above). The count is quoted in
  `CLAUDE.md` and `docs/CLONE-HANDOVER.md` and was updated in the same PR — it
  had gone stale twice before.
- `verify.yml`'s money-unit comment cited `planMacroGuard`, `useWizardState`
  and `sessionReplay` as the files its glob rescued. All three are now gone, so
  the comment was rewritten. The quoting rationale stays: it is about the
  pattern being correct, not about where the files happen to sit today.

## What was salvaged first

All 277 dead source files were triaged against what the storefront and
api-server already have. One was worth porting; one is actively dangerous.

**Ported: `src/lib/planMacroGuard.ts`** → `artifacts/storefront/lib/`, wired
through `components/mealplan/useMealPlan.ts` and rendered in `MealPlanner.tsx`.
When a patient on a clinical plan swaps a slot, the day can drift off its
prescribed macro targets, and a silent "swapped ✓" refetch hides that. The
storefront had the swap flow and no guard behind it. One behaviour diverges: the
storefront's `MealPlanDay` slots are optional where the SPA's were required, so
an incomplete day is not judged at all — summing a half-loaded day would blame a
missing dinner on the patient's protein intake.

**Deleted with prejudice, never revive: `src/lib/nutritionLabel.ts`.** It
fabricated the label — micronutrients invented by regexing ingredient names
("spinach → +1.6 mg iron"), sodium from a per-category table, saturated fat as a
flat 32% of fat — and then minted "Lower sodium" / "Low saturated fat" claims
from those invented numbers. That is finding F5 (unearned clinical claims) as
executable code. If a nutrition label ever ships, its numbers come from the
catalog/BOM pipeline.

**Superseded, deleted without ceremony:** the API clients (`subscriptionsApi`,
`corporateApi`, `wellnessApi`, `fulfillmentApi`, `userAddressesApi`,
`razorpayClient`) all have live storefront equivalents; `services/`
(PlanGeneration, ConstraintEvaluation, Pricing, Checkout…) is the client-side
ancestor of what the api-server now owns (`icmrPrecisionPlanner`, `cartMath`);
`menuVariants` predates M-4's server-side option groups; `useDialogA11y` is what
Radix now provides; `useWizardState`, `sessionReplay` and `attribution` have
storefront counterparts. The pre-Astryx UI components are superseded by the DS-0
decision itself.

## Known-stale references

Historical documents still name deleted paths — `REFACTOR_PLAN.md`,
`audit/tanmatra-audit.md`, `docs/ENGINEERING_AGENT_PLAN.md`,
`docs/MONEY-PATH-VERIFICATION.md`, `docs/stitch-nn-integration-playbook.md` and
several `.claude/` skill files. These are records of decisions made when those
files existed, and rewriting them would falsify the record; they were
deliberately left alone. No workflow, script, or source file references a
deleted path — that was checked, and the two apparent workflow hits resolved to
`artifacts/api-server/src/lib/subscriptionPricing.test.ts`, a different file
that still exists.

## Verification run before pushing

`pnpm run typecheck` (all 5 projects), the legacy SPA's `build` (prerenders 5
admin/RD pages), its 28 tests, the storefront's full suite, and the repo lint
gates including `lint:test-reach` and `lint:dockerfile-paths` — the last because
a `COPY` is a hard path reference with no compiler behind it, which is exactly
how removing `lib/agency-agents` left this package unbuildable in PR #79.
