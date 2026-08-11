# Final reconciliation summary

Assessed against §24's programme-level Definition of Done. This sweep is a
**Phase 0–2 deliverable set** (evidence freeze, inventory, mapping) — Phases 3–8 of
`implementation-plan.md` are proposed, not executed. No application code was
changed to produce any file in this directory.

## §24 checklist

| Requirement | Status |
|---|---|
| Every Stitch entry has a normalized classification | **Done** — `stitch-manifest.normalized.json`, all 74 |
| Every approved entry has a code mapping | **Done** — `stitch-code-matrix.json`, all 74 (54 ACTIVE_MATCH, 18 MISSING_IMPLEMENTATION, 1 ACTIVE_PARTIAL, 1 PREBUILT_UNWIRED) |
| Every route/state/overlay distinction is explicit | **Done** — `SCREEN_OR_STATE` field per entry, derived from the manifest's `artifactType`, not asserted |
| Every reusable implementation has been assessed | **Partial** — the mechanical sweep + 12 manual verifications cover the areas named in the sweep's own context; a full symbol-by-symbol reuse assessment of all 72 zero-caller `lib/` exports was not completed (28 zero-importer components were, see `prebuilt-component-inventory.md`) |
| Every finished-but-unwired critical feature is either connected or formally rejected with evidence | **Not yet — this is Phases 4–7's job.** This sweep identifies and evidences 16 defects (`defects.md`) but connects none of them; that is out of scope for a "do not modify code" inventory pass |
| No approved screen is represented solely by quarantined code | **Verified true** — every quarantined route/component checked either has a newer active equivalent already wired, or is recorded as a restoration candidate in `prebuilt-component-inventory.md` §C, not silently left as the only implementation |
| No production navigation targets excluded pages | **FALSE — 9 confirmed dead links + 5 confirmed placeholder routes, 2 reachable from general nav** (`/team`, `/corporate`). See `route-reconciliation.md`, DEF-RECON-DEADLINKS-001, DEF-RECON-PLACEHOLDERS-001. |
| No revenue CTA terminates without a valid outcome | **FALSE — confirmed 3 distinct cases**: the trial CTA dead-ends with a non-empty cart (DEF-RECON-TRIALCTA-001), the zero-payable checkout path 409s with no recovery (DEF-RECON-ZEROPAYABLE-001), the pantry "Add to Subscription" button has no handler (DEF-RECON-PANTRY-001). |
| No arbitrary clinical route renders unapproved claims | **FALSE — confirmed.** `/care/[condition]` synthesizes clinical-sounding copy for any slug (DEF-RECON-CARECONDITION-001), against a documented but conflicting prior product ruling. |
| No supported cart item lacks an authoritative completion path | **Unresolved — flagged, not confirmed either way.** Marketplace items add to the shared cart; whether `/checkout` silently filters them or mishandles them was not traced to a conclusion in this pass (see `service-authority-map.md`'s marketplace section). |
| Zero-payable orders do not invoke a payment gateway unnecessarily | **FALSE — confirmed the inverse defect**: the gateway call IS invoked unconditionally and fails; see DEF-RECON-ZEROPAYABLE-001. |
| Journey 2 uses the shared plan review system | **N/A yet** — Journey 2 does not exist as specified; nothing to check for shared-system usage. |
| Journey 4 uses the persisted state machine and shared plan review system | **N/A yet** — Journey 4 does not exist in any form, including quarantine. |
| Backend authority remains intact | **Mostly true, one exception.** Pricing/tax/allergen-safety/payment-signature authority all confirmed server-side. The one gap is procedural, not a boundary violation: the client doesn't know how to *react* to the server's own zero-payable signal (DEF-RECON-ZEROPAYABLE-001) — the server is still the one deciding, the client just has no branch for that decision. |
| Plan checkout gates remain intact until acceptance | **True** — confirmed still gated, and now additionally correct-by-necessity since Journey 2's configuration UI doesn't exist yet either. |
| Required tests block regressions in CI | Not assessed in this pass beyond confirming `lint:test-reach`'s existence (referenced in CLAUDE.md); not re-verified against the new findings here since nothing was fixed yet. |
| Visual fidelity is measured only against available approved references | **True by omission** — no visual fidelity claims were made in this pass at all; see `visual-evidence.md`. |
| Missing evidence remains explicitly NOT VERIFIED | **Honored throughout** — every claim in this deliverable set is either evidenced with a file:line citation or explicitly marked NOT VERIFIED / BLOCKED BY ENVIRONMENT / BLOCKED BY PRODUCT DECISION. No PASS was asserted without evidence. |

## Reading the result

The programme is **not done**, and this sweep does not claim otherwise. What it
establishes: the "finished but unwired" diagnosis in the task's framing is
correct and now has file-level evidence for six distinct clusters (zero-payable
checkout, marketplace payment, group orders, dish reviews, 9.2, 10.9) — plus three
findings the original framing didn't name but the sweep surfaced anyway (the
`/corporate` route-ruling inversion, the 5-route placeholder cluster including
`/team`, and the trial-CTA/FocusLayout dead end). Two structural gaps
(Journey 2, Journey 4) are confirmed **not** finished-but-unwired — they are
genuinely absent, including from quarantine, and need `REBUILD_MINIMALLY` per
§6's reuse framework, not a wiring fix.

## Immediate next actions (see `implementation-plan.md` for the full sequence)

1. Three decision gates block Phase 3 before any restoration code is written:
   the care-condition allowlist conflict, the `/corporate` canonical-route
   inversion, and the `/wellness` link-target question. These need
   product/clinical ownership, not this sweep.
2. Phase 4's revenue blockers (zero-payable, trial CTA, pantry CTA, marketplace,
   group orders) have no decision gates — they're ready to implement once
   prioritized.
3. Journeys 2 and 4 (Phases 5–6) are the largest remaining body of work and
   depend on each other (§11 requires Journey 4 to reuse Journey 2's review
   system) — sequence Journey 2 first.
