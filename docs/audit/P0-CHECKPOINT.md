# P0 Checkpoint: Deployment Provenance and Application Identity

## P0-A: Application Ownership
- **Target Application**: Next.js Storefront (`artifacts/storefront`).
- **Target API**: Express API Server (`artifacts/api-server`).
*Status*: PASS for intended source architecture.

## P0-B: Build Provenance
- **Audit target mode**: release-candidate
- **Audited SHA**: `cffbf957f1256fc8e43b0e0d17ee94944e7a341c`
- **Deployed SHA**: `250e5f5966c4642b2295c8fc7ca560a1acef28c5`
- **SHA alignment**: mismatched
- **Exact Dockerfile**: `artifacts/storefront/Dockerfile`.
- **Build Context**: `.` (Root of repository, required for turborepo/workspace dependencies).
*Status*: PARTIAL (Dockerfile and context identified, but candidate and deployed SHAs differ).

## P0-C: Deployment Provenance
- **Public domain mapping**: `tanmatra.food`.
- **DNS Resolution**: `tanmatra.food` resolves to `8.232.8.142`.
- **Immutable image digest**: `sha256:7d7997808736b458394ebaa07c5f1cb09b8317282aea9725eb7ae5f73ae7e955` (from `storefront:250e5f5966c4642b2295c8fc7ca560a1acef28c5`).
- **Cloud Run service, region and revision**: `storefront` in `asia-south2`, revision `storefront-00081-pz5`.
- **Traffic allocation**: 100% to latest revision `storefront-00081-pz5`.
*Status*: PASS (Deployment provenance verified via internal GCP credentials).

## P0-D: Public Production Identity
- **Public Domain Headers**: `curl -I https://tanmatra.food` returns `x-powered-by: Next.js`.
- **UI Evidence**: Next.js headers prove production serves a Next.js application, not the legacy Vite-based SPA.
- **Public build-info response**: `/api/build` relies securely on `process.env.BUILD_SHA`, injecting the candidate SHA at deployment rather than hardcoding it in source.
- **Identity Confirmed**: Production identity is externally confirmed as Next.js, but visual rendering of the complete Stitch UI remains unverified against the live public endpoint.
*Status*: PARTIAL PASS (Next.js storefront externally identified; Stitch visual adoption unproven).

## P0-E: Legacy/Quarantine Isolation
- **Import Graph Evidence**: Searches for `quarantine` across `artifacts/storefront/app`, `components`, and `lib` yielded 0 active imports.
- **Compiler/Alias Exclusion**: `artifacts/storefront/tsconfig.json` explicitly excludes `"**/quarantine/**/*"`.
- **Production Output Validation**: Scanned the `.next` production bundle directory; `quarantine` references are 0.
- **Legacy Service Boundary**: Investigated `artifacts/storefront/next.config.ts`. The legacy SPA is used strictly as an `IMAGE_UPSTREAM` restricted entirely to the `/images/:path*` prefix. It cannot serve HTML routes or Javascript bundles to customer routes.
*Status*: PASS (Source imports absent; production bundle and upstream boundary verified).

## P0-F: Atomic 74-Entry Manifest Reconciliation
The Stitch generation target is exactly 74 prompts. These 74 prompts do *not* map one-to-one to static page files; they consist of routes, wizard stages, bottom sheets, drawers, loading states, error states, empty states, recovery states, component states, and design-system references.
*Status*: NOT STARTED (Pending atomic ledger creation).

## P0-G: Navigation Baseline
The audited mobile navigation contract is:
- **Home**    → `/`
- **Menu**    → `/menu`
- **Plan**    → `/plans`
- **Account** → `/account`
*Status*: PASS as specification baseline; runtime verification pending.

## P0-H: Phase Map Directive
The audit will proceed strictly according to the approved phase structure:
- **P0**: Clean state
- **Phase 1**: Dual-theme design system
- **Phase 2**: Shells, routing and session
- **Phase 3**: Core commerce
- **Phase 4**: Subscription discovery
- **Phase 5**: Recommended plan configuration
- **Phase 6**: Custom Build
- **Phase 7**: Checkout and orders
- **Phase 8**: Meal Planner and subscriptions
- **Phase 9**: Account and telemetry
- **Phase 10**: Wearables
- **Phase 11**: Acquisition and entitlements
- **Phase 12**: Clinical care and RD
- **Phase 13A**: Traceability
- **Phase 13B**: Human acceptance
*Status*: PASS.

---

## P0 Audit Verdict
**P0 CHECKPOINT:** CONDITIONAL PASS FOR AUDIT CONTINUATION
**P0 FINAL GATE:** NOT PASSED
**PRODUCTION ACCEPTANCE:** NO-GO
