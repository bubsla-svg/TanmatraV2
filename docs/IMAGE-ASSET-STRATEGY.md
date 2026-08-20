# Dish photography — how 56% of it went missing, and how it was restored

**Status: RESOLVED in this branch, pending deploy.** All 63 affected photos have
been recovered and re-encoded; the origin bug that hid the outage is fixed.

The original diagnosis said the library "exists in no clone" and would need
re-shooting. **That was wrong**, and the error mattered — it made a
one-command recovery look like a photography project. Every one of the 63 was
sitting in this repository's own git history the whole time.

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

Commit `7656b473` (2026-08-02, "chore: remove all raster image assets") deleted
all 3,065 tracked rasters — 368 MB, 97% of the repo's tracked bytes — "ahead of
a full image redo". The redo had not happened 16 days later.

Nothing in that change connected "tracked under `artifacts/tanmatra/public/`"
to "served to paying customers at `/images/dishes/`", so a repo-hygiene commit
silently took out over half the menu's photography.

Worth noting for the next such cleanup: it did not even achieve its stated aim.
`git count-objects` still reports a **480 MB** pack, because the blobs remain in
history — the deletion shrank the working tree, not the clone. The saving was
largely illusory; the outage was not.

Historically the photo library is **not in the working tree**. `next.config.ts` describes it as
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

**1. The origin no longer disguises a missing file.** `static-server.mjs` now
returns a real `404` for a missing *file* while a missing *route* still gets the
SPA shell. Both halves are asserted — a 404 on `/menu` would be worse than the
bug being fixed.

**2. All 63 photos are restored.** Recovered from `7656b473^` / `a70b2754^` and
re-encoded: 51.5 MB of near-uncompressed 1024px masters became **16 MB**, an 84%
reduction at mean 132 KB, plus the `-200/-400/-800` derivatives
`lib/imageLoader.ts` redirects to. Stored once under `public/images/dishes/`;
the catalog's own `/dishes/<slug>.jpg` spelling is aliased onto that path rather
than kept as a second copy.

Verified end-to-end against the real container layout (`COPY build/client
./public`), not just unit-tested: all 63 serve `200 image/jpeg` under **both**
spellings, derivatives resolve, a missing photo still 404s, and `/menu` still
returns the shell.

**3. The detector stays.** `scripts/synthetic-check.mjs` asserts `image/*`
rather than a status code. It still fails against production until this branch
deploys — which is the point; it is the check that would have caught the
original outage on day one.

---

## Where the library should ultimately live

Restoring to the repo fixes production now; it is not the end state. The
options below stand, and Option B remains the destination.

The decision taken here was to restore rather than wait: the site is visibly
broken in customer-facing flows today, the 16 MB is 3.5% of a pack that already
carries the 368 MB of originals, and it is revertible in one commit once a
bucket exists.

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
