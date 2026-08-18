# Dish photography — where it comes from, and why 56% of it is missing

**Status as of 2026-08-18: PARTIALLY BROKEN IN PRODUCTION.** 63 of the 112 live
dishes render a placeholder tile instead of a photograph on `tanmatra.food`.
This is not a prediction; it is measured (method at the bottom).

---

## How a dish photo reaches a customer

The catalog row's `image` field decides, and it holds one of two shapes:

| Shape | Live count | Path to the bytes |
|---|---:|---|
| `/dishes/<slug>.jpg` | **63** (56%) | storefront maps it to `/images/dishes/<slug>.jpg` (`lib/catalog.ts`), which `next.config.ts` rewrites to `IMAGE_UPSTREAM` — the legacy `tanmatra` Cloud Run service |
| `https://images.unsplash.com/…` | **49** (44%) | hotlinked straight from Unsplash's CDN by the browser |

`IMAGE_UPSTREAM` is **build-time only**: Next bakes the rewrite into
`routes-manifest.json` at `next build`, so repointing it is a rebuild, not a
restart.

This is the sole reason the legacy `tanmatra` service is still deployed. It has
had no customer routes since 2026-07-26; it is the photo origin and nothing
else (see `docs/DOMAIN-CUTOVER.md`).

---

## What is actually broken

**Every one of the 63 local paths returns HTML, not an image.**

```
GET https://tanmatra.food/images/dishes/avocado-toast.jpg
→ 200 OK   content-type: text/html   8464 bytes
```

Those 8464 bytes are the legacy SPA's `index.html`. Confirmed against the
legacy origin directly, so it is not a proxy fault:

```
GET https://tanmatra-475157072474.asia-south2.run.app/images/dishes/avocado-toast.jpg
→ 200 OK  text/html  8464 bytes      ← the SPA fallback
GET https://tanmatra-475157072474.asia-south2.run.app/manifest.webmanifest
→ 200 OK  application/manifest+json  ← a real file from public/ serves fine
```

### Root cause

The photo library is **not in the repository**. `next.config.ts` describes it as
"~280 base JPGs, ~196 MB … in the legacy app's public/ dir", but
`git ls-tree HEAD artifacts/tanmatra/public` lists **17 files and nothing under
`images/`**. The JPEGs were therefore never in the legacy service's Docker build
context, so they are absent from the deployed container.

### Why nobody noticed

Three correct behaviours compose into a silent failure:

1. The legacy app is an SPA. Its server answers **any** unmatched path with
   `index.html` and `200`, so a missing image is indistinguishable from a
   present one to anything reading only the status line.
2. `SafeImage` / `ImgWithFallback` detect the non-image response and degrade to
   a branded fallback tile. The page looks deliberate, not broken. (That code
   already anticipated this exact case — its comment describes upstream
   "disguising a 404 as HTTP 200 text/html".)
3. Nothing asserted on content-type. The synthetic monitor checked pages, not
   photo bytes.

None of the three is a bug on its own. Together they hid a total outage of over
half the menu's photography.

---

## What has been done about it

`scripts/synthetic-check.mjs` now samples the catalog's local image paths and
asserts the response is `image/*`. It runs against production every two hours
and after every deploy.

**It will fail until the library is restored.** That is intended — the outage is
real and current. It is not a monitor that can be silenced by tuning; the only
way to green is to make the photos load.

---

## Fixing it — the decision, and the options

The blocker is that **nobody in this repo has the ~196 MB of JPEGs**. They exist
in whatever working copy last deployed the legacy service, or nowhere. Recover
or re-shoot them first; everything below assumes they are in hand.

### Option A — restore the library to the legacy service (fastest)
Commit the JPEGs under `artifacts/tanmatra/public/images/dishes/` and redeploy.
Restores all 63 immediately and needs no other change.
*Cost:* ~196 MB in git forever, and it deepens the dependency on a service that
exists only to serve files.

### Option B — move the library to a bucket (recommended)
Upload to `gs://tanmatra-images`, front it with Cloud CDN, repoint
`IMAGE_UPSTREAM` at the CDN, **rebuild** the storefront.
*Cost:* one-off setup. *Benefit:* the legacy service loses its last
responsibility and can finally be retired, and photos stop being served from a
container with no caching in front of it.

### Option C — move the 63 to remote URLs
Update the catalog rows to absolute URLs, as the other 49 already are.
*Cost:* deepens a third-party dependency (below). Cheapest, weakest.

### Whichever is chosen, also fix the disguise
The SPA fallback answering `200 text/html` for `/images/*` is what made this
invisible. Whatever ends up serving `/images/`, it should return a genuine
**404** for a missing file. A real 404 would have surfaced this on day one.

---

## The other half of the catalog

The 49 Unsplash dishes are **hotlinked from a third-party CDN**
(`images.unsplash.com/photo-…?w=800&q=80`) at page-render time. They resolve
today. They are worth a separate decision, because they carry risks the local
63 do not: availability outside our control, no guarantee a given photo stays
addressable, an unreviewed licensing position for commercial menu use, and a
third-party origin in the `img-src` CSP that `next.config.ts` notes it would
like to tighten to `'self'`.

Nothing here is an emergency, and no action is proposed. It should be an
explicit choice rather than an inherited default.

---

## Reproducing the measurement

```bash
curl -s https://tanmatra.food/api/menu/public \
| python3 -c "
import json,sys
items = json.load(sys.stdin)['dishes']
local = ['/images'+d['image'] if d['image'].startswith('/dishes/') else d['image']
         for d in items if d.get('image','').startswith('/')]
print(f'{len(local)} of {len(items)} dishes use local paths')
print('\n'.join(local[:5]))
"

# then, for any of those paths — the content-type is the answer, not the status
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://tanmatra.food/images/dishes/avocado-toast.jpg
```
