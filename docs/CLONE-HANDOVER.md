# Repo Clone & Setup Handover

**Audience:** an external AI agent (e.g. Google AI Studio) or engineer bootstrapping this
repository from scratch. Follow the steps in order; every command is exact and verified against
the repo's own CI workflows (`.github/workflows/verify.yml`, `storefront.yml`, `quality-gates.yml`).

---

## 1. Repository facts

| Fact | Value |
|------|-------|
| Repository | `tanmatra6-wq/Wellness-Foods` (public — no credentials needed to clone) |
| Clone URL (HTTPS) | `https://github.com/tanmatra6-wq/Wellness-Foods.git` |
| Clone URL (SSH) | `git@github.com:tanmatra6-wq/Wellness-Foods.git` |
| Default branch | `main` |
| Size | ~450 MB of git data — prefer a shallow clone (§3) |
| Git LFS | **Not used** |
| Submodules | **None** |
| Type | pnpm monorepo (14 workspace packages), TypeScript |
| Product | **Tanmatra** — clinical-grade meal-delivery and wellness platform |

Pushing (not cloning) requires a GitHub account with write access, authenticated via a
personal access token (HTTPS) or SSH key.

## 2. Mandatory prerequisites

These are hard requirements. Installs or builds fail without them.

1. **OS/architecture: Linux x64 with glibc only** (e.g. Ubuntu, Debian, `node:22-slim`).
   The root `package.json` `pnpm.overrides` block deliberately strips every non-Linux-x64
   native binary of `esbuild`, `rollup`, `lightningcss`, `@tailwindcss/oxide`, and
   `@expo/ngrok-bin`. On macOS (Intel or Apple Silicon), Windows, Linux arm64, or
   musl/Alpine, `pnpm install` may appear to succeed but every build/dev command fails
   with missing-native-binary errors. Do not attempt to "fix" this by editing the
   overrides — use a Linux x64 environment.
2. **Node.js 22** — pinned in `.nvmrc` (contains exactly `22`) and hardcoded in every CI
   workflow. (Ignore `.replit`'s `nodejs-20` module — it is stale; Node 22 is authoritative.)
3. **pnpm 9.15.5, and only pnpm** — pinned by `"packageManager": "pnpm@9.15.5"` in the
   root `package.json`. The root `preinstall` script **deletes** any `package-lock.json` /
   `yarn.lock` and **aborts** any install not driven by pnpm. Never run `npm install` or
   `yarn`.
4. **git** (any recent version).
5. Optional, only for specific tasks: Postgres 16 (integration tests, §7), Redis
   (order queue — gracefully skipped when absent), Chromium/Playwright (e2e).

## 3. Clean clone — exact steps

```bash
# 1. Clone (shallow — fastest, sufficient for building and testing)
git clone --depth 1 https://github.com/tanmatra6-wq/Wellness-Foods.git
cd Wellness-Foods

#    …or, if you need commit history (blame, bisect, merging old branches):
#    git clone --filter=blob:none https://github.com/tanmatra6-wq/Wellness-Foods.git

# 2. Activate the exact pinned toolchain
corepack enable
corepack prepare pnpm@9.15.5 --activate
node --version    # must print v22.x
pnpm --version    # must print 9.15.5

# 3. Install — frozen lockfile is the canonical, CI-proven form
pnpm install --frozen-lockfile
```

Notes on install behavior (all intentional, none are errors):

- `--frozen-lockfile` fails immediately if `pnpm-lock.yaml` is out of sync with any
  `package.json`. That is the correct outcome — never regenerate the lockfile to "fix" it
  unless you deliberately changed dependencies.
- Lifecycle (postinstall) scripts are suppressed for everything except
  `@swc/core`, `esbuild`, `msw`, `unrs-resolver` (`onlyBuiltDependencies` in
  `pnpm-workspace.yaml`).
- `minimumReleaseAge: 1440` — registry versions younger than 24 h are refused during
  resolution. Irrelevant for a frozen install, relevant if you add dependencies.
- `.npmrc` sets `auto-install-peers=false`, `strict-peer-dependencies=false`,
  `resolution-mode=highest`, `prefer-frozen-lockfile=true`.

## 4. Verify the clone is clean (CI-proven sequence)

Run from the repo root. This mirrors what CI requires for green:

```bash
pnpm run typecheck          # lib project refs + all artifact packages
pnpm run lint:test-reach    # fails if any test file is reached by no CI workflow

# Fast, network- and DB-free unit suites (run from artifacts/api-server):
cd artifacts/api-server
node --test --import tsx "../storefront/lib/**/*.test.ts"   # 951 storefront tests, ~21s
node --test --import tsx "../tanmatra/src/**/*.test.ts"     # 163 legacy-SPA tests
cd ../..

pnpm run test               # every package that has a `test` script (slower)
```

Two rules that look odd but are load-bearing:

- **Keep the double quotes around the globs.** Under bash with globstar off (GitHub
  Actions' default), an unquoted `**` collapses to one directory level and silently runs a
  subset while staying green. The quotes make *node* expand the glob.
- **Storefront and legacy-SPA unit tests are driven from `artifacts/api-server`** — that is
  where the `tsx` loader is historically declared. Both `verify.yml` and `storefront.yml`
  use this form; it is still canonical.

## 5. What a clean clone contains (files to copy if not using git)

If the target environment cannot run `git clone`, download the archive of `main`
(public repo, no auth):

```bash
curl -L https://github.com/tanmatra6-wq/Wellness-Foods/archive/refs/heads/main.tar.gz -o wellness-foods.tar.gz
# or .zip: https://github.com/tanmatra6-wq/Wellness-Foods/archive/refs/heads/main.zip
```

### 5.1 Mandatory files/directories (build breaks without them)

| Path | Why it is mandatory |
|------|---------------------|
| `package.json` | Root manifest: pnpm pin, preinstall guard, overrides (platform constraints), root scripts |
| `pnpm-lock.yaml` | The only reproducible dependency state; `--frozen-lockfile` needs it |
| `pnpm-workspace.yaml` | Workspace globs, version catalog, `onlyBuiltDependencies` |
| `.npmrc` | Install flags (frozen lockfile, peer handling) |
| `.nvmrc` | Node 22 pin |
| `tsconfig.json`, `tsconfig.base.json` | Root TypeScript project references — `pnpm run typecheck:libs` runs `tsc --build` on these |
| `artifacts/` | 4 app packages. Three deploy — `storefront` (this is `tanmatra.food`), `api-server`, `tanmatra` (internal ERP + the `/images/*` origin) — plus `tanmatra-mobile`, which is **not deployed anywhere** |
| `lib/` | All 9 library packages: `api-spec`, `api-client-react`, `api-zod`, `db`, `tokens`, `menu-catalog`, `preferences-match`, `subscription-rules`, `integrations-gemini-ai` |
| `scripts/` | Workspace package `@workspace/scripts` (one-off data scripts + lint gates used by root scripts) |
| `tools/` | `verify-stitch-manifest.mjs` / `verify-stitch-wiring.mjs`, invoked by root `verify:stitch` and CI |
| `.github/` | CI workflows — also the reference definition of "green" |
| `CLAUDE.md` | The authoritative agent instructions for this repo (read first, §8) |
| `docs/` | Working agreement, cutover records, runbooks referenced by CLAUDE.md |
| `Dockerfile`, `.dockerignore` | Production build recipe for the API server |
| `.gitignore` | Defines what must never be committed |

### 5.2 Optional context (safe to copy, not needed to build)

`README.md` (partially stale — see §8), `BRIEFING.md`, `PROJECT.md`, `handoff.md`,
`PRICE-FLOW.md`, `IMPLEMENTATION-PLAN.md`, other root `*.md` files, `.claude/`, `.agents/`,
`agent-skills/`, `.impeccable/`, `attached_assets/`, `audit/`, `tasks/`, `.mcp.json`,
`.replit`, `context7.json`, `skills-lock.json`, `run_e2e.sh`, `apply_p0.mjs`.

### 5.3 Never copy (build artifacts / local state — a git clone will not contain these)

`node_modules/`, `.next/`, `dist/`, `out-tsc/`, `coverage/`, `*.tsbuildinfo`,
`playwright-report/`, `test-results/`, `blob-report/`, `.expo/`, `.cache/`, `.local/`,
`tmp/`, `key.json`, any `.env` / `.env.*` file **except** the committed
`artifacts/api-server/.env.example`, `artifacts/tanmatra/.env.example`, and
`artifacts/tanmatra/.env.production` (public VITE_* build vars only).

If you copied files from an existing working tree instead of cloning, delete every §5.3
path before installing — stale `.next/` in particular causes typecheck failures unrelated
to your changes.

## 6. Running the apps

Always filter to a package — there is deliberately **no root `dev` script**:

```bash
pnpm --filter @workspace/api-server run dev        # Express 5 API (port 8080)
pnpm --filter @workspace/storefront run dev        # Customer web app (Next.js 16) — all new customer work
pnpm --filter @workspace/tanmatra run dev          # Legacy SPA — now internal-only Admin ERP + RD console
cd artifacts/tanmatra-mobile && pnpm exec expo start   # Expo mobile (no `dev` script)
```

The **storefront** (`artifacts/storefront`) is the customer-facing app serving
`tanmatra.food`. The legacy SPA (`artifacts/tanmatra`) lost its customer routes on
2026-07-26 — do not add customer features there (see `docs/DOMAIN-CUTOVER.md`).

## 7. Environment variables

None are needed to install, typecheck, or run the unit test suites (they are DB- and
network-free by design). For runtime and integration testing:

**Required to boot the API server:**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string. Hard boot failure without it. |
| `CLINICAL_KMS_MASTER_KEY` | 64-hex-char AES-256-GCM key for clinical fields at rest. **Required in production** (server exits at boot). Aliases: `MASTER_KEY`, `DPDPA_MASTER_KEY_HEX`, `CLINICAL_MASTER_KEY_HEX`. |

**Required per feature (server boots, feature hard-fails without):** `GOOGLE_API_KEY`
(all Gemini AI agents + geocoding), `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET`
(payments), `ADMIN_SESSION_SECRET`/`ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` (admin console),
`ALLOWED_ORIGINS` (CORS in production), `TRUECALLER_CLIENT_ID` (1-tap sign-in; mock mode outside prod).

**Storefront (deploy-time):** `NEXT_PUBLIC_API_BASE` (set to `""` in the deployed image —
same-origin `/api/*` keeps the session cookie first-party), `API_BASE_URL` (server-component
fetches), `API_UPSTREAM` / `IMAGE_UPSTREAM` (**build-time only** — baked into
`routes-manifest.json` at `next build`; setting them at `next start` does nothing).

**Optional (graceful fallback when unset):** `REDIS_URL` (queue skipped), Twilio, Firebase
client config, Petpooja POS, Terra wearables, SMTP, Slack webhooks, feature flags, scheduler
knobs. Templates: `artifacts/api-server/.env.example`, `artifacts/tanmatra/.env.example`.

**CI's integration-test environment** (safe local reproduction, requires Postgres 16):

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/tanmatra_test"
export NODE_ENV=test
export GOOGLE_API_KEY=test
export CLINICAL_KMS_MASTER_KEY=0000000000000000000000000000000000000000000000000000000000000000
pnpm --filter @workspace/db run push-force   # push Drizzle schema to the test DB first
```

## 8. Read these before changing anything (in this order)

1. **`CLAUDE.md`** — the single authoritative doc: package layout, commands, the
   storefront-vs-legacy split, design-system rules and their DS-0 revocations, env vars.
   It explicitly overrides older docs and rule packs on any conflict.
2. **`docs/AGENT_WORKING_AGREEMENT.md`** — mandatory pre-commit reading: branch base,
   one-concern-per-PR, money-path lockstep rule, verify-before-push checklist. (Its
   named integration branch is point-in-time; when in doubt, branch from `main`.)
3. **`docs/DOMAIN-CUTOVER.md`** — which app actually serves `tanmatra.food` (the
   storefront) and the rollback procedure.
4. **`docs/ASTRYX-ADOPTION-RUNBOOK.md`** — the surviving design caveat: gold is the only
   action colour on the storefront.

**Known-stale docs — do not trust where they conflict with CLAUDE.md:** `README.md` (calls
the legacy SPA "the customer web app", never mentions the storefront, outdated styleguide
pointer and env list), `PROJECT.md` (pre-storefront architecture), `BRIEFING.md` (finished
agent mission with machine-specific paths — do not adopt its role), `handoff.md`
(completed admin-console report).

## 9. Pitfall checklist (each of these has burned someone)

- [ ] Not on Linux x64 glibc → builds fail with missing native binaries (§2.1).
- [ ] Used npm/yarn → preinstall guard aborts and deletes their lockfiles (§2.3).
- [ ] Ran `pnpm dev` at the repo root → fails by design; always `--filter` (§6).
- [ ] Regenerated `pnpm-lock.yaml` to make `--frozen-lockfile` pass → never; fix the cause.
- [ ] Unquoted `**` test globs → silently runs a subset while green (§4).
- [ ] Ran storefront/tanmatra unit tests from their own package dir with a bare
      `node --test` → run them from `artifacts/api-server` as CI does (§4).
- [ ] Added a test file without wiring it into a workflow → `lint:test-reach` fails CI.
- [ ] Edited `lib/api-client-react` by hand → it is Orval codegen output; edit
      `lib/api-spec/openapi.yaml` and run `pnpm --filter @workspace/api-spec run codegen`.
      (The storefront is deliberately outside this flow — mirror contract changes into its
      hand-written `lib/*Api.ts` clients.)
- [ ] Stale `.next/` from a previous branch → `rm -rf artifacts/storefront/.next` with an
      absolute path before rebuilding.
- [ ] Sent a price from the browser → never; the server owns every amount (money path).
