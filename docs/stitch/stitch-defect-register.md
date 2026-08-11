# Stitch wiring defect register

IDs referenced by `stitch-screen-manifest.json` `defectIds`. Append-only; mark
`fixed@<sha>` rather than deleting. Classification vocabulary per the wiring
instructions §12.

| ID | Entries | Class | Defect |
|---|---|---|---|
| DEF-J2-PLANCONFIG-001 | 6.3 6.4 6.5 6.6 6.7 14.3 14.4 | rebuild | Plan-configuration journey not contract-equivalent; rebuild Journey 2 UI over merged A2 plan-draft contracts |
| DEF-J4-CUSTOMBUILD-001 | 7.2–7.10 | rebuild | Custom-build 6-stage wizard absent; CustomBuildHub is not contract-equivalent |
| DEF-5.3-FILTERSHEET-001 | 5.3 | partial stub | Menu filter is inline chips; approved bottom-sheet overlay with allergen/macro facets missing |
| DEF-6.2-MEALTIME-001 | 6.2 | missing source | Mealtime/delivery-context sheet on /plans never built |
| DEF-6.5-CHANGEDISH-001 | 6.5 | missing source | Pre-checkout Change Dish sheet missing (server candidates endpoint exists: `planDraftLineup.ts`) |
| DEF-6.6-ACCOMP-001 | 6.6 | missing source | Accompaniment editor missing (server schema exists) |
| DEF-6.9.3-CADENCE-001 | 6.9.3 | wrong content | **RESOLVED — superseded by TNM-CRO-01 D-04B owner ruling (2026-08-11).** Was: quick-setup step 3 ships Diet Profile; approved step was Cadence/Schedule. The ruling redefines the whole contract to exactly three one-question viewports (goal → dietary style → allergens) with deterministic exit routing — step 3 is now Allergens by design, not a Cadence/Schedule gap. |
| DEF-8.2-QUOTEEXPIRY-001 | 8.2 | missing source | No server-driven 409 QUOTE_EXPIRED recovery; client freshness timer only (Pattern E violation) |
| DEF-9.2-DELIVERY-ROUTE-001 | 9.2 | wrong route | ManageDeliverySheet reachable from /account/subscriptions, not the approved /meal-planner overlay |
| DEF-9.2-ACTIONS-001 | 9.2 | partial stub | Sheet lacks pause / add / address actions from the approved contract |
| DEF-10.9-FEEDBACK-001 | 10.9 | unwired source | MealFeedback component has zero importers and no submit API |
| DEF-11.1-PLACEHOLDER-001 | 11.1 | partial stub | /metabolic renders PlaceholderPage |
| DEF-12.4-GYMVERIFY-001 | 12.4 | missing source | Gym member-verification flow never built |
| DEF-14.2-MENUEMPTY-001 | 14.2 | missing source | No no-matching-meals empty state on /menu |
| DEF-14.3-GENLOADING-001 | 14.3 | missing source | No plan-generation loading state (server FSM emits `generating`) |
| DEF-14.4-GENERROR-001 | 14.4 | missing source | No generation-failed recovery state (server FSM emits `generation_failed`) |
| DEF-14.6-PAYPROCESSING-001 | 14.6 | partial stub | Payment-processing is an inline label, not the approved distinct screen state |
