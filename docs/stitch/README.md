# Stitch-74 screen programme

`stitch-screen-manifest.json` is the source of truth for the 74-screen
programme: which screens and states exist, their triggers, transitions, close
behaviours, and per-screen proof status. The batch briefs/grounding files in
this directory are the working documents that produced it.

**Enforcement:**

- `tools/verify-stitch-manifest.mjs` — manifest schema validity (CI).
- `tools/verify-stitch-wiring.mjs` — manifest filesystem claims vs the repo (CI).
- `scripts/lint-stitch-markers.ts` — every implemented screen's
  `data-screen-id` must exist in its claimed source artifacts (CI). This is the
  gate that keeps template adoptions from silently dropping screen identity.
- `artifacts/storefront/e2e/specs/stitch-runtime/` — runtime reachability of
  the markers (currently run manually; in no workflow).

**Interaction with the Astryx design system** — which templates are the
sanctioned way to build these screens, and the rule that a template adoption
replaces a screen's markup but never its identity markers — is recorded in
**docs/DESIGN-SYSTEM-RECONCILIATION.md**.
