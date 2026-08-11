# Environment inventory

Phase 0 evidence freeze. No application code was modified to produce this record.

## Repository state

| Field | Value |
|---|---|
| Repository root | `/home/user/Wellness-Foods` |
| Active branch | `claude/stitch-wiring-92-109` |
| Starting commit | `308f9ded8004101637f30134972d250b52b94c90` — "Merge pull request #59 from tanmatra6-wq/claude/tanmatra-e2e-ux-ui-audit-63tfdo" (2026-08-11 16:34:38 +0530) |
| Working tree | Clean at freeze time |
| Remote | `https://github.com/tanmatra6-wq/Wellness-Foods` |
| Package manager | pnpm 9.15.5 (`packageManager: pnpm@9.15.5` in root `package.json`; root `preinstall` rejects npm/yarn) |
| Node | v22.22.2 |
| Frontend framework | Next.js 16 App Router (`artifacts/storefront`); legacy customer SPA on React 19 + React Router v7 + Vite (`artifacts/tanmatra`, now admin/RD-only) |
| Backend framework | Express 5 (`artifacts/api-server`) |
| Sparse checkout | None active — full tree materialized (`git sparse-checkout list` returns empty) |

## Workspace packages (`pnpm-workspace.yaml`)

`artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts`. Tracked `artifacts/` directories at HEAD: `agents`, `api-server`, `audit`, `mockup-sandbox`, `storefront`, `tanmatra-mobile`, `tanmatra`.

## Sources of truth located

| Artifact | Path |
|---|---|
| 74-screen Stitch manifest | `docs/stitch/stitch-screen-manifest.json` |
| Stitch defect register | `docs/stitch/stitch-defect-register.md` |
| Stitch acceptance report | `docs/stitch/stitch-acceptance-report.md` |
| Replacement/superseded-screen decisions | `docs/stitch/replacement-screen-decisions.md` |
| Design tokens | `lib/tokens/src/tokens.css` |
| OpenAPI contract | `lib/api-spec/openapi.yaml` |
| Prior E2E/UX audit | `docs/audit/E2E-UX-UI-FIDELITY-AUDIT-2026-08-11.md` |
| Multi-agent working agreement | `docs/AGENT_WORKING_AGREEMENT.md` |
| Domain cutover record | `docs/DOMAIN-CUTOVER.md` |

No approval-status field exists on individual Stitch manifest entries (see **Governance gaps** below) — approval is asserted at the manifest/programme level, not per screen.

## Route rulings in force (per prior owner rulings, carried into this sweep)

- `/quick-setup` canonical; `/quiz` redirects to it.
- `/login` canonical; `/auth` redirects to it.
- `/menu/[productSlug]` canonical; `/dish/[slug]` redirects to it.
- `/corporate` canonical; `/corporate-wellness` redirects to it.
- Mobile tabs: Home, Menu, Care, Account.
- Later written rulings supersede Stitch screens where they conflict.

## Governance gaps (missing input, per the audit's own protocol)

> MISSING INPUT: Per-entry Stitch approval-status field.
> IMPACT: Cannot mechanically distinguish "approved production target" from "visual exploration" at the individual-screen level; the matrix in this sweep treats every non-design-system-reference entry as an approved target by default, consistent with the manifest's programme-level framing, and flags this gap rather than silently asserting approval.
> AFFECTED SCREENS: All 74.
> WHAT CANNOT BE VERIFIED: Whether any specific screen was later deprecated at the design-review level without a corresponding manifest edit.
> REQUIRED EVIDENCE: An approval-status column/field per manifest entry, or a signed-off screen list from design ownership.

## Tooling run (evidence, verbatim exit codes)

All commands run from repo root, no code changes made before or during the run.

| Command | Result |
|---|---|
| `pnpm run typecheck` | **PASS** — exit 0, 0 errors across all workspace packages (`lib` project refs + all artifact packages) |
| `pnpm --filter @workspace/storefront run test` | **PASS** — 607/607, 0 fail, 17.3s |
| `pnpm --filter @workspace/storefront run build` | **PASS** — exit 0, full route manifest emitted (61 routes built) |
| `pnpm --filter @workspace/tanmatra run test` | **PASS** — 124/124, 0 fail |
| `pnpm --filter @workspace/api-server run test` | **FAIL (environment-blocked)** — 505 pass / 153 fail / 7 cancelled of 665. All 153 failures trace to `Error: DATABASE_URL must be set` (119 occurrences) or `ECONNREFUSED` (Redis, 11 occurrences) — no Postgres or Redis is provisioned in this sandbox. Zero failures reference application logic. Classified **BLOCKED BY ENVIRONMENT**, not FAIL, per §18.4's classification vocabulary. Not re-run against a provisioned DB in this pass — see `verification-report.md` for the reproduction command. |

CLAUDE.md itself documents `DATABASE_URL` as dev-only/required-in-production, consistent with this being an environment gap rather than a regression.

## Note on the codebase's own sparse-checkout caveat

CLAUDE.md warns that agent workspaces are often sparse checkouts where `ls artifacts/` under-reports what is tracked, because packages can be marked skip-worktree. This workspace was checked with `git sparse-checkout list` (empty — full checkout) and `git ls-tree -d --name-only HEAD artifacts/` (7 directories, matching disk) — **not** sparse. This inventory is not affected by that caveat, but future re-runs of this sweep should re-check both before relying on `ls`.
