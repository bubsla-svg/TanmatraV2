# Nutrition tooling — integration scope assessment

Assessed 2026-08-16 against three candidate repositories, in the context of
flipbook review finding **F-1** (78 of 112 live dishes render fabricated
macros) and **M-6** (blocked on kitchen-supplied macros).

## Verdict in one line

**Integrate none of the three as dependencies. Adopt the data source they all
wrap — USDA FoodData Central — through a small TypeScript client in the
existing stack.** Two of the repos are usable as design references; one is
legally unusable.

## The finding that decides it

Before assessing the tools I checked whether Tanmatra's catalog could even
feed one. I expected it could not — the M-6 blocker framing implies recipes
are missing. **That was wrong**, and it is the most important fact here:

```
"Grilled chicken breast – 150 g", "Sautéed broccoli, zucchini, carrots – 80 g",
"Mashed potato – 80 g", "Olive oil – 1 tbsp", "Garlic herb seasoning"
```

Measured on the live catalog:

| | dishes |
|---|---|
| carry ingredient **quantities** | **90 / 112** |
| have copy-pasted macros (F-1) | 93 |
| …**of which have quantities → computable today** | **74** |
| …genuinely need the kitchen | 19 |

Unit vocabulary across the catalog: `g` ×220, `tbsp` ×70, `tsp` ×49, `ml` ×27,
`pcs` ×7, `cup` ×2.

So **74 of the 93 mis-macro'd dishes are computable now**, without waiting on
anyone. M-6's blocker is real but far narrower than assumed — it covers 19
dishes, not the catalog. That changes this from "nice tooling" into the
fastest available fix for a live clinical-claim defect.

## The data source

**USDA FoodData Central** — what all three repos wrap.

| | |
|---|---|
| Licence | **CC0 1.0 Universal (public domain)** — no permission needed; attribution requested, not required |
| API key | Free signup |
| Rate limit | **1,000 req/hour** per key (demo key: 30/hr) |
| Domains | Foundation Foods, SR Legacy, Survey (FNDDS), Branded, Experimental |

Our load is ~112 dishes × ~5 ingredients ≈ **560 lookups, one-time, then
cached**. Comfortably inside one hour of quota. CC0 means no licensing
friction on the numbers themselves.

## The three repositories

### 1. `dylanleigh/PriceAndNutritionTrackingSystem` (PANTS)

Django · **Apache-2.0** · 132★ · ~317 commits, schema last documented 2020-04-13 · self-hosted app with a work-in-progress REST API.

*"a self-hosted, open-source nutrition tracker and tool for nutritional data analysis of ingredients and recipes"*

**Use as a design reference — do not integrate.** It is the only candidate
with a domain model worth studying: Ingredients / Recipes / Diary / Targets,
**recursive recipes** (a recipe usable as an ingredient of another), and
per-ingredient **cost alongside nutrition**. That recursion matters for us —
combos and meal plans are recipes-of-recipes today, and our COGS work wants
the same join.

Against integrating: it is a Django *application*, not a library; its REST
API was WIP as of 2020; and adopting it means running a Python service
beside three Node services. Apache-2.0 permits porting the schema thinking,
which is the part with value.

### 2. `mcgarrah/usda_fdc_python`

Python · **MIT** · 1★ · 36 commits · published to PyPI (`pip install usda-fdc`).

*"A comprehensive Python library for interacting with the USDA Food Data Central API, designed for easy integration with Django applications and local database caching."*

**Use as a reference implementation — do not integrate.** It is a client over
a public REST API. We do not need a Python client to call REST; we need
~200 lines of TypeScript beside the clients already in `artifacts/storefront/lib/`
and `artifacts/api-server`. What is genuinely worth reading before writing
ours: its **measurement-unit conversion** and **ingredient parsing**, which is
exactly the `tbsp`/`tsp`/`cup`/`pcs` problem our own catalog has 128 instances
of. MIT permits porting those routines.

### 3. `Ismet000/nutrition-analyzer`

Python + Streamlit · **NO LICENCE FILE** · 1★ · **4 commits**.

**Cannot be used at all.** Absent a licence, default copyright applies — all
rights reserved. We have no permission to copy, port, or vendor any part of
it. This is not a judgement about quality; it is a legal fact, and it applies
even to small snippets.

Its approach (parse ingredients → look up in FDC → aggregate → visualise) is
the obvious shape of the problem and is independently described in the other
two. Nothing is lost by excluding it.

## Recommended shape

A `lib/nutrition-usda` workspace package plus a backfill script, following the
**plan-then-apply pattern this repo already proved** in M-3
(`scripts/menu-catalog-v2` → reviewed CSV → `workflow_dispatch` apply):

1. Parse `ingredients[]` into `{name, qty, unit}` — the format is already
   consistent (`"<name> – <qty> <unit>"`).
2. Resolve each to an FDC food id; **cache the mapping in-repo as a reviewed
   CSV**, because a wrong match is a wrong macro and must be human-checked
   once rather than silently re-fetched.
3. Compute per-dish macros; emit a **plan** diffing computed vs. stored.
4. Apply behind `workflow_dispatch`, exactly as M-3 did.

**Computed macros must be written as `macrosEstimated: true`** — they render
with the `≈` marker and read as estimates. They must never be written as
`verified`; RD sign-off remains the only thing that earns that word. This
respects the existing `macroTrust` ladder rather than routing around it, and
it is still a strict improvement on today's state, where 78 dishes show
fabricated numbers and one (Boiled Egg, 460 kcal / 28 g P) shows a fabricated
number *as verified*.

## Risks worth naming

- **FDC is US-centric.** Generic ingredients (chicken breast, broccoli,
  potato, olive oil) are well covered. Indian-specific items — paneer, besan,
  jaggery, ghee, poha — need checking; some are present in SR Legacy/Foundation,
  some are not. This is precisely why step 2 above ends in a *reviewed* CSV
  rather than a live lookup.
- **Match quality is the whole risk.** "Mashed potato" could resolve to a
  branded frozen product with very different fat. The reviewed-mapping step is
  not ceremony; it is the control.
- **Volume units carry density assumptions.** 128 of our quantity tokens are
  `tbsp`/`tsp`/`cup`/`pcs`. Oil by tbsp is fine; "1 cup vegetables" is not.
  Those should be flagged for the kitchen rather than guessed.
- **Scope discipline.** This computes *estimates from the recipe*. It does not
  make anything RD-verified, and it does not touch price (R-3 — the payload is
  price law).

## What this does not solve

The 19 dishes with no quantities still need the kitchen, and every dish still
needs RD sign-off before any number may read as verified. This narrows M-6; it
does not close it.
