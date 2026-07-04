# Tanmatra E2E (Playwright)

Skeleton mapped 1:1 to `docs/test-plan.md` (scenarios 1–22). **Not yet wired into
CI and not yet run** — this is a scaffold: shared fixtures are grounded in the real
app (paise pricing, `tanmatra:cart:v1` storage, `/api/menu/public`, `/orders/finalize`,
Noida-NCR pincodes), a subset of P0 math/geo/auth tests are implemented, and the rest
are `test.fixme(...)` stubs carrying the matrix's assertion source as a TODO.

## Install (deps not present yet)

```bash
pnpm --filter @workspace/tanmatra add -D @playwright/test
# browser is preinstalled in CI/dev images; locally: pnpm --filter @workspace/tanmatra exec playwright install chromium
```

## Run

```bash
# against local dev
E2E_BASE_URL=http://localhost:5190 \
E2E_API_BASE=https://wellness-foods-475157072474.asia-south2.run.app/api \
  pnpm --filter @workspace/tanmatra exec playwright test e2e

# release gate — P0 blockers only
pnpm --filter @workspace/tanmatra exec playwright test e2e --grep @p0
```

## Status legend inside specs

- implemented — asserts against real routes/APIs; should run once deps + seed exist.
- `test.fixme` — scaffold with TODO + assertion source; needs a `data-testid`, an ops
  simulator hook, or a DB assertion helper before it can be implemented.

## Known prerequisites (see docs/test-plan.md → Grounding notes)

- Add stable `data-testid`s for: menu card, cart line total, order total, and the
  "add ₹X more" free-delivery nudge (blocks full automation of 1/9/10/12).
- Ops-sim / DB-assertion hooks for 16–18, 20–22 (inventory, dispatch, audit, webhook,
  subscription forecast, refund ledger).
