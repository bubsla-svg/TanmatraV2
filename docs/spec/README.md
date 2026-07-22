# Tanmatra monetization spec corpus (`docs/spec/`)

This directory is the **repo home** for the Tanmatra monetization / rebuild planning corpus, as
prescribed by the master index ("Suggested repo home: /docs/spec/ with this file at its root; CSVs
alongside"). The documents were transcribed from their Google Doc / Sheet sources on **2026-07-22**.
Each file carries a transcription banner naming its source ID.

Start at [`00-tanmatra-master-index.md`](./00-tanmatra-master-index.md) — it is the map (dependency
graph, precedence rules, per-session loading map, the ten invariants, shared numbers, open blockers).

## What is here

| File | Layer | Status |
|---|---|---|
| `00-tanmatra-master-index.md` | Map | Transcribed ✓ |
| `agent-brief-pricing-live.md` | Execution | Transcribed ✓ |
| `tanmatra-trial-plan-02b.md` | Commercial | Transcribed ✓ |
| `tanmatra-checkout-breeze-02c.md` | Experience | Transcribed ✓ |
| `tanmatra-subscription-cuj-v2-02d.md` | Experience | Transcribed ✓ |
| `tanmatra-plan-config-02e.md` | Commercial | Transcribed ✓ |
| `tanmatra-ui-construction-02f.md` | Experience | Transcribed ✓ |
| `tanmatra-stageA-prices.csv` | Data | Transcribed ✓ (see anomaly note below) |

## What the master index references but is **not yet in the repo**

The index's artifact registry (§1) names several documents that were **not provided as source links**
and do not exist at any path in this repository. They are load-bearing dependencies for the plan and
must be located and homed before Phase-2 execution begins. Treat their absence as an open blocker:

- **IMPECCABLE.md** — the binding UI/design-system constitution. The 02-series defers to it on tokens,
  states, a11y, safety (§11 FSSAI/allergens), honest commerce (§2.6), and server authority (§10.1).
  Every amendment says "subordinate to IMPECCABLE" — the corpus is not executable without it.
- **tanmatra-frontend-rescue-plan.md** — rebuild architecture, Phase 0–4, fix-before-port, anti-rot
  rules; §3.1 is the canonical statement of server price authority.
- **tanmatra-benchmark-framework.md** — the measurement/scoreboard layer (LCP/CLS/INP budgets,
  journeys J1–J4, the 28.1% and 0%→20/20 baselines).
- **tanmatra-monetization-amendment-02.md** — the market foundation: the 5 plans, copy system, 12-chip
  glyph set (§4), and attach architecture (§5). 02a/02b/02c/02d/02e/02f all cite it.
- **tanmatra-repricing-and-menus-02a.md** — pricing architecture, plan menus, data-integrity gates.
- **tanmatra-catalog-repricing.csv** — the **final** target prices (`new_direct_rs`,
  `new_aggregator_rs`), rebuild only. (The `final_target_*` columns in the Stage-A CSV are a preview,
  not this file.)
- **HFEP SKILL.md** — the agent operating protocol (blast radius, epistemics, git discipline).

See [`PLAN-CROSSCHECK.md`](../../PLAN-CROSSCHECK.md) at the repo root for the full dependency and
repo-reality cross-check.

## Data anomaly to report (do not silently "fix")

`tanmatra-stageA-prices.csv` row **id=1 (Activated Charcoal Smoothie)** has **11 fields** where the
header defines **10** — the final `remaining_at_cutover_pct` value (`101`) is duplicated in the source
spreadsheet. The CSV here is kept **byte-faithful to source** on purpose (Agent Brief §A2: "do not
recompute, round, or improve any value … report any mismatch"). The meaningful `stageA_paise` value
for that row (`6900`) is unaffected. Flagged for Chandan to correct at source.
