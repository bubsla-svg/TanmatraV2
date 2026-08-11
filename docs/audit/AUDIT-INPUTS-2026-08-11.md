# Audit Inputs — E2E UX/UI Fidelity Audit

> Companion to `E2E-UX-UI-FIDELITY-AUDIT-2026-08-11.md`. This is the reproducibility record:
> everything needed to re-run the audit, plus an explicit list of what was never supplied.
> **Contains no secret values.** Secrets are referenced by name only.

---

## Repository

| Field | Value |
|---|---|
| Repository | `tanmatra6-wq/Wellness-Foods` |
| Audit branch | `claude/tanmatra-e2e-ux-ui-audit-63tfdo` (head `337dc5d`) |
| **Audit baseline commit** | `e16684eab70b0e85e969ab2b2967c053230b9e5f` (2026-08-11T06:27:43+05:30) |
| Main tip at audit close | `c842289ff4e01cfb503e0b1f6f54d52032e4a671` |
| Superseded prior baseline | `3aea38dc` (2026-08-06) — **120 commits / 408 files stale**, do not cite |
| Toolchain | Node `v22.22.2` · pnpm `9.15.5` · Playwright `1.49.1` |

**Note:** `main` moved 7 commits during the audit. `5f5502a` (allergen ack) and `b1ac202`
(availability propagation) each closed a finding — see Addendum 1 §A2.

---

## Runtime URLs

| Environment | URL | Verified state |
|---|---|---|
| **Production** | `https://tanmatra.food` | `/api/build` → sha `c842289`, `builtAt 2026-08-11T05:56:57.980Z` — **identical to main tip, no deploy lag** |
| Production (www) | `https://www.tanmatra.food` | Same service |
| Storefront Cloud Run | `https://storefront-475157072474.asia-south2.run.app` | `e2e-remote.yml` default target |
| Legacy SPA (image upstream only) | `https://tanmatra-475157072474.asia-south2.run.app` | Serves `/images/*` only; no customer HTML |
| **Local (this audit)** | `http://localhost:3001` (storefront) + `:3000` (api-server) | Reproduced via the recipe below |

⚠️ `/api/build` **misreports** `canonicalRoutes: 42` / `totalScreens: 74` against a 60+ route
tree — hardcoded at `app/api/build/route.ts:28-29`. Every deploy assertion compares against this.

### Local stack recipe (reproduces the 106-pass run)

`run_e2e.sh` at the **repository root** does this; its only defect is a hardcoded
`E2E_CHROMIUM_PATH=/usr/bin/google-chrome`. In a sandbox use `/opt/pw-browsers/chromium`.
No Docker daemon is required — PostgreSQL 16 binaries at `/usr/lib/postgresql/16/bin` suffice.

```bash
# 1. Postgres (must not run as root; initdb into a postgres-owned dir)
install -d -o postgres -g postgres /var/lib/postgresql/tanmatra_pgdata
su postgres -c "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust"
su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-p 5432 -k /tmp' -l $PGDATA/pg.log start"
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE tanmatra_test;"

# 2. Schema (CLINICAL_KMS_MASTER_KEY: use run_e2e.sh's committed test value)
export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/tanmatra_test"
pnpm --filter @workspace/db run push

# 3. Build storefront — API_UPSTREAM is BUILD-TIME ONLY; setting it at `next start` is a no-op
export API_UPSTREAM=http://localhost:3000 IMAGE_UPSTREAM=http://localhost:3000
export NEXT_PUBLIC_LIVE_CHECKOUT=1 NEXT_PUBLIC_API_BASE=
pnpm --filter @workspace/storefront run build

# 4. Run both, then the suite
PORT=3000 pnpm --filter @workspace/api-server run dev &
PORT=3001 pnpm --filter @workspace/storefront exec next start -p 3001 &
E2E_BASE_URL=http://localhost:3001 E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium \
  E2E_LIVE_CHECKOUT=1 pnpm --filter @workspace/storefront exec playwright test \
  --config=e2e/playwright.config.ts --project=chromium
```

### Remote runs

`e2e-remote.yml` (`workflow_dispatch` only) runs the mobile CUJ suite against any deployed URL.
It needs **no secrets** — the deployed build already carries the Firebase config as build args.
Audit run: [31465762750](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31465762750)
→ 123 passed / 8 failed / 10 skipped.

---

## Design references

| Artifact | Location | Status |
|---|---|---|
| **UX/UI Architecture Document** (P0 + Phases 4–13) | Google Doc `1ZRijOkgnM3eRqoyEGZyGPk16fmR6d4E5c_OzD9ak0HU` (158,787 chars) | ✅ Supplied — authoritative for routing, layouts, interactions, state, a11y, responsive, data integrity, payment safety, entitlements, privacy, clinical safety |
| **Stitch screen manifest** (74 screens) | `docs/stitch/stitch-screen-manifest.json` (`schemaVersion: 2`) | ⚠️ Structural mapping only |
| **Stitch reference images** (74) | `artifacts/stitch/reference/<promptId>.png` (declared) | ❌ **Absent from disk and from all git history** |
| VRT baselines | `e2e/specs/layout-vrt.spec.ts-snapshots/` | ❌ Not committed |
| In-repo prototypes | `docs/prototypes/{storefront,pdp-plan-first}.html`, `docs/references/checkout-93-tnm2-reference.html`, `docs/stitch/BATCH-*-BRIEFS.md` | ℹ️ Supporting, not pass/fail targets |

**Manifest fields present:** `promptId · stitchScreenId · designName · artifactType ·
canonicalRoute · state · layout · themes · viewport · implementationComponent · routeEntryPoint ·
controllerComponent · trigger · transition · expectedPrimaryAction · expectedCloseBehavior ·
referenceArtifact · implementationArtifacts · testId · testFile · proof · evidence · evidenceSha ·
defectIds · designDisposition`

**Missing field:** `approvalStatus`. `designDisposition` carries only `original` (62) /
`rebuild-required` (12) — neither establishes approval. The required vocabulary
(`APPROVED TARGET` / `APPROVED WITH NOTES`) returns **0 hits** across all JSON/MD/CSV/TS in the
repository. `artifactType` breakdown: route 39 · component-state 10 · wizard-stage 9 · overlay 7 ·
recovery-state 3 · design-system-reference 2 · empty-state 2 · drawer 1 · loading-state 1.

### Approved route rulings (later rulings supersede Stitch screens)

| # | Ruling | Production | Verdict |
|---|---|---|---|
| 1 | `/quick-setup` canonical; `/quiz` redirects | 308 → `/quick-setup` | ✅ |
| 2 | `/login` canonical; `/auth` redirects | 308 → `/login` | ✅ |
| 3 | `/menu/[productSlug]` canonical; `/dish/[slug]` redirects | `/dish/…` **200**, `/menu/…` **404** | ❌ **RUL-01 inverted** |
| 4 | `/corporate` canonical; `/corporate-wellness` redirects | both **200** | ❌ **RUL-02 no redirect** |
| 5 | Mobile tabs: Home, Menu, Care, Account | Confirmed | ✅ |

Not design baselines, per the reference: the current runtime implementation, and competitor apps.

---

## Test credentials

**None were supplied, and none were needed or read.**

GitHub Actions secrets are **write-only by design** — no API or CLI returns their values. The only
way to extract one would be authoring a workflow that echoes it into a log; that is exfiltration
and was not done. It proved unnecessary: `deploy.yml:913-923` bakes `NEXT_PUBLIC_FIREBASE_*` in as
build args, so the deployed build already carries them, and `e2e-remote.yml` exercises auth-gated
paths without any secret ever being visible.

| State | Status |
|---|---|
| Guest | ✅ **The only state exercised** — all local and production runs |
| Standard user | ❌ Not supplied |
| Active subscriber | ❌ Not supplied |
| Paused subscriber | ❌ Not supplied |
| Corporate sponsored | ❌ Not supplied |
| Corporate co-pay | ❌ Not supplied |
| Wearable-connected | ❌ Not supplied — and moot: `WearablesHub` is a `useState` mock with no API (CRT-09) |

**Auth mechanism:** Firebase phone OTP, verified server-side (`auth.ts:29 → verifyFirebaseIdToken`).
Without `NEXT_PUBLIC_FIREBASE_*` at build time, `firebaseConfigured()` (`lib/firebase.ts:22-25`)
returns false and the phone-auth UI never renders — this accounted for ~6 of the 25 local failures.

**To supply credentials properly:**
1. **Firebase test phone numbers** (fictional numbers with fixed codes, configured in the Firebase
   console) — works unattended in CI, no real SMS, no Twilio dependency.
2. **Seeded database rows per state.** ⚠️ **No seed script exists** — `scripts/` contains none, and
   `users` / `orders` / `subscriptions` are all empty after a schema push. This gap is itself worth
   closing: without it nobody can reproduce the account-state half of any audit.

**Secret names referenced by workflows** (names only, values never accessed):
`FIREBASE_API_KEY · FIREBASE_APP_ID · FIREBASE_AUTH_DOMAIN · FIREBASE_MESSAGING_SENDER_ID ·
FIREBASE_PROJECT_ID · FIREBASE_STORAGE_BUCKET · RAZORPAY_KEY_ID · RAZORPAY_KEY_SECRET ·
RAZORPAY_WEBHOOK_SECRET · TWILIO_ACCOUNT_SID · TWILIO_AUTH_TOKEN · TWILIO_VERIFY_SERVICE_SID ·
GCP_SA_KEY · REDIS_PASSWORD · ADMIN_USERNAME · ADMIN_PASSWORD_HASH · GOOGLE_MAPS_API_KEY ·
PRIVATE_OBJECT_DIR`

---

## Feature flags

### Production (`deploy.yml:498, 905-923`)

| Flag | Value | Meaning |
|---|---|---|
| `FLAG_PLAN_V2` | `true` | Plan-v2 surfaces on |
| `PLAN_CHECKOUT_DISABLED` | `1` | ⚠️ **New plan purchases refused with a typed 503.** Deliberate owner containment gate (`lib/flags.ts:25-35`, `docs/MONEY-PATH-VERIFICATION.md §5`), mounted *before* `idempotencyMiddleware` so a gated 503 isn't cached against the customer key for 24 h. **Not a defect.** |
| `ORDER_FINALIZE_DISABLED` | `1` | `POST /orders/finalize` closed pending an owner keep/retire decision. Not a defect. |
| `NEXT_PUBLIC_LIVE_CHECKOUT` | `1` | Live money-path surface on |
| `NEXT_PUBLIC_API_BASE` | `""` (empty) | Browser calls same-origin `/api/*` so the session cookie stays first-party (Safari/ITP) |
| `NEXT_PUBLIC_SITE_URL` | `https://tanmatra.food` | |
| `SESSION_SAMESITE` | `none` | |
| `DISABLE_SCHEDULERS` | `true` | |
| `NEXT_PUBLIC_MEALCARD_RAIL` | *unset* → **OFF** | Pluxee/Sodexo rail dark pending merchant onboarding (`lib/flags.ts:9`) |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | *unset* → **analytics dormant** | Sanitizer is wired regardless (`lib/analyticsSanitizer.ts`) |

### Build-time only (a change means a rebuild, not a restart)

`API_UPSTREAM` · `IMAGE_UPSTREAM` — baked into `routes-manifest.json` at `next build`.

### Test-only

`E2E_LIVE_CHECKOUT` — set **only** by `e2e-remote.yml`, which is `workflow_dispatch`-only.
⚠️ The entire live-checkout scenario set therefore **never runs on any automatic trigger** (CRT-24).

---

## Supported browsers / viewports

From `e2e/playwright.config.ts` — 6 projects defined, **3 never invoked by any workflow**:

| Project | Viewport | Runs where |
|---|---|---|
| `mobile` | Pixel 7 | ✅ Per-PR (`storefront.yml`) + `e2e-remote.yml` — **the only project CI runs on PRs** |
| `chromium` | 1280×720 | ⚠️ Defined; **not invoked by any workflow** (used manually in this audit) |
| `firefox` | — | Nightly only, `core-funnel.spec.ts` only |
| `webkit` | — | Nightly only, `core-funnel.spec.ts` only |
| `vp-375` / `vp-1024` / `vp-1440` | 375 / 1024 / 1440 | ❌ **Never invoked by any workflow**; `layout-vrt.spec.ts` only |

WebKit coverage matters here: `synthetic-prod-check.yml` notes cross-site-cookie login breakage
previously lived undetected in that engine.

**Exercised in this audit:** Chromium 1280×720 + Pixel 7. Not exercised: 320px, tablet
portrait/landscape, 1440, Firefox, WebKit, 200% zoom, reduced-motion.

---

## Outstanding inputs (block specific findings)

| Missing | Blocks |
|---|---|
| Credentials for 6 non-guest states + a seed script | ~24 of the ~40 charter §21 scenarios; all authenticated-surface verification |
| Stitch `approvalStatus` field + human classification | Visual-fidelity scoring — **cap 60 retained** |
| The 74 Stitch reference images | Screenshot-to-runtime comparison |
| Committed VRT baselines | Regression detection on `layout-vrt.spec.ts` |
| Accessibility tooling (none exists in the workspace) | All keyboard / screen-reader / contrast verification |

---

*Compiled 2026-08-11. No secret values are recorded in this document.*
