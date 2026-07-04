# Original User Request

## Initial Request — 2026-07-03T20:51:22Z

Execute and verify **Phase 1 (0–30 Days: Immediate P0 Launch Blockers)** of the Tanmatra Production-Readiness Remediation Roadmap across the full stack (React/Vite client, Express/OpenAPI backend, and Drizzle/PostgreSQL schema layer).

Working directory: /usr/local/google/home/chandansinghr/wellness_foods
Integrity mode: development

---

## Role & Operating Mode
You are acting as an autonomous engineering remediation taskforce comprising:
1) Lead Clinical & Backend Systems Engineer (Node.js/Express, Drizzle ORM, OpenAPI),
2) Principal Fintech & Payment Security Engineer (Idempotency, Double-Entry Accounting, Razorpay),
3) Indian Privacy & Security Engineer (DPDPA 2023 Consent Schemas, KMS Envelope Encryption).

Your mission is to implement, test, and verify the four mandatory Phase 1 remediation packages (`REM-V1-01`, `REM-V2-01`, `REM-V5-01`, and `REM-V5-02`) identified in the Tanmatra Production Audit Report directly inside the project workspace `/usr/local/google/home/chandansinghr/wellness_foods`. Every implementation must be clean, runnable, fully typed, and verified against objective acceptance criteria.

---

## Requirements

### R1. Deterministic Allergen & Contraindication Gate (`REM-V1-01`)
- What to build: Implement server-side deterministic intersection validation in Express/OpenAPI middleware and Drizzle ORM queries that blocks any meal recommendation or order checkout if an item's ingredients intersect with the user's saved allergens or hard clinical contraindications (e.g., CKD Stage 3 + severe T2D).
- Client integration: Ensure the React/Vite search palette (`⌘K`) and daily schedule preview dynamically filter or auto-swap blocked dishes before payment submission.

### R2. DPDPA 2023 Consent Capture & KMS Envelope Encryption Baseline (`REM-V2-01`)
- What to build: Create explicit DPDPA click-wrap consent capture components and Drizzle database schema (`user_consents`) with purpose-scoped toggles (clinical delivery, marketing, AI personalization) and immutable timestamps.
- Data security: Implement an envelope encryption wrapper utility in the backend (`lib/crypto` or equivalent) ready to encrypt sensitive clinical attributes at rest using AES-256-GCM prior to database persistence.

### R3. Immutable Double-Entry Ledger Schema Initialization (`REM-V5-01`)
- What to build: Implement robust Drizzle ORM schemas (`ledger_accounts`, `ledger_journal_entries`, and `ledger_lines`) supporting immutable double-entry bookkeeping with cryptographic SHA-256 hash chaining between sequential entries.
- Tax & liability breakdown: Include explicit account segregation for CGST, SGST, IGST liability, promotional subsidies, and customer wallet liabilities.

### R4. Network-Unstable Idempotency & Webhook Inbox Pattern (`REM-V5-02`)
- What to build: Implement client-side `Idempotency-Key` (UUIDv4) generation on payment and checkout requests in the React app.
- Backend enforcement: Implement Express middleware enforcing 24-hour distributed locks (`SETNX`) on idempotency keys, strict Razorpay HMAC-SHA256 webhook signature verification, and a PostgreSQL `webhook_inbox` ingestion table decoupled from immediate synchronous processing.

---

## Acceptance Criteria

### Objective Verification & Audit Rigor
- [ ] Automated Test Scripts: Write and run automated TypeScript / Jest / Vitest test scripts verifying deterministic allergen rejection (`REM-V1-01`) and double-entry accounting math (`REM-V5-01` where `SUM(debits) === SUM(credits)`).
- [ ] Idempotency & Webhook Verification (`REM-V5-02`): Create standalone verification scripts or mock server runners demonstrating that duplicate checkout requests with identical `Idempotency-Key` headers produce exactly one order/payment intent, and verifying Razorpay HMAC-SHA256 signature checks.
- [ ] DPDPA Schema & Envelope Encryption (`REM-V2-01`): Verify Drizzle models and encryption wrappers cleanly support granular DPDPA purpose consents and AES-256-GCM encryption formatting.
- [ ] Zero Compilation / Typecheck Errors: Run `pnpm typecheck` (or package-specific type checks) across the workspace to ensure zero TypeScript compilation or type errors.
