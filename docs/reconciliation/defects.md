# Defect register

16 defects: 7 CRITICAL, 5 MAJOR, 3 MODERATE, 1 MINOR. Machine-readable form:
`defects.json`. IDs prefixed `DEF-RECON-` are new findings from this sweep; IDs
without that prefix are carried forward from `docs/stitch/stitch-defect-register.md`
(already tracked against the Stitch manifest) and included here only for
completeness of the Phase-ordered plan in `implementation-plan.md`.

## CRITICAL

| ID | Area | Summary |
|---|---|---|
| DEF-RECON-ZEROPAYABLE-001 | Money path | Client calls `createRazorpayOrder` unconditionally; server 409s a zero-payable (fully credited) order and the client has no recovery branch — a fully-covered subscription looks like a failed checkout to the customer. |
| DEF-RECON-CARECONDITION-001 | Clinical safety | `/care/[condition]` has no allowlist gate — any slug renders synthesized "Clinical Objectives" copy. Conflicts with a documented prior product ruling; needs resolution, not a unilateral fix. |
| DEF-RECON-ROUTE-RULING-001 | Route ruling | Approved ruling declares `/corporate` canonical; it's a placeholder. The real page (`/corporate-wellness`) is the one the ruling would redirect away. |
| DEF-RECON-DEADLINKS-001 | Legal & company routes | 9 nav targets 404: `/about`, `/faq`, all 6 `/legal/*` documents, `/wellness`. Reachable from the footer on every page. |
| DEF-RECON-TRIALCTA-001 | Trial funnel | `/trial`'s purchase CTA disappears once cart has items, and `FocusLayout` never mounts the `MiniCartBar` that's supposed to replace it — dead end. |
| DEF-J2-PLANCONFIG-001 | Journey 2 | Plan-configuration state machine (6.2–6.7, 14.3, 14.4 — 8 screens) does not exist. Carried from the Stitch defect register, confirmed in this sweep's matrix. |
| DEF-J4-CUSTOMBUILD-001 | Journey 4 | Custom-build 12-stage wizard (7.2–7.10 — 9 screens) does not exist anywhere in the repo, including quarantine. Carried from the Stitch defect register, confirmed in this sweep's matrix. |

## MAJOR

| ID | Area | Summary |
|---|---|---|
| DEF-RECON-PLACEHOLDERS-001 | Routes | 5 live routes are `PlaceholderPage` stubs (`/corporate`, `/corporate/[slug]`, `/team`, `/group/[code]`, `/office-lunch/[id]`); `/team` and `/corporate` are in general nav. |
| DEF-RECON-MARKETPLACE-001 | Marketplace | `payForMarketplace()` + `POST /marketplace/checkout` are complete and tested; zero active callers. |
| DEF-RECON-GROUPORDER-001 | Group orders | Full lifecycle exists client+server; the only hosting screen (`/group/[code]`) is a placeholder, exposing a partial revenue journey (join works, cart/close/pay doesn't). |
| DEF-RECON-PANTRY-001 | Wellness / pantry scan | "Add to Subscription" button has no `onClick` at all. |
| DEF-RECON-5.5-REVIEWS-001 | Dish PDP | Complete, tested dish-review feature (client + server + AI digest) has zero importers from the live PDP. |

## MODERATE

| ID | Area | Summary |
|---|---|---|
| DEF-RECON-WELLNESS-001 | Nav | `/wellness` dead link — unclear if it should be a new public page or point at `/account/wellness`. |
| DEF-9.2-ACTIONS-001 | 9.2 Manage Delivery | Sheet has reschedule + swap; missing Pause, Add meal, Change address, Get help, and the one-unavailable-reason row. |
| DEF-10.9-FEEDBACK-001 | 10.9 Meal Feedback | Complete UI, zero importers, no backend contract. |

## MINOR

| ID | Area | Summary |
|---|---|---|
| DEF-9.2-DELIVERY-ROUTE-001 | 9.2 Manage Delivery | Reachable from `/account/subscriptions`, not the approved `/meal-planner` overlay. |

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
