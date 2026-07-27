# Domain cutover — tanmatra.food → the storefront service

**Status: complete.** `tanmatra.food` and `www.tanmatra.food` are served by the
**storefront** Cloud Run service (Next.js), not by the legacy `tanmatra` SPA
service. Verified from the outside on 2026-07-25; evidence in §2.

Not to be confused with [`LIVE-CUTOVER.md`](LIVE-CUTOVER.md), which is the
*money-path* cutover — turning the storefront's checkout stubs into live
Razorpay calls. This file is only about which service the public domain points
at. Four comments in the repo point here: `.github/workflows/deploy.yml` lines
372, 440 and 565, and `artifacts/storefront/Dockerfile` line 42.

---

## 1. The three services

All three live in GCP project `brand-tanmatra-tmg`, region `asia-south2`, and
are deployed by `.github/workflows/deploy.yml`. **A push to `main` auto-deploys
the `storefront` service only** — which, since the cutover, is the service
behind `tanmatra.food`, so a merge reaches customers unattended. It captures
the serving revision first and rolls itself back if the smoke or deploy-truth
check fails. `wellness-foods` (api-server) and the legacy `tanmatra` service
remain manual `workflow_dispatch` only, because this pipeline applies no
database migrations.

| Cloud Run service | Package | Role |
|---|---|---|
| `wellness-foods` | `artifacts/api-server` | Express API. Owns every amount. |
| `tanmatra` | `artifacts/tanmatra` | Legacy React/Vite SPA. **No longer fronted by the domain.** Still deployed; still the source of `/images` for the storefront (`IMAGE_UPSTREAM`). |
| `storefront` | `artifacts/storefront` | Next.js rebuild. **This is what tanmatra.food serves.** |

The storefront reaches the API two ways, and they are configured at different
times. `API_BASE_URL` is a **runtime** env var (`--update-env-vars`) read by
server-component fetches. `API_UPSTREAM` and `IMAGE_UPSTREAM` must be **build
args**: `next.config`'s `rewrites()` are evaluated during `next build` and
baked into `routes-manifest.json`, so a runtime value cannot enable the
same-origin `/api` and `/images` proxy hops. deploy.yml passes them both ways;
only the build-arg pass is load-bearing for the rewrites.
`NEXT_PUBLIC_API_BASE` is deliberately built empty so the browser always takes
the same-origin hop rather than a cross-origin one.

## 2. How to verify, and what it proved

Every claim about what is deployed is settled by the deploy-truth endpoint —
`app/api/build/route.ts` in the storefront, `server/static-server.mjs` in the
legacy SPA. The two return **different shapes**, which is what makes them
useful for telling the services apart:

```bash
curl -s https://tanmatra.food/api/build
# {"sha":"e43e51c8…","builtAt":"2026-07-25T02:21:39.173Z","app":"tanmatra-web"}

curl -s https://storefront-475157072474.asia-south2.run.app/api/build
# {"sha":"e43e51c8…","builtAt":"2026-07-25T02:21:39.173Z","app":"tanmatra-web"}

curl -s https://tanmatra-475157072474.asia-south2.run.app/api/build
# {"sha":"5176c113…","builtAt":"2026-07-23T08:51:17Z","service":"tanmatra"}
```

The domain and the storefront service return the same `sha` **and the same
`builtAt` to the millisecond**. `builtAt` is process boot time, so identical
values mean the same running process, not merely the same commit. The legacy
service answers with a different, older sha and the key `service` rather than
`app`. Headers agree: the domain sends `x-powered-by: Next.js` and
`x-nextjs-prerender`, the legacy origin sends neither.

This is external evidence. The authoritative check is the mapping itself, which
needs gcloud credentials this repo's CI does not hand out for reads:

```bash
gcloud run domain-mappings list --region asia-south2 --project brand-tanmatra-tmg
```

## 3. What the four in-repo references mean now

`deploy.yml` line 372 — the `frontend-cloud-run` job's "Domain notice". It
deploys the legacy `tanmatra` service and then reports that `tanmatra.food` is
not on that revision. Post-cutover that mismatch is permanent and expected, so
the step is now a standing no-op notice. It is non-fatal by design; leave it
non-fatal. Do not confuse it with the *deploy-truth* assert added to the same
job later (PR #403), which compares the running revision's `/api/build` sha
against the deployed commit and IS fatal — that one guards against the service
serving a stale revision, which is a different failure from the domain pointing
elsewhere.

`deploy.yml` line 440 — `NEXT_PUBLIC_SITE_URL=https://tanmatra.food` as a
storefront build arg. This is now correct rather than aspirational: canonical
tags, `robots.txt`, `sitemap.xml` and every JSON-LD `@id` (all sourced from
`lib/siteUrl.ts`) point at the domain that actually serves the pages.

`deploy.yml` line 565 — the `storefront-cloud-run` job's domain notice, which
checks that `tanmatra.food` reports both this workflow's sha and
`app=tanmatra-web`. That condition is now satisfiable, so the comment's own
instruction ("flip to fatal once the domain is permanently on the storefront")
is unblocked. It is deliberately still non-fatal — see §4.

`artifacts/storefront/Dockerfile` line 42 — documents the
`NEXT_PUBLIC_SITE_URL` ARG. The default stays `""` so a bare `docker build`
falls back to the run.app origin in `lib/siteUrl.ts`; production gets the real
value from deploy.yml.

## 4. Open follow-ups (owner decisions, not code changes to make blindly)

**Flip the storefront domain check to fatal.** The gate would then fail a
storefront deploy whose revision never reaches `tanmatra.food`. The reason to
wait: a certificate-propagation blip or a deliberate temporary rollback would
red an otherwise-good deploy, and the fatal `Assert deployed sha` step against
the service's own run.app URL already catches the failure this would catch.
Worth doing once the mapping has been stable across several deploys.

**Decide the legacy `tanmatra` service's fate.** It is still built and deployed
on every change under `artifacts/tanmatra/**` or `lib/**`, and no user-facing
domain routes to it. It is not dead weight yet — the storefront's
`IMAGE_UPSTREAM` points at it for `/images`, so switching it off would break
imagery. Either move the image assets and retire the service, or keep it and
say so here, but do not leave the question implicit.

## 5. Rolling back

Re-point the domain mapping at the `tanmatra` service. Two consequences to
expect: the storefront's baked `NEXT_PUBLIC_SITE_URL` still says
`https://tanmatra.food`, so its canonicals would advertise a domain it no
longer serves until the next build; and the legacy service's last deployed sha
may lag main by however long the cutover lasted, so redeploy it rather than
assuming the running revision is current.
