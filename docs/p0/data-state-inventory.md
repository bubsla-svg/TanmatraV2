# P0 Data/State Inventory

- Removed 39 fake domain services (e.g. `PricingService.ts`, `CheckoutService.ts`) from `artifacts/tanmatra/src/services/`.
- Data validation and money calculation are natively handled by `artifacts/api-server`.
- Next.js `storefront` correctly uses `lib/*Api.ts` for these states.
