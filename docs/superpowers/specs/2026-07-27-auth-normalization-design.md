# Auth Normalization Design Spec
**Date:** 2026-07-27
**Status:** Proposed

## 1. Context and Problem Statement
A granular architecture audit revealed that several API route handlers violate the core architecture coherence contract regarding authentication. 

Specifically:
1. **Shadowed `requireAuth`**: `b2bPlanner.ts`, `corporate.ts`, and `groupOrders.ts` define local `requireAuth` functions that shadow the canonical implementation. The local versions return an object (`{id, email}`) whereas the canonical `middlewares/requireAuth.ts` returns a string (userId) or null.
2. **Legacy Admin Checks**: `aiRuns.ts`, `b2bPlanner.ts`, `challenges.ts`, and `community.ts` re-implement admin gating by checking a legacy `req.session.isAdmin` flag. This diverges from the canonical `requireOps` / `isOpsRequest` from `lib/adminGate.ts`, meaning these routes accept a different credential set than standard ops routes.

## 2. Proposed Solution

### 2.1 Standardize Customer Auth
- **Target Files**: `artifacts/api-server/src/routes/b2bPlanner.ts`, `corporate.ts`, `groupOrders.ts`.
- **Changes**: 
  - Remove the local `requireAuth` implementations.
  - Import and use `requireAuthUser` from `middlewares/requireAuth.ts`.
  - Where the route requires the user's email, fetch the user record from the database using the returned `userId`.

### 2.2 Standardize Admin/Ops Auth
- **Target Files**: `artifacts/api-server/src/routes/aiRuns.ts`, `b2bPlanner.ts`, `challenges.ts`, `community.ts`.
- **Changes**:
  - Remove legacy `req.session.isAdmin` checks.
  - Import and use the canonical `requireOps` middleware from `lib/adminGate.ts`.

## 3. Implementation Plan
1. **Refactor Admin Auth**: Replace legacy admin checks with `requireOps` in the 4 target files.
2. **Refactor Customer Auth**: Replace shadowed `requireAuth` with `requireAuthUser` in the 3 target files. Add DB fetches for emails where necessary.
3. **Verify**: Run `pnpm run typecheck` and `pnpm run lint:test-reach`. Run test suites for the modified routes.

## 4. Self-Review
- *Does this align with the `architecture-coherence.md` contract?* Yes, it specifically targets known technical debt identified in the contract's "Known idiom divergences" section.
- *Does it maintain the separation of concerns?* Yes, standardizing auth relies on existing canonical middlewares.
- *Are there edge cases?* Some B2B routes might rely on specific legacy behavior. We will ensure that test suites for these routes are updated and pass.
