# Visual evidence index

Per §16: "Visual matching begins only after the functional mapping is understood."
This sweep completed the functional mapping (`stitch-code-matrix.json`); visual
reconciliation itself was **not performed** in this pass, for two compounding
reasons recorded here rather than silently skipped.

## Why visual evidence is NOT VERIFIED, not PASS, for this pass

1. **No live runtime was stood up in this sweep.** Phase 0 ran typecheck/unit/build
   only — no dev server, no Playwright, no screenshot capture. `docs/stitch/
   stitch-screen-manifest.json`'s own `evidence` arrays (where populated) record
   prior sessions' captures against `http://127.0.0.1:3001` with named viewport/
   theme/sha — this sweep did not repeat that work.
2. **Governance gap carried from `environment.md`**: no per-entry Stitch
   approval-status field exists, so even where a reference image is present
   (`referenceArtifact` in the manifest), this sweep cannot mechanically confirm
   the reference itself is still the current approved target versus a superseded
   exploration.

## What the manifest already carries (inherited, not re-verified this pass)

Every one of the 74 entries has a `referenceArtifact` path
(`artifacts/stitch/reference/<id>.png`) and an `implementationArtifacts.dark` path
(`artifacts/stitch/storefront/<id>.png`) recorded in the manifest schema. Per-entry
`proof.visualApproval` and `proof.accessibilityApproval` are `pending` for the
overwhelming majority of entries — only entries carrying prior explicit evidence
records (e.g. 9.2's `local-runtime` evidence block, recorded 2026-08-10) have
anything beyond `pending`. This sweep did not change any of those fields — see
`stitch-manifest.normalized.json`/`stitch-code-matrix.json` for the exact current
state per entry, inherited verbatim from `docs/stitch/stitch-screen-manifest.json`.

## Per §16 rules this sweep did not violate

- No arbitrary pixel values were introduced to force screenshot similarity (no
  visual work was done at all).
- No desktop frame was used as evidence for mobile fidelity (no frames were
  compared).
- Where a reference image's currency is unconfirmed (the governance gap above),
  visual fidelity is recorded as **NOT VERIFIED**, not PASS, consistent with the
  audit's absolute evidence rule.

## Required before real visual reconciliation can start

1. Resolve the governance gap (approval-status field or a signed-off screen list).
2. Stand up a live local build (`run_e2e.sh` per the prior audit, or
   `next build && next start` with `E2E_CHROMIUM_PATH` pointed at the pre-installed
   Chromium in a sandboxed environment).
3. Capture screenshots for the specific viewport/theme combinations each manifest
   entry declares (`viewport`, `themes` fields — most entries are `dark`-only at
   390×844).
4. Compare against `referenceArtifact`, recording `proof.visualApproval` per entry
   — never inferring PASS from a component name or a 200 status, per §2 and §23.

This index exists so a future pass has a starting checklist rather than rediscovering
that visual work was never done.
