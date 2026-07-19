# PR-08 · `/plans` management screen

**Blast radius: medium.** Mutates live plan state; swap validation touches allergen and macro safety. Depends on PR-07.

## Objective

Give subscribers a working weekly plan surface: see the week, swap a meal, skip a day, pause the plan.

## Context

This is the pillar's retention surface, and it was already designed — the Stitch board holds the full suite. Canonicals: `175` (planner), `23` (swap drawer), `153` (skip confirm), `190` (settings), `7` (empty state).

Interaction spec: `docs/prototypes/storefront.html` → `/plans`. Everything below is wired and clickable there.

## Steps

1. **Empty state.** No plan → dual CTA: "Build my plan" (primary) / "Run Goal Fit first". Copy: "A dietitian-designed week, matched to your goal. No manual daily ordering."
2. **Header gauges.** Week's average kcal and protein as ring gauges against the user's goal targets, with the tone rules from PR-03 (icon + text on any non-sage state).
3. **Week rows.** Per day: dish, RD-approved mark, mono macro line, status pill (delivered / upcoming / skipped). Upcoming rows get Swap and Skip; skipped rows get **Undo**.
4. **Swap sheet.** Compatible alternatives with match percentage and macro deltas. Alternatives breaching the plan's macro caps render disabled with an explicit reason — "Exceeds your plan's macro caps · Unavailable" — not hidden. Server revalidates the chosen swap (PR-07 endpoint); never trust the client's filtering.
5. **Skip sheet.** State three things plainly: the credit rolls forward, the streak pauses but protein baseline holds, and the action is logged for kitchen planning. Confirm/Cancel, then an inline Undo on the row.
6. **Pause.** Toggle with a visible consequence line — credits hold, deliveries resume on resume.
7. **Governance line.** "Changes to medical restrictions require an RD consult." Pause, skip, and swap are self-serve; medical restriction changes are not.
8. **Allergen safety.** Swap candidates run through `allergenClash` (PR-05's selector) against the user's profile. A clashing alternative is never offered as a plain option.
9. **Standard Four** states, skeleton geometry matching final.

## Acceptance criteria

- [ ] Empty, active, paused, and day-skipped states all render.
- [ ] A swap breaching macro caps is rejected server-side even if the client is bypassed.
- [ ] Swap candidates never include a dish clashing with the user's allergen profile.
- [ ] Skip returns a credit reflected in the plan balance; Undo restores the day and the credit.
- [ ] Pause blocks upcoming deliveries and says so on screen.
- [ ] Every numeral is mono/tabular; no `₹` literals in components.

## Verify

```bash
npm run test        # cap validation, credit arithmetic, allergen filtering
npm run test:e2e    # swap → skip → undo → pause → resume round trip
```

## Out of scope

Plan settings detail (billing method, delivery window, dietary restrictions — Stitch `190`) is a follow-up brief. Metabolic calendar (`3`) is parked.
