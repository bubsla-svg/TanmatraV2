# P0 §24 Deliverables

The 13 files in this directory are the P0 runbook's required Go/No-Go
evidence set, generated against `main` at `3aea38dc` (2026-08-06). None of
these existed before this change — the runbook was previously unimplemented
end-to-end (see [`p0-baseline.json`](./p0-baseline.json) `deliverables`).

**Verdict: NO-GO.** Full reasoning in [`p0-baseline.json`](./p0-baseline.json).
The blocking trigger is layout ownership — see
[`layout-contracts.md`](./layout-contracts.md).

## Remediation status (2026-08-07, not a re-audit)

The evidence below is still the truthful record of `3aea38dc`. Since then,
the layout-ownership branch landed structural fixes for four of the eight
`blockingForGo` items; the JSON/markdown evidence files are deliberately
left pinned to their SHA rather than edited in place. What changed:

- **Layout ownership (the NO-GO trigger):** `app/` is now partitioned into
  `(global)` / `(focus)` / `(b2b)` route groups, each with its own
  `layout.tsx`. The three `usePathname()` chrome-subtraction gates
  (`FocusChromeGate`, `B2BChromeGate`, `InternalSurfaceGate`) and the
  `FOCUS_ROUTE_SCRIPT` / `body[data-focus-route]` runtime mechanism are
  deleted — which shell a route gets is now a property of where its file
  lives. `lib/focusRoutes.ts` remains only as the sticky-band/tab-bar
  matcher for components that render inside `(global)`.
- **B2B shell exists:** `app/(b2b)/layout.tsx` renders a compact
  business header (brand exit home, corporate/partners links, storefront
  entry) — closes layout-contracts.md §5.1 (chrome subtracted with nothing
  replacing it). `/corporate-wellness` is assigned to the B2B shell
  deliberately (per the UX/UI architecture plan), superseding §5.2's
  accidental-prefix finding.
- **Route contract:** `/account/wearables` → 308 → `/account/connections`
  landed in `next.config.ts`.
- **Single SafeImage:** `components/primitives/SafeImage.tsx` is deleted;
  `components/ui/SafeImage.tsx` is the one implementation (callers
  migrated).
- **`?step=` auth-step contract (2026-08-08):** `/login` now accepts
  `?step=phone|otp` as the canonical, linkable auth state
  (`lib/loginRoute.ts`), in addition to the existing `?next=` return
  destination. `PhoneAuth` opens directly at the requested stage and
  `LoginCard` keeps `?step=` in sync via `router.replace` as the visitor
  progresses, so the address bar stays a truthful record of state without
  spamming browser history. `account-conflict` — the third value in P0's
  step enum — is **not** implemented: `parseAuthStep` deliberately rejects
  it, because no signal anywhere in the product (client or
  `POST /auth/phone/verify-otp`, which is a plain upsert-by-phone) can ever
  produce that state. Building it for real needs a product decision first
  (what a "conflict" even means here, and what resolution UX follows) —
  tracked as a separate follow-up, not fabricated speculatively. The
  previously-untested `?next=` open-redirect guard (domain invariant 13,
  "Return-Route Preservation") is now covered by `lib/loginRoute.test.ts`.
- **Production analytics sanitizer (2026-08-08):** closes
  [`privacy-analytics-contract.md`](./privacy-analytics-contract.md) exactly
  per its §5 remediation steps. `ANALYTICS_KEY_ALLOWLIST` and
  `sanitizeAnalyticsEvent` moved out of `domainInvariants.test.ts` into a
  real module, `lib/analyticsSanitizer.ts` — the test now imports and
  exercises the shipped function instead of re-declaring it, so domain
  invariant 16 ("Health Data Privacy") is `automated`, not `self-contained`,
  as of this change. `components/PostHogProvider.tsx`'s one production
  analytics call (`$pageview`) now routes through the new
  `capturePostHogEvent` chokepoint instead of calling `posthog.capture(...)`
  directly. `autocapture` and `disable_session_recording` are both now
  explicitly set (`false`/`true`) in `posthog.init(...)` — the "undecided
  posture" §3 flagged as an open question is resolved to OFF: this is a
  clinical app, and DOM autocapture / session replay can surface a form
  field's text or an interacted element's attributes verbatim, which
  `ANALYTICS_KEY_ALLOWLIST` has no visibility into (it can only filter
  properties this app explicitly sends) and therefore cannot sanitize.
  `NEXT_PUBLIC_POSTHOG_KEY`/`HOST` remain unset in `deploy.yml` — analytics
  is still dormant in production — but the enforcement code this document
  found missing now exists and is unit-tested (`lib/analyticsSanitizer.test.ts`).

Still open from `blockingForGo`: the orphaned `clinical-governance-engine`
integration, plus the `account-conflict` auth step above pending a product
decision. A fresh audit pass against the merge SHA is what moves the verdict.

## Reading order

1. [`p0-baseline.json`](./p0-baseline.json) — start here. The verdict, every
   gate result, and links into the detail docs below.
2. [`application-ownership.md`](./application-ownership.md) — which app owns
   which surface.
3. [`route-contract.md`](./route-contract.md) /
   [`routes.json`](./routes.json) — the 58-route table and its two blocking
   defects.
4. [`layout-contracts.md`](./layout-contracts.md) /
   [`layout-assignments.json`](./layout-assignments.json) — the NO-GO
   trigger itself.
5. [`domain-boundaries.md`](./domain-boundaries.md) — where each domain's
   logic actually lives, and where that boundary is crossed.
6. [`domain-invariants.md`](./domain-invariants.md) /
   [`domain-invariants.json`](./domain-invariants.json) — the 20
   non-negotiable invariants, re-graded against shipped code rather than
   test-file self-assertions.
7. [`clinical-scope.md`](./clinical-scope.md) — what "clinical" actually
   means on this SHA, including the orphaned `clinical-governance-engine`
   package.
8. [`privacy-analytics-contract.md`](./privacy-analytics-contract.md) — the
   analytics allowlist that exists only inside a test file.
9. [`deployment-provenance.md`](./deployment-provenance.md) — production
   drifted 22 commits behind `main` earlier in this verification pass, and
   caught up mid-session; both states are recorded with evidence.
10. [`legacy-quarantine.md`](./legacy-quarantine.md) — the one area that
    passes cleanly.

## Regenerating

`routes.json` and `layout-assignments.json` are generated from the live
route matchers (`lib/focusRoutes.ts`, `lib/internalSurfaces.ts`,
`lib/stitchRoutes.ts`, and a verbatim reimplementation of
`components/B2BLayout.tsx#isB2BRoute`, which cannot be imported directly
since it's a client component), not hand-maintained. Re-run against a new
SHA by walking `find artifacts/storefront/app -name page.tsx` and re-evaluating
each route through those matchers — see the `generatedFrom.method` field in
each JSON file for the exact approach. The nine markdown files are manual
writeups; re-verify their evidence against the new SHA rather than assuming
they still hold.
