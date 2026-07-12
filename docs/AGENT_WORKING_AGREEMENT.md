# Engineering-agent working agreement — how to commit without conflicts

Read this before your next commit. Every rule here comes from a real
conflict or incoherence we had to untangle by hand. Following them keeps
your PRs reviewable and mergeable.

## 0. Base your next commit on the right branch

Branch off **`integration/engg-plus-fixes`** (PR #82), **not** the old
`fix/e2e-performance-and-clinical-panel` tip. #82 already contains all of
your commits *plus* the reconciliation (statutory GST, portable gates,
post-trial bridge, veg cross-sell, `/profile`). If you branch off the old
tip you will re-introduce the flat-18% GST and the broken lint gates and
collide all over again.

```
git fetch origin && git checkout -b <your-branch> origin/integration/engg-plus-fixes
```

Always rebase on the latest base before pushing. Never stack new work on a
branch whose PR has already merged — start a fresh branch from `main`.

## 1. One concern per branch / PR

The 91-file commit that bundled POS sync + GST + a 1,798-line DB migration
+ a repo-wide color migration was un-reviewable and collided with six open
PRs at once. Split by concern:

- UI/CRO changes → their own PR.
- Money-path changes → their own PR.
- **DB migrations + generated snapshots → their own PR, with a schema
  review.** Never ride a migration in on a UI PR.
- Tooling/lint → their own PR.

## 2. The money path moves as one unit

A GST or pricing change must update **all** of these in the same commit, or
not at all:

1. `artifacts/api-server/src/lib/loyaltyEngine.ts` → `computeChargePaise`
   — **the authoritative charge that actually bills the card.**
2. `artifacts/api-server/src/lib/cartMath.ts` — server preview.
3. `artifacts/tanmatra/src/lib/cartMath.ts` — client cart display.
4. Display labels in `Checkout.tsx`, `Cart.tsx`, `CartDrawer.tsx`.
5. `artifacts/tanmatra/e2e/fixtures.ts` + the checkout audit spec.

The authoritative charge is the source of truth; every other surface must
mirror it. Changing the preview alone (as happened with GST) ships a
cart that disagrees with the receipt.

**Current model:** 5% GST on the meal subtotal + 18% GST on the delivery
fee; ₹50 delivery waived at/above a ₹500 subtotal.

## 3. High-traffic shared files — check open PRs first

Before editing any of these, look at the open PRs; if one already touches
the file, coordinate or keep your diff minimal and localized:

`Subscriptions.tsx` · `Cart.tsx` · `Checkout.tsx` · `CartDrawer.tsx` ·
`root.tsx` · `components/layout/Footer.tsx` · `routes.ts` ·
`loyaltyEngine.ts` · `cartMath.ts` (both) · `analytics.ts` ·
`dishEnrichment.ts`

## 4. No hardcoded paths, colors, prices, or secrets

- **Paths:** scripts must resolve from `import.meta.url` relative to the
  repo, never an absolute `/usr/local/google/home/...` path. They have to
  run on CI, Vercel, and any checkout.
- **Colors:** no hex or `rgb()/hsl()` literals in `src` — use the CSS
  design tokens (`var(--...)`).
- **Prices:** no `₹NNN` literals in `src` — source amounts from data/config.
- **Secrets:** no hardcoded PINs/keys (e.g. the governance-engine `998102`
  must move to env/config).

These four are enforced by `pnpm lint:gates` (colors + prices) and
`pnpm lint:geography`. They are **green today — keep them green.**

## 5. Verify before you push (don't push red)

From the repo root:

```
pnpm --filter @workspace/tanmatra typecheck     # 0 new errors
pnpm --filter @workspace/api-server typecheck    # 0 new errors
pnpm --filter @workspace/tanmatra build          # must be green
pnpm --filter @workspace/tanmatra lint:gates     # must pass
pnpm --filter @workspace/tanmatra lint:geography # must pass (needs a build)
# + run the tests for whatever you touched
```

If a pre-existing error is unrelated to your change, say so in the PR — but
never add a new one.

## 6. PR hygiene

- Open as a **draft**; fill in what changed, why, and how you verified it.
- Don't commit build output (`build/`, `dist/`) or generated snapshots
  unless the PR is specifically about them.
- If you must cap coverage (top-N, sampling, no-retry), say so in the PR —
  silent truncation reads as "done" when it isn't.
