# Deployment Provenance

> P0 §24 deliverable. Baseline SHA `3aea38dc` (`main`, 2026-08-06).

**Contract status: PASS as of this writing** — production now serves `main`
HEAD. This flips a finding from earlier the same day
([`PHASE-13-RETRACTION.md`](../stitch/PHASE-13-RETRACTION.md) §1). Both the
before and after states are recorded below because the mechanism that caused
the drift, and the mechanism that closed it, both matter for the P0 verdict.

## 1. Deploy-truth contract

`artifacts/storefront/app/api/build/route.ts` (`force-dynamic`, `no-store`)
reports `process.env.BUILD_SHA`, injected by `.github/workflows/deploy.yml`
at Cloud Run deploy time via `--update-env-vars`, **not** baked into the
image at build time. `/api/build-info` is a second, identically-sourced
endpoint. Every claim about "what is deployed" is settled by curling one of
these and comparing `sha` to a commit — nothing else in this repo is a valid
source of truth for that question.

## 2. State recorded earlier this session

At the point this deliverable set was first scoped (P0 runbook verification,
same day):

```
$ curl -s https://tanmatra.food/api/build
{"sha":"250e5f5966c4642b2295c8fc7ca560a1acef28c5","builtAt":"2026-08-06T15:42:43.149Z", ...}
```

`250e5f59` is `refactor: rewrite Home route to match 5.1 Clinical Commerce
Feed spec` (2026-08-05T10:14:29Z) — **22 commits and 285 changed
`artifacts/storefront` files behind `main` HEAD** at the time
(`git log --oneline 250e5f59..3aea38dc | wc -l` → 22). Notably, `250e5f59`
predates both `925104f2` (P0 Clean-Slate deletion) and `c8dfe9ee` (mockup
refill) — the two commits `PHASE-13-RETRACTION.md` names as the root cause of
the Phase 13 regression. Production was not running the regression *or* its
fix; it was running a build from before either happened.

## 3. Why: two `deploy.yml` runs failed silently on the commits that mattered

Checked directly against GitHub Actions (`deploy.yml` runs, `storefront-cloud-run`
job):

| Commit | Subject | Deploy run conclusion |
|---|---|---|
| `250e5f59` | rewrite Home route (5.1 spec) | **success** — this is what was live |
| `d92791f2` | clean slate Route 5.2 Menu | failure |
| `925104f2` | apply P0 Clean-Slate Execution globally | **failure** |
| `c8dfe9ee` | storefront layout enforcement + screen completions | **failure** |
| `cffbf957` | Add context7.json | success |
| `e9eab0b1` | Merge PR #529 (audit branch) | failure |
| `3aea38dc` | Merge PR #528 (this deliverable's baseline) | **success** |

The two commits blamed for the regression never became live *because their
own deploy runs failed* — not because a green CD run silently failed to
repoint traffic, which is the more alarming failure mode
`PHASE-13-RETRACTION.md` raised as a possibility. That distinction matters
for the corrective action: the fix is "make deploy.yml pass on every merge to
main," not "add a post-deploy traffic-verification step" (one already
exists — see §4 — and it is what caught this).

## 4. Current state — reverified just now, independently, three ways

**Direct curl, five consecutive requests, `no-store` response:**
```
$ for i in 1 2 3 4 5; do curl -s https://tanmatra.food/api/build; done
{"sha":"3aea38dcc0cdd9263c5d839fbd959c4383f0f40e","builtAt":"2026-08-06T15:44:55.815Z",...}
× 5, identical every time
```

**Second endpoint agrees:**
```
$ curl -s https://tanmatra.food/api/build-info
{"sha":"3aea38dcc0cdd9263c5d839fbd959c4383f0f40e","builtAt":"2026-08-06T15:44:55.773Z",...}
```

**`www` subdomain agrees:**
```
$ curl -s https://www.tanmatra.food/api/build
{"sha":"3aea38dcc0cdd9263c5d839fbd959c4383f0f40e","builtAt":"2026-08-06T15:44:55.815Z",...}
```

**GitHub Actions confirms the mechanism, not just the outcome** — run
`31116040058` (`Deploy`, triggered by the `main` push that merged PR #528),
job `storefront-cloud-run`, every step green:

```
Build image with Cloud Build             success  15:38:01–15:44:28
Capture the currently-serving revision   success  15:44:28–15:44:31   (rollback target saved)
Deploy to Cloud Run (--no-traffic)       success  15:44:31–15:44:41
Route traffic to the new revision        success  15:44:41–15:44:52
Smoke-test the home page renders         success  15:44:52–15:45:00
Assert deployed sha (/api/build == commit)  success  15:45:00–15:45:03
Roll back on failed verification         skipped  (nothing failed)
```

`sha` matches `github.sha` for the triggering push (`3aea38dc`) exactly.
`builtAt` (15:44:55Z) falls inside the `Route traffic` → `Assert` window,
consistent with a genuine fresh boot, not a cached response — the route is
`force-dynamic`/`no-store` and returns `process.env`, not something a CDN can
serve stale.

## 5. What this means for the P0 verdict

This closes one of the two previously-blocking findings for the P0 GO/NO-GO
decision — see [`p0-baseline.json`](./p0-baseline.json), gate `deploy
provenance`, now `PASS`. **It does not flip the overall verdict.** P0 remains
**NO-GO** on this SHA because of an independent, still-unresolved trigger:
layout ownership is still imperative, not structural — see
[`layout-contracts.md`](./layout-contracts.md). Deploying the current
`main` HEAD does not fix that; it deploys the same route-group-less
`app/layout.tsx` and the same B2B chrome gate that suppresses navigation
without providing a replacement.

## 6. Standing risk, unresolved by this deploy

- The historical failure mode — a commit's own `deploy.yml` run fails and
  production silently keeps serving an older SHA with no separate alert —
  is a process gap, not a code gap. Nothing currently pages anyone when
  `storefront-cloud-run` fails; it was only caught by manually curling
  `/api/build` during this session's earlier verification pass. Consider a
  scheduled synthetic check (`synthetic-prod-check.yml` already exists and
  runs against `tanmatra.food` for other purposes — extending it to assert
  `/api/build`'s `sha` against `main`'s current HEAD would close this
  specific gap cheaply).
- Git tag `stitch-74-production-accepted` — per
  `PHASE-13-RETRACTION.md`, not moved or deleted by that retraction, and not
  touched by this deliverable set either. It still names the 2026-08-05
  acceptance event historically; it does not describe current deploy state
  and should not be read as if it does.
