# Replacement-screen decisions — contract-equivalence review

Decision date: 2026-08-10 · Owner: chandan · Reviewed at `feat/stitch-manifest-v2` (base `214bf99`).

Governance rule applied (owner, 2026-08-10): *a replacement may replace a Stitch
entry only when it preserves the approved route purpose, customer task,
interaction contract, domain authority, and recovery behavior. Approve when
task-contract equivalent; rebuild when a required task or safety contract was
removed; never approve solely because the replacement already shipped.*

Outcomes: **R1** approve replacement · **R2** temporary partial · **R3** rebuild.

## Group 1 — Plan configuration (6.3, 6.4, 6.7) → R3 REBUILD

| Criterion | Original (approved journey) | Shipped (`components/plans/PlanBuilder.tsx`) | Equivalent? |
|---|---|---|---|
| Customer task | Configure a generated week: see every meal, keep/shuffle/change dishes, edit accompaniments, set schedule | Pick duration + broad options; no lineup ever shown | **No** |
| Canonical route | `/plan/[planId]` | `/plan/[planId]` | Yes |
| Layout | FocusLayout | FocusLayout | Yes |
| Primary action | Generate → review lineup → continue to quote | Continue with unseen meals | **No** |
| Trigger/continuation | lineup-active state machine (Keep/Shuffle/Undo/Change Dish) | none of these states exist | **No** |
| Backend authority | A2 plan-draft contracts (generation, lineup, undo, schedule, quote) — **merged, PRs #29–#34** | not consumed; hardcoded delivery copy | **No** |
| Loading/error/recovery | generating → lineup_ready / generation_failed | absent | **No** |
| Safety/financial/disclosure | allergen-constrained swaps; per-duration pricing disclosure | constraint edits impossible; partial pricing | **No** |

Verdict: removes core tasks and recovery states → **rebuild**. The rebuild track
already exists: Journey 2 UI over the merged A2 contracts. Entries 6.5, 6.6,
14.3, 14.4 (change-dish, accompaniments, generation loading/error) are classed
`missing` and land with the same rebuild.

## Group 2 — Custom build (7.2–7.10) → R3 REBUILD

| Criterion | Original (approved journey) | Shipped (`components/custom/CustomBuildHub.tsx`) | Equivalent? |
|---|---|---|---|
| Customer task | 6-stage guided plan build: goal → routine → wearable → preferences → intensity → duration+renewal → review → generated plan → pre-checkout | Single dish-customisation hub | **No** |
| Trigger/continuation | staged wizard with entry/back/validation per stage (`CustomBuildStage`) | no stages, no state machine | **No** |
| Backend authority | plan generation + server quote | none | **No** |
| Safety/disclosure | hard-allergen vs soft-dislike split; explicit renewal choice | absent | **No** |
| Recovery | generating / generation-failed | absent | **No** |

Verdict: the approved journey does not exist in any form → **rebuild** (Journey 4
track, against the same A2 contracts).

## Manifest encoding

All 12 entries: `designDisposition: "rebuild-required"`,
`replacementDecision.status: "rebuild"` with the shipped stand-in recorded as
`interimImplementation`, `proof.sourceDefinition: "missing"` (the original
design), defects `DEF-J2-PLANCONFIG-001` / `DEF-J4-CUSTOMBUILD-001`. The interim
components stay live in production until each rebuild lands — this document is
the record that their presence is **not** acceptance.

## Also recorded during this review

- 0 of 74 `referenceArtifact` paths (`artifacts/stitch/reference/*.png`) are
  committed. Owner action: export the Stitch references into the repo (or amend
  the manifest to point at the canonical external store). Verifier treats this
  as warn-only until decided.
- Post-BUILD-GAP deltas honestly reclassified: 9.2 (`ManageDeliverySheet`
  shipped but on `/account/subscriptions`, reduced actions → partial),
  14.6 (inline verifying label → partial), 14.7 (`UnresolvedPaymentPanel`
  wired → wired), 11.1 (`/metabolic` renders a placeholder → partial).
