# Auth Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize authentication and ops gating across API routes to adhere to architecture coherence.

**Architecture:** Replace shadowed `requireAuth` and legacy `isAdminRequest` helpers with the canonical `requireAuthUser` and `requireOps`/`isOpsRequest` middlewares.

**Tech Stack:** Express, TypeScript, Drizzle

## Global Constraints

- Never use `requireAuth` local implementations. Use `import { requireAuthUser } from "../middlewares/requireAuth";`
- Never check `req.session.isAdmin`. Use `import { requireOps, isOpsRequest } from "../lib/adminGate";`
- Do not "harmonise" other technical debt as a side-quest.

---

### Task 1: Standardize Customer Auth in groupOrders.ts

**Files:**
- Modify: `artifacts/api-server/src/routes/groupOrders.ts`

**Interfaces:**
- Consumes: `requireAuthUser` from `../middlewares/requireAuth`
- Produces: Normalized user extraction

- [ ] **Step 1: Replace local requireAuth helper**

Remove `requireAuth` function (lines 19-27) in `groupOrders.ts`. 

- [ ] **Step 2: Add requireAuthUser import**

```typescript
import { requireAuthUser } from "../middlewares/requireAuth";
```

- [ ] **Step 3: Update endpoints to use requireAuthUser**

In `groupOrders.ts`, find occurrences of `const auth = requireAuth(req, res);`. Replace with:
```typescript
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; firstName?: string | null; email?: string | null };
  const auth = { id: userId, name: u.firstName ?? (u.email ? u.email.split("@")[0]! : "Friend") };
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/routes/groupOrders.ts
git commit -m "fix(auth): standardize requireAuth in groupOrders.ts"
```

### Task 2: Standardize Customer Auth in corporate.ts

**Files:**
- Modify: `artifacts/api-server/src/routes/corporate.ts`

**Interfaces:**
- Consumes: `requireAuthUser` from `../middlewares/requireAuth`

- [ ] **Step 1: Replace local requireAuth helper**

Remove `requireAuth` function (lines 28-42) in `corporate.ts`.

- [ ] **Step 2: Add requireAuthUser import**

```typescript
import { requireAuthUser } from "../middlewares/requireAuth";
```

- [ ] **Step 3: Update endpoints to use requireAuthUser**

In `corporate.ts`, find occurrences of `const auth = requireAuth(req, res);`. Replace with:
```typescript
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const u = req.user as { id: string; email?: string | null; firstName?: string | null };
  const auth = { id: userId, email: u.email ?? null, firstName: u.firstName ?? null };
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/routes/corporate.ts
git commit -m "fix(auth): standardize requireAuth in corporate.ts"
```

### Task 3: Standardize Customer Auth & Admin Ops in b2bPlanner.ts

**Files:**
- Modify: `artifacts/api-server/src/routes/b2bPlanner.ts`

**Interfaces:**
- Consumes: `requireAuthUser` from `../middlewares/requireAuth`
- Consumes: `isOpsRequest` from `../lib/adminGate`

- [ ] **Step 1: Replace local requireAuth and isAdminRequest helpers**

Remove `isAdminRequest` (lines 42-49) and `requireAuth` (lines 51-61) in `b2bPlanner.ts`.

- [ ] **Step 2: Add canonical imports**

Update the imports from `../lib/adminGate` and add `requireAuthUser`:
```typescript
import { isOpsRequest } from "../lib/adminGate";
import { requireAuthUser } from "../middlewares/requireAuth";
```

- [ ] **Step 3: Update resolveCompanyAccess**

Replace `if (isAdminRequest(req))` with `if (isOpsRequest(req).allowed)`.
Replace `const auth = requireAuth(req, res);` with:
```typescript
  const userId = requireAuthUser(req, res);
  if (!userId) return null;
  const auth = { id: userId };
```

- [ ] **Step 4: Update other isAdminRequest checks**

In the `/lunch-plans/:id/schedule` endpoint and the `/sales/...` endpoints, replace `isAdminRequest(req)` with `isOpsRequest(req).allowed`.

- [ ] **Step 5: Update other requireAuth checks**

In `/lunch-plans/:id/schedule`, replace `const auth = requireAuth(req, res); if (!auth) return;` with:
```typescript
      const userId = requireAuthUser(req, res);
      if (!userId) return;
      const auth = { id: userId };
```

- [ ] **Step 6: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/routes/b2bPlanner.ts
git commit -m "fix(auth): standardize requireAuth and ops gating in b2bPlanner.ts"
```

### Task 4: Standardize Admin Ops in aiRuns.ts, challenges.ts, community.ts

**Files:**
- Modify: `artifacts/api-server/src/routes/aiRuns.ts`
- Modify: `artifacts/api-server/src/routes/challenges.ts`
- Modify: `artifacts/api-server/src/routes/community.ts`

**Interfaces:**
- Consumes: `requireOps`, `isOpsRequest` from `../lib/adminGate`

- [ ] **Step 1: Update aiRuns.ts**

Remove `isAdminRequest` (lines 19-26).
Change `import { hasAdminToken } from "../lib/adminGate";` to `import { isOpsRequest } from "../lib/adminGate";`.
Replace `isAdminRequest(req)` with `isOpsRequest(req).allowed`.

- [ ] **Step 2: Update challenges.ts**

Remove `isAdminRequest` (lines 133-140) and `requireAdmin` (lines 142-148).
Change `import { hasAdminToken } from "../lib/adminGate";` to `import { requireOps } from "../lib/adminGate";`.
Replace `requireAdmin(req, res)` with `requireOps(req, res) !== null`.

- [ ] **Step 3: Update community.ts**

Remove `isAdminRequest` (lines 37-44) and `requireAdmin` (lines 46-52).
Change `import { hasAdminToken } from "../lib/adminGate";` to `import { requireOps } from "../lib/adminGate";`.
Replace `requireAdmin(req, res)` with `requireOps(req, res) !== null`.

- [ ] **Step 4: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/routes/aiRuns.ts artifacts/api-server/src/routes/challenges.ts artifacts/api-server/src/routes/community.ts
git commit -m "fix(auth): standardize ops gating in community features"
```
