# Tanmatra E2E (Playwright)

This directory contains the automated Playwright end-to-end test suite for the Tanmatra storefront and checkout pipeline.

## Structure

- `specs/storefront_checkout_audit.spec.ts`: High-velocity audit suite covering 5 critical verification vectors:
  1. **Render Verification**: Macro-nutrient strip rendering & absence of verification placeholder banners.
  2. **Modifier Math**: Complex protein modifier selection and sticky bottom CTA ledger calculation precision.
  3. **Upsell & Cart Sync**: Cart drawer upsells, parent-child product isolation, and quantity badge synchronization without state resets on drawer close.
  4. **Authentication & Routing**: Unauthenticated `/checkout` redirection to `/login`, phone OTP mock verification, and token synchronization without loops.
  5. **Map Integration**: Third-party map location picker canvas rendering without timeout or CDN loading errors.

## Running the Suite

Ensure local dependencies are installed:
```bash
pnpm --filter @workspace/tanmatra add -D @playwright/test
pnpm --filter @workspace/tanmatra exec playwright install chromium
```

Run the storefront audit spec against a local dev server:
```bash
# Start Vite server on port 5190 and execute test suite
pnpm --filter @workspace/tanmatra exec playwright test e2e/specs/storefront_checkout_audit.spec.ts
```

Run against staging / live target:
```bash
E2E_BASE_URL=https://tanmatra.food pnpm --filter @workspace/tanmatra exec playwright test e2e/specs/storefront_checkout_audit.spec.ts
```
