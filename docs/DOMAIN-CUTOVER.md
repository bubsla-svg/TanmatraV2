# Domain cutover runbook — `tanmatra.food` → storefront

**Audience:** a GCP operator/agent with access to project `brand-tanmatra-tmg`.
**Goal:** make `https://tanmatra.food` render the **`storefront`** Cloud Run
service (Next.js) instead of the legacy **`tanmatra`** service (Vite SPA).

> Status: pre-launch — **not live**, so a hard swap with a brief HTTPS gap is
> acceptable. Option 1 is the immediate path; Option 2 is the zero-404 path to
> run before real users.

---

## Constants

| Thing | Value |
|---|---|
| Project | `brand-tanmatra-tmg` |
| Region | `asia-south2` |
| Domain | `tanmatra.food` (and `www.tanmatra.food` if in use) |
| Target service | `storefront` |
| Current service on the domain | `tanmatra` (legacy SPA) |
| api-server (do **not** touch) | `wellness-foods` |

**How the domain works today:** `tanmatra.food` is a **Cloud Run domain mapping
on the `tanmatra` service** (Google Frontend). The swap re-points that mapping to
`storefront`. The storefront proxies `/api/*` → api-server and `/images/*` → the
legacy `tanmatra` **run.app URL**, both same-origin — so no CORS, cookie, or DNS
work is required just to render.

---

## Preconditions (verify before any change)

```bash
gcloud config set project brand-tanmatra-tmg

# 1. Executing identity can manage domain mappings (needs roles/run.admin or
#    run.domainmappings.* ). Confirm you can list mappings:
gcloud beta run domain-mappings list --region asia-south2

# 2. Domain is verified for this project (delete+create retains verification —
#    it's account-level via Search Console, independent of the mapping):
gcloud domains list-user-verified   # expect tanmatra.food in the list

# 3. Target service is healthy and on the intended build:
gcloud run services describe storefront --region asia-south2 \
  --format='value(status.url)'
curl -sS https://storefront-475157072474.asia-south2.run.app/api/build
#   → expect {"sha":"<current>","app":"tanmatra-web", ...}
```

**Do NOT delete or stop the legacy `tanmatra` service** — the storefront pulls
dish photos from its run.app URL (`IMAGE_UPSTREAM`) until images move to a
bucket/CDN. The swap only moves the *hostname*, not the service.

---

## Step 0 — capture current state (rollback safety)

```bash
# Record the existing mapping (current service + the required DNS resourceRecords):
gcloud beta run domain-mappings describe --domain tanmatra.food \
  --region asia-south2 > tanmatra-mapping-BEFORE.txt
cat tanmatra-mapping-BEFORE.txt   # note spec.routeName == "tanmatra" and the DNS records

# Record what the domain serves right now (for verification/rollback):
curl -sS https://tanmatra.food/api/build   # → expect {"service":"tanmatra", ...}
```

---

## Step 1 — the mapping swap (Option 1, pre-launch)

A host can map to only **one** service per region, so the old mapping must be
deleted before the new one is created (this opens a brief unreachable/HTTPS-invalid
window — acceptable while not live).

```bash
# 1a. Remove the mapping from the legacy service
gcloud beta run domain-mappings delete --domain tanmatra.food \
  --region asia-south2 --quiet

# 1b. Create the mapping on the storefront service
gcloud beta run domain-mappings create --service storefront \
  --domain tanmatra.food --region asia-south2

# 1c. (only if www is used) map the www host too
gcloud beta run domain-mappings create --service storefront \
  --domain www.tanmatra.food --region asia-south2
```

**DNS:** the `create` command prints the `resourceRecords` the domain needs.
Compare them to `tanmatra-mapping-BEFORE.txt`:
- Apex `tanmatra.food` already points at Google's standard ghs A/AAAA set (that's
  how it reached the `tanmatra` service). Cloud Run uses the **same** frontend for
  all services, so the records are **identical** → **no DNS change needed**.
- Only if `create` shows records that differ from what's live, update them at the
  registrar/DNS provider, then wait for propagation.

**Wait for the managed cert on the new mapping:**
```bash
watch -n 30 "gcloud beta run domain-mappings describe --domain tanmatra.food \
  --region asia-south2 --format='value(status.conditions)'"
# proceed when the CertificateProvisioned / Ready conditions are True
```

---

## Step 2 — verify the cutover

```bash
# Serves the storefront (app marker + storefront sha):
curl -sS https://tanmatra.food/api/build
#   → {"sha":"<storefront sha>","app":"tanmatra-web", ...}   (NOT "service":"tanmatra")

# Home + a storefront-only route render:
curl -s -o /dev/null -w '/ %{http_code}\n'                 https://tanmatra.food/
curl -s -o /dev/null -w '/account/preferences %{http_code}\n' https://tanmatra.food/account/preferences
#   → both 200  (/account/preferences exists on storefront, not the legacy SPA)

# TLS is valid (0 = verified):
curl -sS -o /dev/null -w 'tls_verify=%{ssl_verify_result}\n' https://tanmatra.food/

# api proxy still first-party through the new host:
curl -s -o /dev/null -w '/api/menu/public %{http_code}\n' https://tanmatra.food/api/menu/public
#   → 200

# images still proxy (dish photo through the storefront on the domain):
curl -s -o /dev/null -w '/images %{http_code}\n' "https://tanmatra.food/images/dishes/$(
  curl -s https://tanmatra.food/api/menu/public | python3 -c 'import json,sys;d=json.load(sys.stdin);i=d if isinstance(d,list) else d.get("dishes") or d.get("items") or [];print((i[0].get("slug","") if i else "")+".jpg")')"
#   → 200 (or the image host's success code)
```

---

## Rollback (one command pair)

```bash
gcloud beta run domain-mappings delete --domain tanmatra.food \
  --region asia-south2 --quiet
gcloud beta run domain-mappings create --service tanmatra \
  --domain tanmatra.food --region asia-south2
# verify: curl -sS https://tanmatra.food/api/build  → {"service":"tanmatra", ...}
```

---

## Coherence follow-ups (engineering — not the GCP agent)

These are code/config changes tracked separately; the GCP agent should just be
aware:

1. **`deploy.yml` will red-fail after cutover.** The `frontend-cloud-run`
   (tanmatra) job asserts `curl tanmatra.food/api/build == <sha>`. Once the domain
   serves the storefront, that assert returns the storefront's sha and the legacy
   job fails. Eng will relocate the domain deploy-truth assert to the `storefront`
   job. **Until then, a failing `frontend-cloud-run` domain assert is expected —
   not a real outage.**
2. **`synthetic-prod-check.yml`** curls `https://tanmatra.food` — eng repoints its
   assertions to the storefront.
3. **SEO** — eng sets `NEXT_PUBLIC_SITE_URL=https://tanmatra.food` (build arg) so
   `robots.txt` / `sitemap.xml` / canonical / OG stop emitting the run.app origin.
4. **Firebase Authorized domains** — confirm `tanmatra.food` is listed (it is, for
   the legacy app) so OTP sign-in works.

---

## Consequence to accept (Option 1)

A straight swap means **every route not yet ported to the storefront 404s on
`tanmatra.food`** — the ~43 route-parity routes **and** the 18 `admin/*` routes.
`tanmatra.food/admin/*` becomes reachable only via the legacy `tanmatra` run.app
URL. Fine while not live; not acceptable for real users mid-migration — use
Option 2 before launch.

---

## Option 2 — zero-404 incremental cutover (external HTTPS load balancer)

Run this **before real users** so admin + not-yet-ported routes keep working while
the parity waves land. It replaces the Cloud Run domain mapping with a global
external Application Load Balancer whose URL map routes by path.

High-level (global external Application LB, project `brand-tanmatra-tmg`):

1. **Remove the Cloud Run domain mapping** for `tanmatra.food` (LB and domain
   mapping can't both own the host).
2. **Reserve a global static IP:**
   `gcloud compute addresses create tanmatra-lb-ip --global`
3. **Serverless NEGs** (region `asia-south2`), one per service:
   `gcloud compute network-endpoint-groups create neg-storefront --region asia-south2 --network-endpoint-type serverless --cloud-run-service storefront`
   (and `neg-tanmatra` → `tanmatra`).
4. **Backend services** (global, `EXTERNAL_MANAGED`) each with its NEG as backend.
5. **URL map** — default backend → `storefront`; path matchers → `tanmatra`:
   - `/admin/*`, `/rd-console/*`
   - every not-yet-ported customer path (shrinks as parity waves ship —
     drive the list from `docs/STOREFRONT-ROUTE-PARITY.md`).
6. **Google-managed cert** for `tanmatra.food` (+ `www`), **target HTTPS proxy**,
   and a **global forwarding rule** on the reserved IP (:443). Add an HTTP→HTTPS
   redirect forwarding rule on :80.
7. **DNS** — point `tanmatra.food` A/AAAA at the reserved LB IP (this **does**
   change DNS, away from the domain-mapping ghs records). Wait for cert + DNS.
8. **Verify** each path class routes to the right backend (a storefront route →
   storefront; `/admin/login` → legacy).
9. **As each parity wave ships**, delete its path from the `tanmatra` matcher so
   the storefront serves it — until only genuinely-legacy paths (admin) remain.

---

## Gotchas

- **One host → one service per region.** Delete before create (Option 1 gap).
- **Keep the legacy `tanmatra` service running** — image proxy + (Option 2)
  admin/legacy backend depend on it.
- **Never touch `wellness-foods`** (api-server) or its URL — the storefront and
  the legacy SPA both depend on it.
- **Cert provisioning** on a fresh mapping/LB can take minutes (occasionally up to
  ~24h); HTTPS may warn until Ready.
- Cloud Run domain mappings are **regional** and supported in `asia-south2` (the
  current mapping proves it) — no region migration needed for Option 1.
