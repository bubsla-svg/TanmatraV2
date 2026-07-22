# PRICE-FLOW.md — how a dish price travels catalog → DB → API → client

**Date:** 2026-07-22 · **Purpose:** Agent Brief §2 A1 exit artifact — the read-only trace that must be written before any price edit (A2). It answers the three A1 questions and states what a Stage-A price change has to touch.

## The chain

```
lib/menu-catalog/src/index.ts   (RAW_DISHES[].price, paise)   ← catalog file, the seed
        │  seed-menu-items.ts  (manual, one-shot; joins by dish name)
        ▼
DB: menu_items.pricePaise       (Postgres; editable via CMS/admin)
        │  getMergedCatalog()  (artifacts/api-server/src/lib/menuResolver.ts)
        ▼
API: merged catalog             (DB row WINS when present, else catalog)
        │  useMenuCatalog()    (artifacts/tanmatra/src/lib/menuData.ts)
        ▼
Client display                  (API price; STATIC_DISHES bundled as initialData fallback)
```

**Money authority is separate from display:** order/checkout recomputes the payable amount server-side from the DB-merged catalog (`paymentIntegrity.ts`, `payments.ts`), and the client-supplied total is advisory. So the *charged* price is always the DB-merged price, regardless of what the client renders.

## A1 answers

**1. Does the live DB re-seed from `lib/menu-catalog/src/index.ts`, or was it seeded once (drifted)?**
Seeded once, and it can drift. `scripts/src/seed-menu-items.ts` populates `menu_items` from `DISHES`, but it is a **manual script, not a deploy step** — nothing re-runs it. The API then treats the DB as an **overlay that overrides the catalog**: in `getMergedCatalog` (`menuResolver.ts:81`), when a `menu_items` row exists for a slug the served price is `row.pricePaise`; only slugs with **no** DB row fall back to the catalog `price` (`:71`). **Consequence: for any dish that has a DB row, editing only the catalog file changes nothing the customer sees or is charged.**

**2. Does any client component hold a hardcoded or bundled price?**
- **Dish prices:** no hardcoded literals. The client reads `useMenuCatalog()` (React Query against the API) with `initialData: STATIC_DISHES` — i.e. the catalog is **bundled into the hashed JS** and shown as a fallback until the API responds, then replaced by the API (DB-authoritative) price. A stale catalog price can therefore *flash* pre-hydration, but the bundle is busted on every deploy (hashed filenames).
- **Subscription / plan prices:** centralized in the shared pure module `lib/subscription-rules/src/pricing.ts`, imported by both the server (`/subscriptions/quote` + create) and the web wizard fallback — the header documents that this replaced three divergent client copies, so a marketed subscription price can no longer drift from the billed one.

**3. Does any cached layer serve stale prices?**
- **Service worker (`artifacts/tanmatra/public/sw.js`):** `/api/*` is **network-only, never cached** (`:51-52`, explicitly to keep menu/order data fresh). Static assets (incl. the bundled `STATIC_DISHES`) are cache-first 30-day, but hashed filenames + the `CACHE_NAME` bump/prune flush them on release. → **No stale prices from the SW for live API data.**
- No CDN `s-maxage` / static-props price caching on the menu path was found.

## What a Stage-A price change (A2) must touch — atomically

Because the DB overlay wins, applying `stageA_paise` from `tanmatra-stageA-prices.csv` must update **both**:

1. `lib/menu-catalog/src/index.ts` — each dish `price` (keeps the seed/fallback correct), **and**
2. DB `menu_items.pricePaise` — for **every seeded slug** (this is what the API serves and checkout charges).

Match rows by **id**, fall back to **exact name**, and **report any mismatch** — do not fuzzy-match, do not recompute or round (the CSV arithmetic is authoritative). The DB + file writes are the single revertible unit; A3 server price authority (already shipped) must be green first so a raised price can't be undercut by a client-supplied total.

> **Status:** A2 is **blocked** — `tanmatra-stageA-prices.csv` was not among the provided inputs. This trace is ready; the price application lands the moment the CSV is shared.
