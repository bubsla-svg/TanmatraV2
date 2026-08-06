# Phase 13 Production Acceptance — RETRACTED

```txt
================================================================================
PHASE 13 ACCEPTANCE RETRACTION
================================================================================
Original verdict (2026-08-05, PR #527, tag `stitch-74-production-accepted`):
  PRODUCTION MERGE: GO
  (reached via docs/stitch/phase-13b-acceptance-signoffs.json bulk signoff)

Corrected verdict, per independent audit on branch
`audit/tanmatra-e2e-implementation` (commit 210cdabf3a4e52d98a49f22c1f2eba796e9cccb2,
2026-08-06) plus current CI/production state:
  P0 FINAL GATE:          NOT PASSED
  PRODUCTION ACCEPTANCE:  NO-GO
================================================================================
```

This document corrects the record on `main`. It does not fix any of the
underlying defects — see "Corrected next steps" below for what remains open.

## Why this is retracted

**1. Deploy provenance mismatch — production is not running the accepted code.**
`docs/audit/P0-CHECKPOINT.md` (§P0-B/P0-C) traced Cloud Run directly: the
`storefront` service in `asia-south2` (revision `storefront-00081-pz5`) is
serving an image built from SHA `250e5f59`, not the release candidate
`cffbf957` (current `main` HEAD at time of audit). Two commits that were part
of the "accepted" work — `925104f2` (P0 Clean-Slate global apply) and `c8dfe9ee`
(storefront layout enforcement) — have never reached production, even though
GitHub Actions reported a green `Deploy` run afterward. A green CI deploy job
does not by itself prove Cloud Run traffic was repointed.

**2. The 74-item Stitch manifest is not 74/74 wired.** This contradicts
`phase-13a-final-acceptance.md`'s "Reachable Route States: 74 / 74 — PASS".
Independent reconciliation (`docs/audit/stitch-74-reconciliation.json` and
`docs/audit/WP-P0.2-REPORT.md`, evidenced against SHA `cffbf957`):

| Metric | Claimed (Phase 13A/13B) | Actual (independent audit) |
|---|---:|---:|
| Manifest entries declared | 74 | 74 |
| Source implementation exists | 74 (implied) | 67 (7 missing entirely) |
| Wired into a route | 74/74 | 41/74 (26 built but unreachable) |
| Reachable locally | — | 39/74 |
| Reachable in container / staging / production | — | 0 / 0 / 0 |
| Visual approval | 20/20 (Priority-1 batch) | 0/74 |
| Accessibility approval | 9/9 overlays + 5/5 flows | 0/74 |

The 7 entries with no implementation and the 26 unwired-but-built entries are
individually named in `docs/audit/WP-P0.2-REPORT.md` (includes Cart Drawer,
all six Custom Build steps, Checkout Quote-Expired Recovery, and several
empty/loading/error states).

**3. Token compliance is broken on `main` right now**, contradicting
"Token Compliance: 0 raw color literals in components/app — PASS" in
`phase-13a-final-acceptance.md`. Commit `c8dfe9ee` (2026-08-05 13:55 UTC —
*after* the acceptance tag) introduced raw hex literals (`#4F6B50`, `#7D9E7E`,
`#1A1C1E`, `#D4AF37`, `#E7E3DA`, `#FBFAF7`) into
`AccountSubscriptionsClient.tsx` and `SymptomsClient.tsx`. The `Storefront`
CI workflow's `lint:tokens` job has failed on every run since. The
independent audit corroborates this pattern more broadly, in
`ActionButtons.tsx`, `PhoneAuth.tsx`, `MarketplaceAddToCart.tsx`, and other
primitives.

**4. Dish PDP — a Priority-1 screen marked PASS — is failing in production
right now.** `phase-13a-final-acceptance.md` lists Dish PDP (`/dish/[slug]`)
as automated-contract PASS. The scheduled `Synthetic Prod Check` workflow
against `tanmatra.food` has failed the check "dish PDP: prerendered +
structured data" on every run since 2026-08-05 21:31 UTC — 12+ hours
continuously as of this writing, while every other check on the same run
(home, menu, sitemap, robots, API proxy, cross-browser hydration) passes.

**5. The visual/accessibility signoff behind the GO decision was not a real
per-screen review.** `docs/stitch/phase-13b-acceptance-signoffs.json` marks
all 20 Priority-1 screens `"accepted"` for both visual and accessibility
review under one identical timestamp (`2026-08-05T12:00:00Z`), signed by a
single account — not 20 separately evidenced passes. The independent,
evidence-based reconciliation in point 2 instead records 0/74 real visual or
accessibility approvals. A `retraction` block has been added to that file's
metadata; the original signoff entries are left in place as a historical
record of what was claimed.

## What is still true

- The route contract, the 4-tab mobile nav (`Home / Menu / Plan / Account`),
  and legacy quarantine (no `quarantine/` imports reaching the production
  bundle, confirmed by both this repo's own `next.config.ts`/`tsconfig.json`
  exclusions and the independent audit) all check out. Those specific parts
  of the original acceptance were not wrong.

## Status of affected artifacts

| Artifact | Status |
|---|---|
| `docs/stitch/phase-13a-final-acceptance.md` | Retracted — banner added at top |
| `docs/stitch/phase-13b-pr-body.md` | Retracted — banner added at top |
| `docs/stitch/stitch-acceptance-report.md` | Retracted — banner added at top |
| `docs/stitch/phase-13b-acceptance-signoffs.json` | Retracted — `metadata.retraction` added; original entries kept as historical record |
| Git tag `stitch-74-production-accepted` | **Not deleted or moved by this change.** Tags are shared, hard-to-reverse state; retagging is left to a maintainer decision rather than being force-changed here. Until then, treat the tag name as historically descriptive of what was claimed on 2026-08-05, not as current status. |

## Corrected next steps (not performed in this change)

- Implement the 7 missing Stitch entries and wire the 26 unwired ones
  (exact list in `docs/audit/stitch-74-reconciliation.json`, currently on
  branch `audit/tanmatra-e2e-implementation`, not yet merged or opened as a PR).
- Re-verify and, if needed, re-trigger the Cloud Run deployment so production
  traffic actually matches `main` HEAD.
- Fix the `lint:tokens` violations on `main` (`AccountSubscriptionsClient.tsx`,
  `SymptomsClient.tsx`, and the broader pattern the audit found).
- Root-cause the dish-PDP prerendering/structured-data regression flagged by
  the production synthetic monitor.
- Fix the `bulkhead-perf-nightly` workflow's `pnpm/action-setup` version
  conflict (`version: 9` in the workflow vs. `packageManager: pnpm@9.15.5`
  in `package.json`), which has failed that workflow outright since
  2026-08-05.

This document intentionally does none of the above — it exists only to stop
`main` from asserting a GO status that current evidence contradicts.
