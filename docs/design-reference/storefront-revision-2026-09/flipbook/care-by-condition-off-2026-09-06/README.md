# /care — by-condition surface off (2026-09-06)

Frames at 390×844, DPR 2. **before/** is production (surface live); **after/** is this branch's prod build with `CARE_BY_CONDITION_ENABLED` unset.

| Frame | What changed |
|---|---|
| care | The "By condition" rail (PCOS, Type 2 Diabetes, Prediabetes, Hypertension, Insulin Resistance, GERD), "Find my starting point" and "Clinical support" are gone. The page is the header, the "By goal" rail and the two commerce entries. The loading skeleton tracks the same flag, so it no longer reserves a condition rail that never arrives. |
| plans-nav-parity | The ⌘K / footer nav no longer lists "PCOS care" or "Diabetes care"; the sub-section is "By goal". |

Verified on the served page: zero occurrences of "By condition", PCOS, Prediabetes, Hypertension, Insulin Resistance or GERD. `/care/[condition]` still resolves for a held URL but returns `noindex, nofollow` and is out of the sitemap.
