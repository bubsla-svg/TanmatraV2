# PR-02 · Route hygiene, prerender, dead-router quarantine (W6)

**Blast radius: medium.** Touches routing and build config. Low logic risk, high blast radius if the prerender list is wrong.

## Objective

One live route manifest. No blank screens on cold load of transactional routes. No dead code accepting new work.

## Context

`routes.ts` is the live manifest; `App.tsx` is a dead router diverged by roughly 15 routes — it silently invites new screens into a file nothing renders. Separately, transactional routes are missing from the prerender list, producing blank cold loads on exactly the pages that convert.

## Steps

1. **Verify the divergence.** Diff `App.tsx` routes against `routes.ts`. List every route present in one and not the other in the PR body. If any route in `App.tsx` is genuinely live, **stop** — the premise is wrong and I need to know.
2. **Quarantine `App.tsx`.** Preferred: delete. If deletion is risky, rename to `App.legacy.tsx.bak`, strip it from the build graph, and add a lint rule or CI grep that fails on new imports of it.
3. **Add to the prerender list:** `/cart`, `/checkout`, `/subscribe`, `/dish/*`, `/meal-planner`, `/rd*`. Verify each renders meaningful first paint, not an empty shell.
4. **Delete `StitchClinicalOverview.tsx`** — stranded and unwired (wired-or-deleted rule). Confirm zero importers first.
5. **Register any missing screens** in `routes.ts` only.
6. **Fix the WebSocket 502 retry loop** if it still reproduces: bound retries with backoff and a give-up state; a failed socket must not spin.

## Acceptance criteria

- [ ] Exactly one router file participates in the build.
- [ ] CI fails on a new import of the quarantined router.
- [ ] Cold load (hard refresh, cache disabled) of `/cart`, `/checkout`, `/subscribe`, and a `/dish/:slug` shows content, not a blank screen.
- [ ] No stranded components remain — every component either has an importer or is deleted.
- [ ] WebSocket retries are bounded and surface a visible state on give-up.

## Verify

```bash
npm run build
npm run test:e2e   # cold-load assertions on the six routes
grep -rn "App.legacy" src/ --include=*.tsx   # expect: no importers
```

## Out of scope

Any visual change. This PR moves nothing on screen except eliminating blank first paints.
