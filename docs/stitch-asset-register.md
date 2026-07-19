# Stitch Asset Register — project `9545397915295144685`

Pulled via MCP, 2026-07-18/19. **196 screens** (159 with HTML source; 37 are images/assets). Row-level data in `stitch-screen-census.csv`. This register adjudicates the board: what's canonical, what ships, what parks, what's unsafe to wire as-is. Companion to Wiring Guide §8.

---

## 1 · Executive read

The board is not 196 ideas — it's ~30 clusters: near-complete design coverage of the consumer app, a full **plan-management suite** (the W2 pillar UI), four admin consoles, a kitchen ERP pair, an RD-partner recruitment funnel, a corporate/B2B universe, and a ~20-screen wellness/metabolic tracking suite. Three findings that matter:

1. **Plan management was already designed** (planner, swap, skip, settings, modify-commitment, empty state). It is now wired into the storefront prototype as `/plans` — the "My Plans" nav destination finally has a working reference.
2. **Four consumer-facing screens carry claim language** that violates the no-cure-claims law (§4). Two admin screens *contain* cure language by design — they're the moderation console catching it.
3. **Stitch drifted brand and currency** on several screens (`NUTRIENG` branding on 58; `$` pricing on 40/49/58). Any export needs a brand + ₹ pass before it touches the repo.

## 2 · Cluster adjudication

Disposition key: **SHIP** = harvested into prototypes now · **REF** = canonical reference for a scheduled build · **W3/W4** = wave-mapped, untouched · **PARK** = pillar-fork or undecided product scope · **ARCH** = archive/delete.

| Cluster (n) | Screens (idx) | Canonical | Disposition · note |
|---|---|---|---|
| Checkout (6) | 4, 74, 93, 125, 161, 189 | **93** (Tier P0 Refined) | SHIP done · 4 = processing sheet ✓; 189/125/161 = address entry/map/manual → REF for `/account/addresses`; 74 superseded by 168 |
| Payment (2) | 78, 168 | **168** | SHIP done · UPI-first structure matches spec |
| Menu (5) | 10, 11, 15, 163, 167 | **167** + **15** (skeleton) | SHIP done · 10/11 ARCH; 163 spatial prototype PARK (motion experiment) |
| Dish PDP (10) | 8, 14, 16, 27, 38, 61, 99, 115, 155, 166 | **166** structure, **8** hero, **16** gauges, **27/115** allergen | SHIP done · 38 = in-place variant swap REF (kills reload); 61 provenance section REF; 99 = modifier parity ✓; 155 loading ✓ |
| Plan mgmt (10) | 3, 7, 23, 24, 40, 62, 117, 153, 175, 190 | **175** planner, **23** swap, **153** skip, **190** settings, **117** modify | **SHIP — this pass** (`/plans`) · 3 calendar's "clinical fasting" slot PARK; 40/62/24 superseded |
| Subscription landing (4) | 50, 54, 92, 181 | **50** duration, **181** landing v2 | SHIP (50 done) · 181 is 9,488 px — split before any build; 92 frequency REF |
| Builder redesigns (4) | 60, 96, 164, 194 | 60/96 | REF Wave-1 builder polish |
| Trial bridge (1) | 66 | 66 | SHIP done (A2 sheet) |
| Tracker (7) | 33, 37, 81, 98, 137, 68, 138 | frame-mapped | SHIP done · **37 harvested this pass** ("portioned to your plan's macro targets" QC line) |
| Cart (5) | 5, 45, 80, 118, 148 | 45/80/118 | SHIP done · 5 price-review REF for bill card v2 |
| Home (4) | 88, 100, 158, 179 | 88 + 100 | SHIP done · 158 iOS premium = nested-radius source ✓; 179 error REF (Standard Four) |
| Login/OTP (3) | 53, 76, 188 | 53 + 76 | SHIP done (in checkout) · 188 dup ARCH |
| Timeslot (1) | 17 | 17 | **REF** · capacity-aware slots ("Full" state) → harvest into checkout schedule picker |
| Order history (2) | 9, 58 | 58 | REF W3 · fix NUTRIENG brand + $ before use; 9 empty ✓ |
| Success (2) | 132, 151 | 151 | SHIP done |
| Addresses (1+3) | 91 (+189/125/161) | 91 | **REF — Wave-2 `/account/addresses` set is complete**; commission nothing new |
| Assessment flow (6) | 22, 34, 112, 142, 183, 194 | 22 → 112 → 183 | W3 · Goal Fit v2 (diet style → exclusions → results-with-match%); 183's match-card REF |
| Account/profile (4) | 162, 165, 107, 109 | 162 | W3 |
| Vouchers/billing/refunds (4) | 77, 122, 187, 25 | — | W3 · 77 voucher wallet REF; 25 'treat' hit is legal boilerplate — verify, likely fine |
| FAQ/support/trust (3) | 110, 186, 9ff… (186) | 110 | W3 |
| Consult / RD marketplace (8) | 36, 47, 63, 70, 111, 134, 160, 178 | 47, 111 | **PARK** behind the RD-consult product decision · 70 needs claim rewrite first (§4) |
| RD partner funnel (11) | 43, 44, 46, 73, 89, 104, 123, 156, 177, 182, 193 | funnel complete | PARK · full recruitment + application-review pipeline exists; zero build needed if/when unparked |
| Corporate / B2B (9) | 1, 21, 64, 75, 85, 128, 176, 195, 116 | 128, 176 | PARK per one-pillar thesis · 116 needs claim rewrite |
| Wellness/metabolic suite (21) | 65, 72, 79, 86, 87, 90, 103, 106, 113, 120, 124, 129, 133, 143, 144, 150, 159, 174, 191, 192, 55/146 | — | PARK · a second product's worth of tracker UI; harvest nothing until the pillar earns it |
| Admin consoles (10) | 2, 12, 13, 18, 30, 31, 51, 84, 135, 152, 172 | newer of each pair | W4 back-office · moderation console (84) is *designed to catch* cure claims — keep |
| Kitchen ERP (3) | 41, 57, 130 | 130 KDS | PARK pending Petpooja overlap check |
| Content/editorial (4) | 97, 108, 147, 52 | 108 | W3 · 147 PCOS guide → RD sign-off before publish |
| Growth landings (5) | 28, 48, 116, 173, 184 | 184 | PARK · 116/173 claim rewrite (§4) |
| Libraries (2) | 49, 139 | both | **REF** · 139 = toast/snackbar-with-action/modal taxonomy (UNDO + RETRY patterns — UNDO harvested into `/plans` skip); 49 = motion-slot placeholders, naming only |
| Assets (19) | 13× image.png, 3 untitled, 32, 67, 83, 180, 114, 141, 145, 71 | — | ARCH the dupes; keep shader/SVG/three as motion-asset pool |

## 3 · Harvest ledger

**Shipped in the prototypes (cumulative 14):** hero scrim + title-on-image (8) · glass chips, non-gated only (8) · macro ring gauges (16 + DS) · allergen consent gate, safe-primary (27/115) · featured menu card (167) · duration strike + SAVE/INTRO (50) · trial-bridge sheet (66) · big mono ETA + rider call (81) · kinetic zen rings (68) · saffron-glow CTA (DS) · **`/plans` suite: planner + gauges header (175), swap sheet with match% / macro deltas / capped-Unavailable row (23), skip sheet with credit-forward + streak + audit line (153), pause + RD-consult governance line (190), empty dual-CTA (7), skip-UNDO (139)** · tracker QC copy (37).

**Next-harvest queue (build-time, no design needed):** capacity-aware slot states (17) → checkout schedule · in-place variant swap spec (38) → PDP W-menu task · provenance batch line (61) → deep PDP · voucher wallet (77) → checkout v2 · assessment results match-card (183) → Goal Fit v2 · order-history reorder rows (58, after brand fix).

## 4 · Compliance findings (no treat/cure/prevent/guarantee claims)

| idx | Surface | Phrase | Verdict · fix |
|---|---|---|---|
| 70 | Dietitian profile | "reversing metabolic markers" | **Violation** · → "improving metabolic markers" |
| 126 | Clinical Plan Detail | "prevent hunger spikes" | Borderline mechanism claim · → "steadier satiety between meals"; same screen's "optimize leptin signaling" → strike |
| 116, 173 | B2B/gym landings | "guarantee physiological adaptation" | **Violation** · strike "guarantee" |
| 146 | Loyalty | "Guaranteed meal prep within 2 hours" | Operational SLA, not a health claim · allowed, but reword "priority 2-hour prep" to kill the pattern |
| 30, 84 | Admin moderation | "cure insulin resistance…" | **By design** — it's the flagged UGC the console moderates. Keep |
| 25 | Privacy/Terms | "treat" | Legal boilerplate context · verify, likely fine |

Rule going forward: run the claim-regex over any Stitch export's text layer before wiring (same scan that produced this table).

## 5 · Palette & pattern census (empirical, 159 files)

**Grep-gate list, finalized:** `#fbbf24 #f9bd22 #ffe1a7 #131313 #e2e2e2 #c6c6c7 #d3c5ac #454747 #34daff #ffb4ab` — the last two being the Nocturnal cyan tertiary (×153) and Material dark error. None may enter the repo; `.tnm2` semantics (saffron/sage/caution/`#DC8773`) already cover every role.
**Radii:** rounded-full ×1138 (pills), xl/2xl dominate cards, 3xl ×66 (hero cards) — matches the adopted 24/14 nesting. **Fonts:** Inter + Geist + **Material Symbols Outlined icon font** — repo uses inline SVG; never import the icon font. **Drift:** `$` currency on 40/49/58; `NUTRIENG` brand on 58; USD card rails (VISA ••••) on 190.

## 6 · Copy bank (curated, law-filtered, re-voiced to Tanmatra)

Keep: "Clinically compatible swaps" (23) · "Exceeds your plan's macro caps — unavailable" (23) · "Your meal credit rolls forward" (153, de-jargoned from "metabolic wallet") · "Your streak pauses; protein baseline stays intact" (153) · "Action logged for kitchen planning" (153) · "Changes to medical restrictions require an RD consult" (190) · "Portioned to your plan's macro targets" (37) · "Freshly prepared in our ISO 22000 certified kitchen to exact nutritional specifications" (37) · "Match your metabolism to a dietitian-designed plan" (7) · "Immediate review required" (139, allergen banner) · "No manual daily ordering" (24).
Reject: "reversing metabolic markers" · "optimize leptin signaling" · "guarantee physiological adaptation" · "Bio-Engineered" dish tagging (49) — engineering metaphor is fine, bio-claims are not.

## 7 · Route coverage matrix

| Route | Stitch ids | Status |
|---|---|---|
| `/` | 88, 100, 158, 179 | proto ✓ 5/5 |
| `/menu` | 167, 15, 10, 11, 163 | proto ✓ |
| `/dish/:slug` | 166, 8, 16, 27, 115, 38, 61, 99, 155 | proto ✓ (canonical deep file) |
| `/subscribe` | 50, 92, 60, 96, 54, 181, 164 | proto ✓ builder; landings unbuilt |
| `/cart` | 45, 80, 118, 148, 5 | proto ✓ |
| `/checkout` | 93, 127, 189, 125, 161, 17, 168, 78, 4, 53, 76 | proto ✓ 13/15 |
| `/plans` | 175, 24, 7, 3, 23, 62, 153, 40, 117, 190 | **proto ✓ — shipped this pass** |
| `/track` | 98, 137, 37, 81, 33, 68, 138 | proto ✓ |
| trial bridge | 66 | proto ✓ (sheet) |
| `/account/addresses` | 91, 189, 125, 161 | REF complete → Wave-2 build |
| orders history | 58, 9 | W3 (brand fix first) |
| wellness / consult / partner / corporate / admin / ERP | see §2 | parked or wave-mapped |

## 8 · Board hygiene actions

1. Archive: 13× `image.png` (19, 20, 29, 35, 59, 69, 82, 119, 121, 131, 149, 154, 171), 3 untitled (39, 140, 185), scrape artifact 71.
2. Delete superseded after harvest: 10, 11, 24, 40, 62, 74, 188, 100→keep as skeleton ref.
3. Rename canonicals to the `route-slug--state` contract so board ⇄ prototype ⇄ Stitch outputs reconcile 1:1.
4. Every export: re-token (§5 grep), re-brand, re-currency, claim-scan (§4) — four gates, in that order, before repo entry.
