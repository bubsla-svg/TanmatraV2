## Problem Statement
The initial Tanmatra Production Readiness Audit was rejected because it failed to provide authoritative proof of deployment provenance and relied on incorrect baseline assumptions. Specifically, the audit incorrectly mapped the information architecture, treated Stitch prompt states as 1-to-1 page routes, falsely categorized all inline styles and `use client` directives as defects, and most critically, failed to trace the exact Cloud Run deployment chain to prove that the verified source code matches the live application at `tanmatra.food`.

## Solution
Reset the audit process back to the P0 gate. The audit must first establish authoritative deployment provenance (from Git SHA to Cloud Run image digest and traffic allocation). Once provenance is proven, the audit will resume using the approved baselines: the correct 4-tab mobile navigation contract, atomic validation of the 74-entry Stitch manifest (distinguishing states from routes), and targeted evaluations for responsive design, inline styling, and accessibility.

## User Stories
1. As a principal auditor, I want to trace the current Git SHA to an immutable Cloud Run image digest, so that I can definitively prove what code is running in production.
2. As a principal auditor, I want to retrieve the public build-info response from `tanmatra.food`, so that I can independently verify the deployed version without relying on internal tools.
3. As an engineering manager, I want the legacy `tanmatra` SPA deployment to be fully investigated, so that I know exactly how it is used (e.g., image proxy vs. HTML fallback) and can prevent unintended legacy usage.
4. As a developer, I want the `quarantine` directory imports to be verified, so that I can confidently confirm legacy code is not entering the production Next.js bundle.
5. As a UI/UX auditor, I want to map the 74-entry Stitch manifest to actual application states (not just static routes), so that I can accurately report missing UI coverage.
6. As a UI/UX auditor, I want to evaluate responsive design by rendering the app at specific viewports (320px to 1440px), so that I can identify real usability bugs instead of just counting responsive class names.
7. As an accessibility auditor, I want to perform active accessibility tests (focus flow, screen-reader compatibility, zooming), so that I can report genuine accessibility failures rather than just counting `aria-` tags.
8. As a security engineer, I want the audit to cover domain invariants, payment idempotency, and clinical governance, so that the platform meets strict medical and financial compliance standards.

## Implementation Decisions
- The P0 checkpoint must be re-run first, focusing exclusively on application ownership, build provenance, deployment provenance, public production identity, and legacy isolation.
- The `gcloud run services describe` commands will be used (pending authentication) to extract exact deployment metadata.
- The Stitch manifest reconciliation will be tracked as a state matrix rather than a simple static page count.
- The navigation baseline is explicitly defined as `Home, Menu, Plan, Account`.
- The `quarantine` directory is treated as technical debt (P2) since static analysis confirms it is not imported into the production bundle.
- The `<meta name="viewport">` zoom restrictions will remain excluded, and the `16px !important` CSS rule will be investigated for its targeted impact on inputs.

## Testing Decisions
- Deployment tests will involve curling `https://tanmatra.food` and its API endpoints, checking headers (e.g., `x-powered-by: Next.js`) to verify the hosting infrastructure.
- Bundler analysis will be used to ensure `quarantine` code is stripped from the Next.js production build.
- Visual and interaction testing will require manual or playwright-driven verification at specific viewport dimensions to satisfy the responsiveness audit.

## Out of Scope
- Making code modifications to fix identified P2 or P3 defects before the P0 (Deployment Provenance) and P1 (Coverage) audits are definitively passed.
- Completely decommissioning the legacy SPA during this audit phase; we only need to verify its isolation.

## Further Notes
- The audit requires gcloud authentication to gather Cloud Build IDs, image digests, and Cloud Run revision splits. If this environment cannot authenticate, those specific provenance items must remain classified as UNPROVEN.
