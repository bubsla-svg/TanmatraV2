# Defect register

17 defects: 7 CRITICAL, 5 MAJOR, 3 MODERATE, 2 MINOR — 3 CRITICAL + 3 MAJOR now
RESOLVED: CARECONDITION-001 and ROUTE-RULING-001 from the Phase 3 decision
gates, TRIALCTA-001 from Phase 4.2 (CRITICAL), and PANTRY-001 (Phase 4.2),
MARKETPLACE-001 (Phase 4.3), and GROUPORDER-001 (Phase 4.4, this PR) (MAJOR).
Machine-readable form: `defects.json`. IDs
prefixed `DEF-RECON-` are new findings from this sweep; IDs without that
prefix are carried forward from `docs/stitch/stitch-defect-register.md`
(already tracked against the Stitch manifest) and included here only for
completeness of the Phase-ordered plan in `implementation-plan.md`.

## CRITICAL

| ID | Area | Summary | Status |
|---|---|---|---|
| DEF-RECON-ZEROPAYABLE-001 | Money path | Client calls `createRazorpayOrder` unconditionally; server 409s a zero-payable (fully credited) order and the client has no recovery branch — a fully-covered subscription looks like a failed checkout to the customer. | Open |
| DEF-RECON-CARECONDITION-001 | Clinical safety | `/care/[condition]` had no allowlist gate — any slug rendered synthesized "Clinical Objectives" copy. | **RESOLVED** — kept the free-text catch-all (no `notFound()`, no new fetch surface, per the standing product ruling), but stripped the clinical framing for unmapped slugs. |
| DEF-RECON-ROUTE-RULING-001 | Route ruling | Approved ruling declared `/corporate` canonical; it was a placeholder. | **RESOLVED** — flipped canonical status onto `/corporate-wellness` (the real page) via a 308 redirect + nav/sitemap cleanup. |
| DEF-RECON-DEADLINKS-001 | Legal & company routes | 9 nav targets 404: `/about`, `/faq`, all 6 `/legal/*` documents, `/wellness`. Reachable from the footer on every page. | Open — `/wellness` link removed (see MODERATE), the other 8 (legal docs + about/faq) still pending restoration. |
| DEF-RECON-TRIALCTA-001 | Trial funnel | `/trial`'s purchase CTA disappears once cart has items, and `FocusLayout` never mounts the `MiniCartBar` that's supposed to replace it — dead end. | **RESOLVED** — removed the `cart.lines.length === 0` guard; the sticky Start bar always renders now, since `FocusLayout` mounts no `MiniCartBar` to ever take the bottom edge. |
| DEF-J2-PLANCONFIG-001 | Journey 2 | Plan-configuration state machine (6.2–6.7, 14.3, 14.4 — 8 screens) does not exist. Carried from the Stitch defect register, confirmed in this sweep's matrix. | Open |
| DEF-J4-CUSTOMBUILD-001 | Journey 4 | Custom-build 12-stage wizard (7.2–7.10 — 9 screens) does not exist anywhere in the repo, including quarantine. Carried from the Stitch defect register, confirmed in this sweep's matrix. | Open |

## MAJOR

| ID | Area | Summary |
|---|---|---|
| DEF-RECON-PLACEHOLDERS-001 | Routes | 4 remaining live routes are `PlaceholderPage` stubs (`/corporate/[slug]`, `/team`, `/group/[code]`, `/office-lunch/[id]`) — `/corporate` itself resolved above. `/team` is in general nav. |
| DEF-RECON-MARKETPLACE-001 | Marketplace | `payForMarketplace()` + `POST /marketplace/checkout` are complete and tested; zero active callers. | **RESOLVED** — ported the already-grounded "Place order" flow from a quarantined pre-Stitch-74 PDP into a new `MarketplaceBuyNow.tsx`, wired alongside the existing cart-only Add to Order button (ship-only; bundle-with-order left for a follow-up). |
| DEF-RECON-GROUPORDER-001 | Group orders | Full lifecycle exists client+server; the only hosting screen (`/group/[code]`) is a placeholder, exposing a partial revenue journey (join works, cart/close/pay doesn't). | **RESOLVED** — restored a grounded, already-token-compliant `GroupOrderView` from quarantine; fixed a stale `/checkout` route target (now needs `?mode=alacarte`) surfaced during e2e testing. Group creation itself has no UI entry point anywhere (a pre-existing, documented deferral, not new scope). |
| DEF-RECON-PANTRY-001 | Wellness / pantry scan | "Add to Subscription" button has no `onClick` at all. | **RESOLVED** — the suggestions are catalogue dishes, not a subscription add-on, so wired to the cart mutation path (`addLine`, same as `CustomBuildHub`) and relabeled "Add to cart". |
| DEF-RECON-5.5-REVIEWS-001 | Dish PDP | Complete, tested dish-review feature (client + server + AI digest) has zero importers from the live PDP. |

## MODERATE

| ID | Area | Summary |
|---|---|---|
| DEF-RECON-WELLNESS-001 | Nav | `/wellness` dead link. | **RESOLVED** — removed the link rather than guess at intent; quarantined candidate page left untouched for a future decision. |
| DEF-9.2-ACTIONS-001 | 9.2 Manage Delivery | Sheet has reschedule + swap; missing Pause, Add meal, Change address, Get help, and the one-unavailable-reason row. |
| DEF-10.9-FEEDBACK-001 | 10.9 Meal Feedback | Complete UI, zero importers, no backend contract. |

## MINOR

| ID | Area | Summary |
|---|---|---|
| DEF-9.2-DELIVERY-ROUTE-001 | 9.2 Manage Delivery | Reachable from `/account/subscriptions`, not the approved `/meal-planner` overlay. |
| DEF-RECON-LANDINGHERO-001 | B2B landing pages | `LandingHero.tsx` renders its hero as a semantic `<header>`, producing two `<header>` landmarks on any page composing it inside `B2BLayout`'s own chrome header (`/corporate-wellness`, `/partners/gyms`, `/partners/fitness-clubs`). Surfaced incidentally by re-pointing the b2b-shell e2e test at the real page instead of the old `/corporate` placeholder. |

## Not a defect — recorded corrections to this sweep's own mechanical pass

- `components/primitives/DpdpaConsentCapture.tsx` was flagged zero-importer by the
  import-graph regex; it is actually wired into 4 active checkout components. False
  positive, corrected in `prebuilt-component-inventory.md` §B4.
- `docs/stitch/stitch-defect-register.md`'s entries for 5.3, 14.2, 8.2, 14.6, 11.1
  already show `defectIds: []` in the current manifest — these were fixed in the
  prior session (PR #59, merged `308f9de`). `proof.localRuntime` remains `pending`
  for most of them because no post-fix screenshot evidence was captured — that is
  the correct, conservative NOT VERIFIED state per this sweep's evidence rule, not
  an open defect.
