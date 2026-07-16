# Stitch Design QA — honesty & content audit of canvas designs

A visual + text-level QA pass over the Stitch canvas ("Tanmatra Premium Home",
189 frames) run before the production port, because the original ~127 designs
predate the honest-health-data standard (§10 of `stitch-design-coverage.md`).
Method: screenshot review of each suspect screen, then text-level verification
of fixes by grepping the generated HTML for banned claims.

## Verdicts — 16 screens QA'd

### Pre-audit suspects (10)

| Screen | Verdict | Finding |
|---|---|---|
| PDP Trust & Recommendations | ❌ FAIL → **fixed** | "RD REVIEW: CHECKED" tile; "RD Verification Review" card with two fabricated reviewers, forged signature, cardiovascular-outcome claims; invented chef attribution. |
| Subscription Plans Landing | ❌ FAIL (content drift) → **replaced (v2)** | Thin 3-card list vs the live page's filters, real-dish carousels, RD goal plans, FAQ — porting would delete CRO content. |
| Gyms & Fitness Landing | ◑ PARTIAL → **fixed + split** | B2B-only (no design existed for `/partners/fitness-clubs`); invented brand; fabricated "142 / 87%" analytics. |
| Premium PDP Hero & Stats | ✅ pass | Stats data-bindable; no unbacked badges. |
| Meal Review & Rating | ✅ pass | Collects a rating (input stars) — honest by construction. |
| Referral Hub: Clinical Gift Credit | ✅ pass (note) | `$` → ₹ binding at port; sample history rows are obvious placeholders. |
| Trial Recap & Upgrade Bridge | ✅ pass (note) | Saving % + `$` amounts are placeholders the port must data-derive (port brief §3). |
| Loyalty Tiers & Benefits | ✅ pass (note) | Tier benefits bind to the real loyalty program; service-level copy must match actual terms. |
| Metabolic Rewards Center | ✅ pass | Points/catalog data-bindable. |
| Dietitian Clinical Profile | ✅ pass (note) | Placeholder persona → bind to real RD records; verification check must be backed by the rd-applications flow. |

### Post-purchase set (6)

| Screen | Verdict | Finding |
|---|---|---|
| Order Success Confirmation | ◑ flag → **fixed** | "Dietitian Review — in progress" next-step: not a backed pipeline state; replaced with real pipeline steps. |
| Order Tracker: Placed | ✅ pass | Clean timeline, bindable. |
| Order Tracker: Preparing | ❌ FAIL → **fixed** | "✓ RD APPROVED BY DR. ANJALI NAIR" stamped on the tracker; blanket "no seed oils / artificial preservatives" claim. |
| Order Tracker: Out for Delivery | ✅ pass (note) | Rider/states bind to dispatch; packaging copy must reflect ops reality. |
| Order Tracker: Delivered | ✅ pass | Feedback collected, not fabricated. |
| Order History | ✅ pass (notes) | Invented brand + `$` prices — port-time binding. |

## Fixes shipped to the canvas (6) — references in `stitch-designs/qa-fixed/`

| File (PNG + HTML) | What changed | New screen id |
|---|---|---|
| `pdp-trust.*` | Fabricated RD-verification card/tile → honest **Data Provenance** card (allergen disclosure state, measured-vs-estimated source, "How we verify"). | `8495e2bb2b094b77aba57ce1977a3464` |
| `gyms-landing.*` | Tanmatra branding; fake analytics → "Retention Insights · Live after onboarding" locked preview. | `589659cd53774231a8c191c33564315b` |
| `plans-landing-v2.*` | Full regeneration matching live content richness (trial hero, faceted filters, dish-rotation carousels, how-it-works, FAQ). | `b4bf59ae2b994197ae2eda535b3ee537` |
| `fitness-clubs-lp.*` | **New** consumer recovery LP for `/partners/fitness-clubs` ("delivered to your finish line"). | `05913ee6e6e649f59901c3f3310aabf8` |
| `tracker-preparing.*` | RD-approval stamp + blanket product claims removed → "Portioned to your plan's macro targets" + structurally-true kitchen claims only. | `b37e1fcde38a4ec9bdb5169563e10cfd` |
| `success-confirmation.*` | Pipeline steps now map 1:1 to real order states (confirmed → kitchen → doorstep). | `1914b29a5e664e139d23d90166433fd7` |

All six verified clean by HTML grep for the banned-claim set
(`anjali|vikram|rd approved|rd review|verification review|4.9|87%|invented brands|seed oils|dietitian review`).

## The systemic rule this audit produced

> **Every pre-audit canvas design's trust/claim elements are suspect until verified.**
> When porting, bind every badge, statistic, reviewer, and process step to a real
> record — or delete it. Never port a trust element verbatim. (Encoded in
> `agent-nn-port-brief.md` §3.)

Running tally: 3 hard failures + 2 flags among 16 pre-audit designs QA'd — all the
same root cause (designs generated before the honesty standard existed).
