# P0 §24 Deliverables

The 13 files in this directory are the P0 runbook's required Go/No-Go
evidence set, generated against `main` at `3aea38dc` (2026-08-06). None of
these existed before this change — the runbook was previously unimplemented
end-to-end (see [`p0-baseline.json`](./p0-baseline.json) `deliverables`).

**Verdict: NO-GO.** Full reasoning in [`p0-baseline.json`](./p0-baseline.json).
The blocking trigger is layout ownership — see
[`layout-contracts.md`](./layout-contracts.md).

## Reading order

1. [`p0-baseline.json`](./p0-baseline.json) — start here. The verdict, every
   gate result, and links into the detail docs below.
2. [`application-ownership.md`](./application-ownership.md) — which app owns
   which surface.
3. [`route-contract.md`](./route-contract.md) /
   [`routes.json`](./routes.json) — the 58-route table and its two blocking
   defects.
4. [`layout-contracts.md`](./layout-contracts.md) /
   [`layout-assignments.json`](./layout-assignments.json) — the NO-GO
   trigger itself.
5. [`domain-boundaries.md`](./domain-boundaries.md) — where each domain's
   logic actually lives, and where that boundary is crossed.
6. [`domain-invariants.md`](./domain-invariants.md) /
   [`domain-invariants.json`](./domain-invariants.json) — the 20
   non-negotiable invariants, re-graded against shipped code rather than
   test-file self-assertions.
7. [`clinical-scope.md`](./clinical-scope.md) — what "clinical" actually
   means on this SHA, including the orphaned `clinical-governance-engine`
   package.
8. [`privacy-analytics-contract.md`](./privacy-analytics-contract.md) — the
   analytics allowlist that exists only inside a test file.
9. [`deployment-provenance.md`](./deployment-provenance.md) — production
   drifted 22 commits behind `main` earlier in this verification pass, and
   caught up mid-session; both states are recorded with evidence.
10. [`legacy-quarantine.md`](./legacy-quarantine.md) — the one area that
    passes cleanly.

## Regenerating

`routes.json` and `layout-assignments.json` are generated from the live
route matchers (`lib/focusRoutes.ts`, `lib/internalSurfaces.ts`,
`lib/stitchRoutes.ts`, and a verbatim reimplementation of
`components/B2BLayout.tsx#isB2BRoute`, which cannot be imported directly
since it's a client component), not hand-maintained. Re-run against a new
SHA by walking `find artifacts/storefront/app -name page.tsx` and re-evaluating
each route through those matchers — see the `generatedFrom.method` field in
each JSON file for the exact approach. The nine markdown files are manual
writeups; re-verify their evidence against the new SHA rather than assuming
they still hold.
