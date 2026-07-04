# Project: Tanmatra Phase 1 Production Readiness Remediation

## Architecture
- **Database Layer**: `lib/db` using Drizzle ORM (`drizzle-orm/node-postgres`) connected to PostgreSQL. All tables are defined in `lib/db/src/schema/*.ts` and exported via `lib/db/src/schema/index.ts`.
- **Backend API Layer**: `artifacts/api-server` using Node.js/Express and OpenAPI/Zod schemas (`lib/api-spec`, `lib/api-zod`).
- **Client Frontend Layer**: `artifacts/tanmatra` using React 19, Vite, and Tailwind CSS.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | REM-V1-01: Allergen & Contraindication Gate | Express middleware, Drizzle queries, React search & schedule filter | none | DONE |
| 2 | REM-V2-01: DPDPA Consent & KMS Encryption | `user_consents` schema, click-wrap UI, backend AES-256-GCM wrapper | none | DONE |
| 3 | REM-V5-01: Double-Entry Ledger Schema | `ledger_accounts`, `ledger_journal_entries`, `ledger_lines` schemas with SHA-256 hash chaining | none | DONE |
| 4 | REM-V5-02: Idempotency & Webhook Inbox | `Idempotency-Key` header, Express 24h lock SETNX middleware, Razorpay HMAC check, `webhook_inbox` schema | none | DONE |

## Interface Contracts & Code Layout
- Schema files must be created in `lib/db/src/schema/<name>.ts` and re-exported in `lib/db/src/schema/index.ts`.
- Backend middleware/routes reside in `artifacts/api-server/src/middlewares/` and `artifacts/api-server/src/routes/`.
- Automated test scripts should be executable and verified against `pnpm test` or standalone scripts in `scripts/` or test files inside the packages.
- Zero compilation/typecheck errors verified via `pnpm typecheck` from workspace root.
