# Validation of the "Comprehensive E2E Architecture & System Design Audit" (2026-08-18)

Every claim in the submitted audit was re-checked against the repository at
`01a896e`. Commands used are shown inline so any line can be re-run.

**Verdict: 6 of 14 findings hold. 7 are materially false. 1 is unverifiable from
this repo.** Four of the "recommended fixes" propose building things that already
exist, and one of those (`§2.6`'s contrast auditor) would replace a correct WCAG
implementation with a mathematically invalid one.

The audit's own appendix states `verify.yml` was **"Not reviewed in this audit
(assumed good)"**. That file is 28.7 KB and contains `openApiContract.test.ts` —
the CI gate that directly refutes the audit's headline CRITICAL finding.

---

## Part 1 — Scorecard

| § | Claim | Verdict |
|---|-------|---------|
| 1.3 / 2.1 | Codegen pipeline is ~90% vestigial | ✅ **TRUE** (measurements re-verified) |
| 2.1 | Nothing verifies the API contract | ❌ **FALSE** — `openApiContract.test.ts` runs in CI |
| 2.2 | `only_storefront` dispatch can deploy api-server without migrations | ❌ **IMPOSSIBLE** — jobs share an identical guard |
| 2.3 | Concurrency-group race can silently skip a deploy | ✅ **TRUE** (documented `deploy.yml:40-45`) |
| 2.3 | `workflow_run` trigger eliminates the race | ⚠️ **UNSOUND** — same concurrency semantics |
| 2.4 | Image asset strategy undocumented | ✅ **TRUE** (partially — no strategy doc) |
| 2.4.3 | Storefront needs an image fallback | ❌ **ALREADY EXISTS** — `SafeImage`/`ImgWithFallback` |
| 2.5 | Codegen runs in `postinstall`, costs ~30 s per install | ❌ **FABRICATED** — no `postinstall` exists anywhere |
| 2.5.2 | No codegen-freshness gate in CI | ✅ **TRUE** |
| 2.6 | `lint:tokens` does not scan theme files | ✅ **TRUE** (and deliberate) |
| 2.6.2 | Needs a theme contrast auditor | ❌ **ALREADY EXISTS** — and the proposed formula is invalid |
| 2.7 | No E2E checkout flow test | ❌ **FALSE** — 37 specs; CUJ suite gates every PR |
| 2.7 | Subscription pause/resume/skip untested | ❌ **FALSE** — the tests exist (but see Finding B) |
| 3.1 | No CDN on image serving | ⚪ **UNVERIFIABLE** from repo (GCP infra) |
| 3.2 | DB connection pool unmonitored | ✅ **TRUE** |
| 4.1 | Secret management is strong | ✅ **TRUE** |
| 4.2 | Rate limits undocumented | ✅ **TRUE** — but the proposed table is ~90% wrong |
| 5.1 | "Automatic rollback not yet configured" | ❌ **FALSE** — auto-rollback ships on all 3 services |
| 5.2 | No monitoring / synthetic checks | ❌ **FALSE** — `synthetic-prod-check.yml` runs every 2 h |

---

## Part 2 — What the audit got right

### §1.3 / §2.1 — the codegen pipeline really is vestigial

Re-measured independently; the audit's transcription of `CLAUDE.md` is accurate.

```
openapi.yaml paths ............................. 40
api-server route handlers ...................... 460   (audit/CLAUDE.md said 441)
generated schemas imported by the server ....... 1     (HealthCheckResponse)
generated React Query hooks imported anywhere .. 0
```

All three files importing `@workspace/api-client-react` take only hand-written
helpers:

```
artifacts/tanmatra/src/entry.client.tsx:4        import { setBaseUrl }
artifacts/tanmatra-mobile/app/_layout.tsx:17     import { setAuthTokenGetter, setBaseUrl }
artifacts/tanmatra-mobile/lib/activity.ts:2      import type { WearableProvider }
```

The route count has drifted 441 → 460 since `CLAUDE.md` was written; the coverage
ratio is now **8.7%**, not 9%.

### §2.3 — the CI/CD concurrency race is real

`deploy.yml:46-48` sets `group: deploy-main`, `cancel-in-progress: false`, and
lines 40-45 document the exact failure mode the audit describes. Correctly identified.

But **Fix 2.3.1 does not work.** `workflow_run` events are subject to the same
concurrency-group queueing; moving the trigger does not make GitHub retain
superseded pending runs. The root cause is that `dorny/paths-filter` diffs
`before..after` of the *surviving* push, not the accumulated range — so the fix
belongs in the filter's diff base (or in the completeness monitor of Fix 2.3.2,
which is sound), not in the trigger type.

### §2.6 — `lint:tokens` genuinely does not reach theme files

`scripts/lint-tokens.ts:26` — `const SCAN_SUBDIRS = ["components", "app"];`

True, and `CLAUDE.md` already documents it. But it is a deliberate design
decision, stated at `lint-tokens.ts:13`: *"Colours live in theme files
(lib/themes/, lib/tokens) — components reference them."* Theme files are the one
place colours are *supposed* to live. The audit reports a documented design
choice as an undiscovered risk.

### §2.5.2, §3.2, §4.2 — three valid gaps

- No codegen-freshness gate exists in any workflow (`grep codegen .github/workflows/*.yml` → empty).
- No connection-pool metrics exist (`grep -rn "poolStats\|totalCount\|waitingCount"` → empty).
- No rate-limit documentation exists. (The *recommendation* is valid; the proposed table is not — see Part 3.)

---

## Part 3 — What the audit got wrong

### §2.2 — the CRITICAL risk scenario is structurally impossible

The audit claims a `workflow_dispatch` with `only_storefront=true` can deploy
api-server while skipping `migrate-db`. It cannot. The two jobs carry an
**identical** first guard:

```yaml
# migrate-db — deploy.yml:245-248        # cloud-run — deploy.yml:321-326
if: |                                     if: |
  !cancelled() &&                           !cancelled() &&
  ((github.event_name == 'workflow_dispatch' && !inputs.only_storefront)
     || needs.changes.outputs.api == 'true') &&
  (github.event_name != 'push' || needs.gate.result == 'success')
                                            needs.migrate-db.result == 'success' &&   # ← line 324
```

`cloud-run`'s condition is a strict subset of `migrate-db`'s. Additionally,
`changes` runs `paths-filter` only `if: github.event_name == 'push'`
(`deploy.yml:63`), so on any dispatch `needs.changes.outputs.api` is empty and
the api-server deploy is skipped outright.

The audit discovers this mid-section ("✅ Status: This is already in place (line
324). No fix needed.") yet keeps the 🔴 CRITICAL heading and carries "2.2:
Database Migration Automation" into both the roadmap and the remediation
checklist.

### §2.5 — the postinstall claim is fabricated

> "Codegen runs on every `pnpm install` (postinstall hook in root) — adds ~30s to install time"

```
$ grep -rn '"postinstall"' --include=package.json .   # → no matches, anywhere
```

The root `package.json` has a `preinstall` (a pnpm-only guard) and no
`postinstall`. The proposed replacement is also foreign to this repo — it
specifies `"postinstall": "pnpm run db:generate"` / `"db:generate": "prisma
generate"`. **This project uses Drizzle, not Prisma.** The entire finding, its
0.5 d roadmap entry, and its "save 30s per install" impact rest on a hook that
does not exist.

### §5.1 — auto-rollback exists; the cited file does not

The audit's runbook asserts *"Automatic rollback not yet configured (see
TODO_deployment-auditor.md)"*. Both halves are false.

All three services implement capture → `--no-traffic` → verify → rollback.
`deploy.yml:1188-1220`:

```yaml
- name: Roll back on failed verification
  if: failure() && steps.route.outcome == 'success' && steps.stable.outputs.rev != ''
  run: |
    gcloud run services update-traffic ${SERVICE} --to-revisions "$REV=100" --quiet
    # Trust nothing: prove the restored revision is what is serving.
```

It then re-polls `/api/build` to confirm the rollback actually took effect. There
is also a fatal "deploy-truth" check that fails the job if the served sha never
matches the deployed sha.

`TODO_deployment-auditor.md` does not exist. The repo has
`TODO_optimization-auditor.md`. The citation is invented.

### §5.2 — monitoring exists

`.github/workflows/synthetic-prod-check.yml` runs the real funnel against
`https://tanmatra.food` on `cron: "17 */2 * * *"` **and** after every successful
Deploy, in **Chromium and WebKit** (the engine where a cross-site-cookie login
bug previously hid), then posts the report as a commit comment.
`scripts/synthetic-check.mjs` is 9.9 KB and fails the workflow on regression.

Rating this "🔴 MISSING — Needs creation" is wrong.

### §2.7 — the E2E gap does not exist

37 specs live in `artifacts/storefront/e2e/specs/`, including `core-funnel`,
`cuj-01-menu-cart`, `cuj-01b-dish-pdp`, `cuj-02-plan-checkout`, `cuj-09-reorder`,
`checkout-allergen`, `checkout-doubletap`, `checkout-macros`.

The claim *"CI runs `test:stitch-runtime` only"* is false — `storefront.yml:93`
runs **"CUJ e2e (mobile) against the built app"** on every PR, and
`storefront.yml:378` adds a `cross-browser-nightly` job on Firefox + WebKit.
`e2e-pr.yml` gates the legacy SPA the same way.

### §2.6.2 — the proposed contrast auditor is worse than what ships

`artifacts/storefront/lib/themes/tanmatraTheme.test.ts` already runs three WCAG
audits — light mode, dark mode, and gold-fill ink — all asserting ≥ 4.5:1 using a
real `contrastRatio()` built on relative luminance.

The audit's replacement computes:

```js
const ratio = (Math.max(...rgb1) + 0.05) / (Math.min(...rgb2) + 0.05);
```

That is not WCAG contrast. It takes the max channel of one colour over the min
channel of another, on 0-255 values, with a 0.05 constant meant for normalised
relative luminance. It is dimensionally meaningless and would pass and fail
colours essentially at random. Adopting it would delete working coverage.

### §2.4.3 — the image fallback already ships, and is far more thorough

`components/ui/SafeImage.tsx` + `components/ui/ImgWithFallback.tsx` already
handle three failure modes the audit's proposed `DishImage` does not:

1. **The hydration race** — `onError` attaches at hydration, but SSR'd images
   start loading from raw HTML; a failure in that window fires into a tree with
   no listener. Closed via `complete && naturalWidth === 0` on mount.
2. **A request that never resolves** — no error event ever fires; closed with an
   8 s stall timeout.
3. **Upstream disguising a 404 as `HTTP 200 text/html`.**

The audit's version handles only `onError`, and would also violate the repo's own
token gate by hardcoding `bg-gray-100`/`text-gray-500` palette classes.

### §4.2 — the proposed rate-limit table is nearly all wrong

| Endpoint | Audit claims | Actual (`rateLimitMiddleware.ts`) |
|---|---|---|
| `GET /api/menu/public` | Unlimited (CDN cached) | **120 / minute** (`:93`) |
| `POST /api/orders` | 10 / hour | **30 / minute** (`:96`) |
| `POST /api/ai/*` | 20 / day | **20 / minute** (`:113`) |
| `POST /api/subscriptions/checkout` | 3 / day | **no such limiter exists** |
| `POST /api/payments/webhook` | Unlimited | correct — explicitly skipped (`:224`) |
| Guest users | "1/10th limits" | **fabricated** |

On the last row, `app.ts:182-184` states the opposite outright: *"Each limiter is
keyed on client IP so authenticated + anonymous requests share the same counter
per IP."* Only one per-day limit exists in the whole codebase
(`corporateInquiryRateLimit`, 5/day).

Committing this table would install authoritative-looking misinformation about
the money path.

---

## Part 4 — Findings the audit missed

### Finding A — there are TWO OpenAPI specs, and they are disjoint

This is the real contract risk, and it is invisible in the audit's framing.

| | `lib/api-spec/openapi.yaml` | `OPENAPI_SPEC_V1` (`routes/openApiContract.ts`) |
|---|---|---|
| Paths | 40 | 39 |
| Consumers | Orval → unused codegen | Served at `GET /v1/openapi.json` |
| CI enforcement | **none** | `openApiContract.test.ts`, run in `verify.yml:210` |
| Aware of the other | no | no |

**Overlap: exactly 0 paths.** Union = 79 of 460 handlers (17.2%).

The audit's Fix 2.1.2 — "auto-generate the spec from route handlers, `--fail-if-drift`" —
already exists as `validateRouterContract()` (`openApiContract.ts:162`), which
walks the live Express router stack and asserts every registered route is
contracted. It is enforced today for `/ops`, the admin routers, and legal
documents. It is simply scoped narrowly and lives in the *other* spec.

**Recommendation:** do not build Fix 2.1.2. Extend `validateRouterContract` to
more routers, and decide whether `openapi.yaml` should be deleted or merged —
maintaining two zero-overlap specs for one API is the actual defect.

### Finding B — 50 test files are never executed by CI, including the money path

`pnpm run lint:test-reach`:

```
✅ test-reach lint pass — 304/354 test files reachable by CI;
   50 still on the baseline backlog (scripts/test-reach-baseline.txt).
```

The repo tracks this as an explicit, ratcheting debt register (down from 73), and
`lint-test-reach.ts:41` names the stakes: *"including money, auth, PHI-crypto and
allergen-gate suites. They are NOT approved; they are recorded."*

Unreached suites include:

- **Money:** `chargeMandate.halt`, `chargeMandateScheduler`, `preDebitScheduler`, `checkoutSafety`, `checkout.consent`, `idempotency`, `bridgeCredit`, `purchaseIngest`
- **PHI:** `crypto.test.ts` (the `CLINICAL_KMS_MASTER_KEY` path)
- **Auth:** `adminGate`, `tokenLifecycle`, `auditGates`, `auth.truecaller`
- **Subscriptions:** `pauseResume`, `unskip`, `fullLifecycle`, `changePlan`, `reactivateBilling`, `macroCap`

This **inverts the audit's §2.7 prescription.** The audit says subscription
pause/resume/skip is "partial: no reorder test after skip" and proposes writing
new tests. `subscriptions.pauseResume.test.ts` already contains 10 tests
including *"pause then resume returns the subscription and its deliveries to
their starting state"* — the exact case claimed missing. The defect is not
missing tests; it is that CI never runs them. Wiring the existing suites into a
workflow is dramatically cheaper and higher-value than authoring new ones.

*Methodology caveat:* the gate matches test filenames in workflow command text,
so it cannot see through package-script indirection.
`dispatch.bulkhead.test.ts` is listed but **is** reached, via
`bulkhead-ci.yml` → `ci:bulkhead`. Treat the real figure as ~49.

### Finding C — eight `test:*` package scripts are invoked by no workflow

`test:user-brief`, `test:dish-rationale`, `test:meal-planner`, `test:community`,
`test:bundles`, `test:group-orders`, `test:redis-config`, `test:bulkhead` — only
`ci:bulkhead` is referenced by any workflow. `CLAUDE.md` documents three of these
files as the way to run tests locally, which makes the suites look maintained
while nothing enforces them.

### Finding D — the rate limiter fails open

`rateLimitMiddleware.ts:58-63`:

```ts
} catch (err) {
  // If the rate-limit check itself fails (DB down, etc.), log and allow
  // through — a broken rate limiter should not take down the API.
  req.log?.warn({ err, scope }, "rate limit check failed, allowing request");
}
next();
```

The limiter is Postgres-backed, so a database incident removes rate limiting from
every endpoint — including `/api/payments` and `/api/orders` — at exactly the
moment the system is least able to absorb load. The choice is deliberate and
commented, and `routeBurstGuard(30)` plus `concurrencyGuardMiddleware(250)` still
apply. But it is a genuine availability-vs-abuse tradeoff that belongs in a
security review, and the audit's §4 rates this area strong without noticing it.

---

## Part 5 — Corrected priorities

| Priority | Action | Basis |
|---|---|---|
| 1 | Wire the ~49 unreached suites into CI, starting with money + PHI + auth | Finding B — tests exist, cost is wiring |
| 2 | Resolve the dual-spec split; extend `validateRouterContract` coverage | Finding A |
| 3 | Decide fail-open vs fail-closed for the limiter on money routes | Finding D |
| 4 | Document rate limits **from source** | §4.2 valid; audit's numbers are not |
| 5 | Add the deploy-completeness monitor (Fix 2.3.2 only) | §2.3 valid; 2.3.1 is unsound |
| 6 | Add a codegen-freshness gate, or delete `openapi.yaml` | §2.5.2 valid |
| 7 | Write the image-asset strategy doc | §2.4 valid (doc only — fallback ships) |
| 8 | Add pool metrics | §3.2 valid |

**Do not action:** §2.2 (impossible), §2.5.1 (no such hook), §2.6.2 (would delete
working coverage), §2.4.3 (already ships), §5.1/§5.2 as written (rollback and
synthetic monitoring already exist — a triage runbook is still worth writing, but
the premises must be corrected first).

---

## Addendum — remediation, 2026-08-18

Everything in Part 5 was actioned in the same branch. Two corrections to this
report, and one finding that only appeared once the work started.

**Corrections to this document.** The route count here (460, and CLAUDE.md's
441) was grep-based and counted source occurrences. Walking the mounted router
tree gives **396** actually-registered paths, so the two specs together cover
~20% of the surface, not the 17.2% stated above. And the Finding B figure was
"~49 unreached"; running all 50 baselined files established the true split —
one (`dispatch.bulkhead`) is reached through a package script the gate cannot
see, and 49 genuinely ran nowhere.

| Priority | Outcome |
|---|---|
| 1. Wire the unreached suites | **Done.** All 50 run against a real Postgres; 46 passed, 4 were genuinely broken and were fixed rather than wired in green. 445 tests added across 10 steps. Baseline drained 50 → 1. `lint:test-reach` 304/354 → 357/358. |
| 2. Dual-spec split | **Half done, deliberately.** `openApiSpecFile.test.ts` now asserts every path `openapi.yaml` declares is a real registered route (all 40 are), and that the two specs cannot describe one path differently. Merging or deleting either remains a product decision. CLAUDE.md gains the two-spec map. |
| 3. Fail-open vs fail-closed | **Done.** `failClosed` option, default off. Opted in for `orders` (fronts `/api/checkout`), `payments`, `orders:claim`. Public reads stay fail-open. |
| 4. Rate-limit docs | **Done, generated.** `docs/RATE-LIMITS.md` is produced from `rateLimitMiddleware.ts` + `app.ts` and verified in CI, so the numbers are never written by hand — the failure mode this report caught in the audit's own table. |
| 5. Deploy-completeness monitor | **Retargeted.** Rather than a new monitor, the api-server gained the deploy-truth check the other two services already had (below). The paths-filter race itself is untouched — that needs the diff base fixed. |
| 6. Codegen-freshness gate | **Done.** `codegen:verify` in CI. The committed output was already stale (formatting only, semantically identical, verified). |
| 7. Image-asset strategy | **Done, and it found a live outage** (below). |
| 8. Pool metrics | **Done.** `poolSnapshots()` over both pools; `healthz` warns on saturation, defined as `waiting > 0` rather than busy-at-ceiling. |

### Two findings that only surfaced during the work

**`--test-force-exit` silently drops tests.** Running the newly-wired DB-free
set with the flag reported a different count per run — 319 / 294 / 319 / 286 /
299 — while exiting 0 every time. Without it: 319, five times out of five. The
runner kills the process while files are still registering, so tests vanish and
CI goes green having run an unknown subset. The pre-existing money-path step is
stable at 667 and was left alone; no new step uses the flag.

**The api-server was deploying on a liveness check alone.** `deploy.yml`
verifies the storefront and legacy SPA by polling `/api/build` until the serving
revision reports the deployed sha, and its own comment explains that a smoke
test "cannot catch a stale serve". The api-server had no such endpoint —
confirmed live: `/api/livez` and `/api/healthz` 200, `/api/build` 404. The
money-path service was the one of three that could not tell "rolled" from "did
not roll". It now has `/api/build`, `BUILD_SHA` on its revision, and a
deploy-truth step that reaches the existing rollback.

### The one thing that could not be fixed here

**56% of live dish photography is missing in production.** Of 112 live dishes,
63 use a local `/dishes/<slug>.jpg` path, and all 63 return `200 text/html`
(8464 bytes — the legacy SPA's `index.html`) instead of a JPEG. The library
(~280 JPGs, ~196 MB) is not in the repository, so it was never in the legacy
service's build context.

It stayed invisible because three correct behaviours compose badly: an SPA
fallback that answers any path with `200`, a `SafeImage` contract that degrades
to a branded tile so the page looks deliberate, and a monitor that asserted on
status codes rather than content-type.

Fixing it needs the actual image files, which exist in no clone here. What
shipped is the detector: `scripts/synthetic-check.mjs` now asserts `image/*`
and **fails against production today**, naming the count. It will stay red until
the library is restored — see `docs/IMAGE-ASSET-STRATEGY.md` for the
measurement, three costed options, and the fix that matters either way (serve a
real 404 for a missing file).

---

## Ground truth captured during validation

```
pnpm --filter @workspace/storefront run test   → 951 pass / 0 fail (19.1 s)
node --test "../tanmatra/src/**/*.test.ts"     → 163 pass / 0 fail (5.0 s)
node scripts/lint-tokens.ts artifacts/storefront → pass
pnpm run lint:test-reach                        → pass (304/354 reachable, 50 baselined)
```

The test counts in `CLAUDE.md` (951 / 163) are accurate and were reproduced.
