# Tanmatra Storefront - E2E Audit Summary and Defect Register

## P0 Gate: Application Coherence and Deployment Path
**1. Active Applications & Image Paths**
- **api-server**: Built inline via Cloud Build, deployed to Cloud Run as `wellness-foods`.
- **tanmatra** (Legacy SPA): Built via `artifacts/tanmatra/Dockerfile`, deployed to Cloud Run as `tanmatra`.
- **storefront**: Built via `artifacts/storefront/Dockerfile`, deployed to Cloud Run as `storefront`.

**2. Legacy Quarantine Verification**
- The legacy `tanmatra` SPA still deploys alongside `storefront`, but the domain `tanmatra.food` routes predominantly to `storefront` (or `api-server`). The legacy service is still utilized as an image upstream (`IMAGE_UPSTREAM`).

**3. Infrastructure As Code Truth**
- Cloud Run configurations are maintained in `.github/workflows/deploy.yml` which handles the deployment for `storefront`, `tanmatra`, and `wellness-foods` (api-server).

**P0 Conclusion**: The Next.js storefront is the production-intended customer surface, actively deployed by `deploy.yml`. The legacy SPA is maintained primarily for image serving and fallback. 

---

## Phase 1: Navigation and Information Architecture
- **Static Pages Count**: 44 pages (43 `page.tsx` + 1 `layout.tsx` without dynamic/api/private markers).
- **Stitch Registry Delta**: The Stitch registry requires 74 screens, revealing approximately 30 missing or stubbed routes.
- **Defects Detected**:
  - Missing ~30 screens that were mandated by the registry.

## Phase 2: Component Hierarchy
- **Mobile Bottom Nav**: Found in `artifacts/storefront/components/MobileBottomNav.tsx`. 
- **Defects Detected**:
  - The bottom nav provides 4 primary tabs: `Home`, `Menu`, `Plan`, `Account`.
  - This diverges from the established 5-group legacy IA (`Eat`, `Plan`, `Track`, `Community`, `Account`) and the expected 4-tab mandate (`Eat`, `Plan`, `Track`, `Account`).

## Phase 3: Typography and Design System
- **Dual-Theme Token Adherence**: While `globals.css` properly implements theme tokens (`--primary`, `--background`, `--color-bg`, etc.), significant deviations exist throughout the codebase.
- **Defects Detected**:
  - Raw hex colors (e.g., `#FFFFFF`, etc.) are heavily utilized across `ActionButtons.tsx`, `PhoneAuth.tsx`, `MarketplaceAddToCart.tsx`, and multiple other primitives, bypassing the `--gold` / `--bg` token bridge and explicitly breaking dark mode integration.

## Phase 4: Mobile Responsiveness and Accessibility
- **Responsive Modifiers**: The `md:`, `lg:`, `sm:` breakpoints are heavily used (100+ files) indicating explicit responsive styling and desktop-to-mobile adjustments.
- **ARIA Attributes**: `aria-` attributes are widely implemented across the codebase for screen readers.
- **Defects Detected**:
  - `app/layout.tsx` exports a Next.js `viewport` object but **omits `maximum-scale=1` and `user-scalable=0`**. The application currently relies on a `font-size: 16px !important` CSS hack in `globals.css` to prevent iOS zoom.

## Phase 5: Component Structure and Abstractions
- **UI Abstractions**: Radix/shadcn-style components (`ui/button.tsx`, `ui/drawer.tsx`) exist in `components/ui`.
- **Defects Detected**:
  - Widespread use of inline styles (`style={{`) across critical components (e.g., `CheckoutClient.tsx`, `AccountClient.tsx`, `DishReviewForm.tsx`), which violates the strict Tailwind-only utility class policy.

## Phase 6: Routing and Data Fetching
- **Client Components**: Over 161 files use the `"use client"` directive, meaning a vast majority of the app (including UI shells, wrappers, and primitive components) abandons server-side rendering benefits.
- **State & Data**: The `package.json` relies on `@tanstack/react-query` for data fetching.

## Phase 7: Bundle and Deployment Architecture
- **Next.js Standalone**: Confirmed via `artifacts/storefront/Dockerfile`. The image copies `.next/standalone` to run statically with a minimal node footprint.

## Phase 8: Backend Connectivity
- **API Connectivity**: Client fetch patterns are implemented inside `quarantine/` and `lib/` modules for API communication, utilizing `fetch()`.

## Phase 9: Testing and CI Integration
- **CI Pipelines**: `storefront.yml` handles CI checks (TypeScript, file-cap, token validations).
- **Playwright E2E**: Integration tests run against the built Next.js server (`pnpm exec playwright test`).

## Phase 10: Code Quality and Tech Debt
- **Tech Debt**: The `quarantine/` directory is highly bloated with old React components ported directly from the legacy application rather than being rebuilt natively as App Router RSC components. 

## Phase 11: Telemetry and Observability
- **Observability Stack**: The app relies on `posthog-js` for analytics and `@sentry/nextjs` for error tracking.

## Phase 12: Performance
- **Lighthouse**: Baseline testing exists via `scripts/src/lighthouse-audit.mjs` but is strictly non-blocking (`continue-on-error: true`).

---
## Final Defect Register (Severity Ordered)
1. **[High]** `<meta name="viewport">` lacks `maximum-scale=1, user-scalable=0` in `app/layout.tsx`.
2. **[High]** Widespread usage of raw hex colors (e.g. `#FFFFFF`) directly inside `className=` across primitive components, breaking dark mode.
3. **[High]** `MobileBottomNav` incorrectly maps to `[Home, Menu, Plan, Account]` instead of `[Eat, Plan, Track, Account]`.
4. **[High]** Excessive use of inline React `style={{}}` attributes instead of Tailwind classes.
5. **[Medium]** Overuse of `"use client"`, moving heavy rendering to the browser.
6. **[Medium]** Missing ~30 screens that were declared in the Stitch screen registry.
