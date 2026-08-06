# Legacy Quarantine

> P0 §24 deliverable. Baseline SHA `3aea38dc` (`main`, 2026-08-06).

**Contract status: PASS.** This is the one P0 area that checks out cleanly
end-to-end, and was independently reconciled by the prior audit
(`audit/tanmatra-e2e-implementation`) as well.

## 1. What "quarantine" means here

P0 permits retaining superseded implementation files in the tree — for
history, for possible salvage, for diffing against a restore — provided they
are (a) excluded from the TypeScript project and build, and (b) imported by
nothing that ships. Retention is allowed; reachability is not.

## 2. What is quarantined

Two separate trees, both under `artifacts/storefront`:

| Location | Files | Contents |
|---|---:|---|
| `quarantine/app/` | 75 | Pre-`925104f2` route implementations, mirroring the `app/` tree by route name (`quarantine/app/checkout`, `quarantine/app/plan`, `quarantine/app/corporate`, …) |
| `quarantine/components/` | 142 | The components those routes depended on |
| `components/quarantine/menu/` | 16 | A second, smaller pocket — pre-restore dish/PDP components (`DishGallery.tsx`, `DishReviews.tsx`, `ProductDetailView.tsx`, `SaveToVaultButton.tsx`, …) |
| **Total tracked** | **234** | `git ls-files artifacts/storefront \| grep quarantine \| wc -l` |

Two roots rather than one is a minor inconsistency worth naming (a future
consolidation pass could merge `components/quarantine/menu/` into
`quarantine/components/menu/`), but it does not weaken isolation — both
match the same exclusion pattern (§3) and both were confirmed unimported
(§4).

## 3. Build-time exclusion

```json
// artifacts/storefront/tsconfig.json:44
"exclude": [..., "**/quarantine/**/*"]
```

The glob matches any path with a `quarantine` path segment followed by more
path segments — it catches both roots above in one rule.
`next.config.ts` has no separate quarantine exclusion and needs none: Next's
App Router only picks up `page.tsx`/`layout.tsx`/`route.ts` files that live
under `app/`'s own directory tree at a route-eligible path, and
`quarantine/app/*` is not nested inside the real `app/` directory — it's a
sibling — so it was never route-eligible in the first place. The `tsconfig`
exclusion is what keeps it out of typecheck and IDE tooling.

## 4. Zero live imports — verified directly, not asserted

```bash
$ grep -rn "quarantine" --include=*.tsx --include=*.ts app components lib \
    | grep -v "\.test\."
# 0 results
```

No file under `app/`, `components/`, or `lib/` — outside the quarantine
trees themselves — references a quarantine path. This was re-run for this
deliverable, not carried over from the prior audit's number (which reported
217, counting only the primary `quarantine/` root; 234 is the corrected
total across both roots).

## 5. A related, smaller orphan: `lib/quarantine.ts`

Not part of the quarantine tree — a name collision. `lib/quarantine.ts`
implements `VocabularySanitizer`, a banned-aggregator-terminology checker
(rejects strings like *"pick a restaurant"*, *"compare providers"* in favour
of *"choose your meal plan"*, *"rd-reviewed"*) for the sole-operator
positioning P0 requires. It is a real, non-quarantined, non-excluded file —
and it has **zero importers** anywhere in `app/`, `components/`, or `lib/`.
The terminology rule it encodes is not wrong; it simply isn't enforced
anywhere. Distinct from, but the same *shape* of problem as, the orphaned
`clinical-governance-engine` package documented in
[`clinical-scope.md`](./clinical-scope.md) §1.2 — a safety/compliance
mechanism was built and then never connected to the code path it was meant
to guard.

## 6. Summary

| Check | Result |
|---|---|
| Quarantined files tracked in git | 234 |
| Imports from live source into quarantine | 0 |
| tsconfig exclusion present and covers both roots | Yes (`tsconfig.json:44`) |
| Reachable in `.next/server` build output | Not reachable (excluded at typecheck, never route-eligible) |
| P0 permits retention | Yes, provided isolation holds — it does |
