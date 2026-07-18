# PR-10 · Coach endpoint: anonymous silent failure (W3)

**Blast radius: medium — but this is a safety surface.** An AI giving nutrition guidance to people managing clinical conditions gets maximum rigor on what it refuses, not just on what it returns.

## Objective

Eliminate the silent failure: the coach input is enabled for anonymous users, but the endpoint 401s and nothing surfaces. The user types a question about their condition and receives nothing, with no explanation.

## Context

This is the same defect class as the old checkout P0 — an enabled control that swallows input (CLAUDE.md §2 law 10). It's worse here because the swallowed input may be a health question.

## Steps

1. **Reproduce and document** the current behavior anonymously: request, response, and what the user sees (nothing).
2. **Pick one of two fixes and implement it fully:**
   - **(a) Anonymous session token** scoped to the open dish, rate-limited, with no persistence of personal health data beyond the session. Coach answers within the dish's context only.
   - **(b) Locked input state** — the control renders visibly locked with a sign-in affordance and a clear line on what signing in unlocks.
   Choose (a) only if the rate-limiting and data-retention story is clean. When in doubt, (b) — a visible lock is honest; a silent failure is not.
3. **Error states are visible.** Network failure, rate limit, timeout, and refusal each render a distinct message. No silent swallow, ever.
4. **Safety boundaries.** Verify the coach: stays inside nutrition guidance, does not diagnose, does not contradict the user's stated medical restrictions, and surfaces the standing frame — meals support, don't replace, medical care.
5. **Allergen consistency.** If the coach discusses a dish the user's profile flags, its answer must reflect that clash. A coach that recommends a dish the PDP blocks is a contradiction the user will trust at exactly the wrong moment.
6. **Prompt-chip parity.** Chips fire the same path as typed input, including the same error handling.

## Acceptance criteria

- [ ] No path leaves an anonymous user with an enabled input and no response.
- [ ] Every failure mode renders a visible, distinct message.
- [ ] Coach answers respect the user's allergen profile.
- [ ] No diagnostic or curative language in coach output (same claim rules as CLAUDE.md §2 law 9).
- [ ] Rate limiting in place; abuse can't run up inference cost anonymously.
- [ ] Telemetry: `coach_query`, `coach_error` with cause, `coach_blocked`.

## Verify

```bash
npm run test:e2e   # anonymous path, each error mode, allergen-consistency case
```

Explicit test: anonymous user, tree-nut question on Almond Chicken Salad — the response must not treat the dish as safe.

## Out of scope

Coach model or prompt redesign. This is the failure-surface and safety-consistency fix.
