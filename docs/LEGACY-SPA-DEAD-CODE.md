# Legacy SPA dead code — measurement, and why it is not yet deleted

**Status: measured 2026-08-20, NOT executed.** This is a decision record, not a
plan of record. It exists so the next person does not repeat the measurement.

`artifacts/tanmatra` lost its customer routes on 2026-07-26 and is now an
internal Admin ERP + RD console. The components those routes used were left in
place. This records how much is actually orphaned, and the three things that
must be checked before any of it is deleted.

## The measurement

Forward reachability over the import graph (`.kg/graph.json`), from the real
entrypoints only: `src/routes.ts`, every `routes/` and `pages/` file it names,
`entry.client`/`entry.server`/`root.tsx`, and the Vite / React-Router configs.
Test files are deliberately **not** roots — a component reached only by its own
test is still dead.

| | modules |
|---|---:|
| in `artifacts/tanmatra` | 437 |
| reachable from the 26 admin/RD routes | **119** |
| unreachable | **318** (277 source + 41 test) |

Unreachable source files by area — the shape is exactly what a customer-route
removal leaves behind:

```
77  pages/            54  tanmatra-v2/       25  lib/
14  components/home    9  components/primitives   7  components/landing
 5  components/plans   5  components/checkout02c  5  components/cuj
 3  components/checkout  3  components/track   2  components/dish
```

Reproduce it with the graph plus a breadth-first walk from those roots; the
whole thing is a few dozen lines and runs in about a second.

## Three things to check before deleting any of it

**1. The graph can be wrong in the deletion-unsafe direction.** A *missing*
edge makes live code look orphaned. This bit during the very sweep that
produced the table above: `components/CommandPalette.tsx` came back
unreachable, but `components/layout/Header.tsx` is live admin chrome and
reaches it through `lazy(() => import(...))`. Literal dynamic imports resolve
as of #94 — **paths built from variables or template strings still do not**, and
neither does anything reached through a runtime registry. Grep the basename of
anything you are about to delete. It costs one call.

**2. This package is load-bearing for the live site.** The storefront's
`IMAGE_UPSTREAM` proxies `/images/*` through this service, so a deletion that
breaks its build 404s every dish photo on tanmatra.food. `public/dishes` and
`tanmatra-v2/theme.css` in particular must survive. CSS is not in the graph at
all — only `.ts`/`.tsx` — so a stylesheet imported solely by a dead component
will not appear in any reachability output. Check those by hand.

**3. It moves a number CI and the docs both pin.** `verify.yml`'s `money-unit`
job runs this package's tests by glob (`"../tanmatra/src/**/*.test.ts"`, 163
tests today). Deleting 41 unreachable test files changes that count, which is
quoted in `CLAUDE.md` and `docs/CLONE-HANDOVER.md`. Re-measure and update both
in the same PR, or the handover doc goes stale the moment it merges — that has
already happened twice.

## Suggested shape, if it is done

One PR, deletions only, no refactors folded in. Delete source and its tests
together. Then, before pushing: `pnpm run typecheck`, the legacy SPA's build,
and the storefront e2e run — the last because `/images/*` is the failure mode
that no typecheck catches.
