# Stitch → Live App: Pixel-Fidelity Pipeline v1

Answers one question: *can the live tanmatra.food app implement the Stitch screens pixel-by-pixel?* Companion artifacts: `stitch_retoken.py` (working transformer), `checkout-93-tnm2-reference.html` (first manufactured target), `checkout-93-retoken-proof.png` (raw vs re-tokened render, real Chromium).

---

## 0 · Verdict

**Pixel-perfect to the raw exports: technically yes, correctly no.** The exports are painted in Stitch's own system ("Nocturnal Nourishment" — amber `#fbbf24`, pure-black base, Geist, Material Symbols icon font). Shipping them faithfully reintroduces the two-design-system architecture your audits spent months killing, plus the drift the register documented (NUTRIENG branding, `$` pricing, claim language). Fidelity to a wrong target is a defect, not a feature.

**Pixel-perfect to the re-tokened canonicals: yes, and it's enforceable in CI.** The move that makes this real: the diff target isn't the raw export — it's **manufactured** from the export by a deterministic transform (proven left/right in the proof PNG: identical geometry, only chroma shifted). Because the transform is mechanical, "pixel-by-pixel" becomes a testable property instead of a designer's opinion.

Practical ceiling: **~97–99% pixelmatch on static regions; 100% on geometry; intentional deltas only where the mock is wrong** (§5). That is the correct definition of high fidelity for this codebase.

## 1 · Two fidelity definitions (pick B, always)

| | A · Raw fidelity | B · Canonical fidelity |
|---|---|---|
| Target | Stitch export as-is | Export → 4-gate transform → tnm2 reference |
| Palette/type | Nocturnal (forbidden) | `.tnm2` (locked) |
| CI-testable | yes, against the wrong thing | yes, `pixelmatch` + geometry budget |
| Outcome | second design system, grep gates red | one system, board and app reconcile |

## 2 · The pipeline (6 stages)

**S1 · Adjudicate.** Only canonicals from register §2 enter. Never implement a superseded duplicate (six checkouts exist; exactly one is target).

**S2 · Manufacture the reference.** `python3 stitch_retoken.py IN.html OUT.html` — four gates in order: token (30-entry hex map + fonts) → brand → currency symbol → claims. Every substitution is logged; silence = clean. The output keeps Tailwind CDN + Material Symbols **so glyph geometry survives for diffing** — it is a reference artifact, never shipped. When theme.css placeholders get finalized, edit `HEX_MAP` once; every reference regenerates.

**S3 · Extract the spatial spec.** From the export's Tailwind classes, derive the layout contract per screen: section order, 8px-grid spacing values, radii (xl/2xl cards, 3xl heroes, full pills), type scale, breakpoint behavior. This is greppable, not eyeballed — the same mining that produced the register's pattern census, per screen.

**S4 · Implement in repo.** tnm2 components behind `routes.ts`, states from the prototype state machines (`tanmatra-storefront-prototype.html` is the interaction spec; Stitch is the pixel spec). Real data bindings replace the mock's hardcoded strings. Icon font → inline SVG set, matched glyph-for-glyph at identical box sizes so geometry diffs stay green.

**S5 · Verify — the actual "pixel by pixel."** Playwright in CI, per screen ×2 viewports (390, 780):
1. **Pixelmatch** implemented route vs manufactured reference, threshold ≤1.5% differing pixels on static states (antialiasing tolerance on).
2. **Geometry budget**: DOM-rect comparison of the S3 layout tree — every box within ±2px. Catches structure drift that pixel noise can hide.
3. **Token lint**: rendered computed styles contain zero Nocturnal hexes (the §5-register grep list) and zero non-tnm2 fonts.
A screen ships only when all three pass. Same harness slots beside the existing price-authority Playwright suite.

**S6 · Divergence ledger.** Every intentional delta from the reference (see §5) is a one-line entry: screen id → what → why → approver. Undocumented deltas fail review. This is what keeps "high fidelity" honest instead of aspirational.

## 3 · What was proven today

`checkout-93`: export → transformer → reference → real-Chromium renders of both → composite. Result: geometry byte-identical, skin fully migrated (amber→saffron, black→ink ladder, Material-error→`#DC8773`, Geist→Inter), 30 hex classes + 3 font hits logged, zero brand/currency/claims hits (screen was clean). Time cost per screen for S2: seconds. The pipeline's expensive stages are S4 (real components) and S5 (harness wiring — one-time).

## 4 · Effort model

| Stage | Per-screen cost | Notes |
|---|---|---|
| S1–S3 | minutes, scriptable | S3 extractor is a half-day one-time build |
| S4 | the real work | money-path screens mostly refactor existing tnm2 components; est. 0.5–2 days/screen with Claude Code |
| S5 | one-time harness + seconds/screen after | reuse audit throttling profiles |
| Board scope | ~24 canonical consumer screens (register §7) | admin/partner/wellness parked — don't pixel-chase parked scope |

## 5 · Legitimate pixel breaks (pre-approved divergence classes)

1. **Real data widths** — `₹1,155` vs mock's `$42.50`; live dish names; mono `tabular-nums` keeps digit boxes stable but line lengths move.
2. **Law overrides** — macros stripped from PDP hero chips (gating law); trust-strip line above Pay; disabled-with-reason states the mocks omit.
3. **Standard-Four states** — mocks show one state; skeleton/empty/error follow the prototype geometry (skeleton = exact final boxes, so CLS 0 is preserved *because* of fidelity, not despite it).
4. **A11y** — focus-visible rings, ≥44px targets where a mock undershoots.
5. **Icon substitution** — inline SVG at identical metrics; sub-pixel glyph diffs are tolerated by the threshold.
Everything else: match the reference or log it in S6.

## 6 · Claude Code handoff (first PR)

> Build the S5 harness: for `checkout` (reference `checkout-93-tnm2-reference.html`), add a Playwright job that renders `/checkout` step-2 at 390/780, runs pixelmatch (≤1.5%, AA on) + DOM-rect budget (±2px on the S3 tree) + computed-style token lint (reject list from register §5). Then implement S3's extractor (`stitch_spec.py`) over the 24 canonicals in `stitch-screen-census.csv` marked SHIP/REF. Wire both into CI beside the price-authority suite. Divergence ledger lives at `docs/pixel-divergence.md`.

Sequencing stays per Wiring Guide §5 — this pipeline changes *how* each screen ships, not *when*.
