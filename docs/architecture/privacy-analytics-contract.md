# Privacy / Analytics Contract

> P0 §24 deliverable. Baseline SHA `3aea38dc` (`main`, 2026-08-06).

**Contract status: FAIL — the enforcement code does not exist in production,
only inside a test file.**

## 1. What is claimed

`docs/stitch/phase-13a-final-acceptance.md` §3, invariant 16: *"Health Data
Privacy — Clinical conditions, symptoms, and allergens are stripped from
analytics payloads... `domainInvariants.test.ts` — ✅ Automated."*
`CLAUDE.md`'s conversation-summary context (from the prior P0 verification
pass) records the same claim: *"`ANALYTICS_KEY_ALLOWLIST` in
`domainInvariants.test.ts` strips allergens."*

## 2. What actually exists

```ts
// artifacts/storefront/lib/domainInvariants.test.ts:184-203
const ANALYTICS_KEY_ALLOWLIST = new Set([
  "event_name", "route", "timestamp", "device_type",
  "plan_id", "cart_item_count", "checkout_step", "payment_provider",
]);

function sanitizeAnalyticsEvent(rawProperties: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawProperties)) {
    if (ANALYTICS_KEY_ALLOWLIST.has(k)) sanitized[k] = v;
  }
  return sanitized;
}
```

Both the allowlist and the sanitizer function are declared **inside the test
file itself.** A repo-wide search confirms neither symbol exists anywhere
else:

```bash
$ grep -rln "ANALYTICS_KEY_ALLOWLIST\|sanitizeAnalyticsEvent" app/ components/ lib/
artifacts/storefront/lib/domainInvariants.test.ts   # only match
```

The test constructs a `dangerousClientPayload` fixture with
`clinical_condition`, `allergens`, `glucose_reading`, `employee_id`, runs it
through the sanitizer *it just defined*, and asserts those keys are absent.
It cannot fail: there is no shipped analytics call for it to regress against.
This is the same finding recorded generically in
[`domain-invariants.json`](./domain-invariants.json) invariant 16
(`status: "self-contained"`); this document is the detailed writeup.

## 3. What analytics actually ships

`components/PostHogProvider.tsx` is the only production analytics call site
in the storefront:

```ts
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
...
useEffect(() => {
  if (!POSTHOG_KEY || !POSTHOG_HOST) return;
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: false,
    });
    posthog.capture("$pageview");
  });
}, []);
```

No call in this file, or anywhere else in the storefront, routes through
`ANALYTICS_KEY_ALLOWLIST` or any equivalent. The one event this code sends,
`$pageview`, carries whatever properties `posthog-js` attaches automatically
(URL, referrer, etc.) — not a clinical field by name, but also not filtered
by any allowlist this repo defines.

**Mitigating fact, checked directly:** `NEXT_PUBLIC_POSTHOG_KEY` and
`NEXT_PUBLIC_POSTHOG_HOST` are not set anywhere in `deploy.yml` or the
storefront `Dockerfile`. In the current production build the `if (!POSTHOG_KEY
|| !POSTHOG_HOST) return;` guard is always true, so `posthog-js` never loads
and no event is ever sent. **The privacy risk is dormant, not live, on this
SHA** — but it is dormant by omission (unset env vars), not by an enforced
allowlist. The moment someone sets those two variables to turn analytics on,
there is no code standing between a future `posthog.capture(name, props)`
call elsewhere in the app and a clinical field leaking into it.

`init()` is also called with no `autocapture: false` and no explicit
session-recording mask configuration — PostHog's autocapture (if the project
enables it server-side) captures interacted-element attributes by default.
This was not exploitable to verify further without live PostHog project
access; it is noted here as an open question for whoever wires the env vars,
not asserted as a confirmed leak.

## 4. What this means for the P0 verdict

Invariant 16 cannot be marked PASS. The rule is correctly *written down* —
the allowlist's contents (`event_name`, `route`, `timestamp`, `device_type`,
`plan_id`, `cart_item_count`, `checkout_step`, `payment_provider`) are a
reasonable design for what analytics *should* be limited to — but nothing
enforces it against the one analytics call path that exists.

## 5. What closing this gap requires

1. Move `ANALYTICS_KEY_ALLOWLIST` and `sanitizeAnalyticsEvent` out of the test
   file into a real module, e.g. `lib/analyticsSanitizer.ts`.
2. Route every `posthog.capture(...)` call — today just the one `$pageview`
   call in `PostHogProvider.tsx` — through it.
3. Change `domainInvariants.test.ts` to import and exercise that module
   instead of re-declaring it, so the test can actually fail on regression.
4. Decide and document PostHog's `autocapture` and session-recording posture
   before `NEXT_PUBLIC_POSTHOG_KEY`/`NEXT_PUBLIC_POSTHOG_HOST` are ever set in
   `deploy.yml`.
