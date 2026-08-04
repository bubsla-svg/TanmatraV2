# Batch 8 Grounding — Community & Content (G4)

> Reconciliation input for Route Briefs 44–52. Establishes, per route, the real
> backend contract and the logic that must survive wiring — written **before**
> any Stitch generation, following the pattern Batches 3–7 set.
>
> Per `BATCH-4-5-SCOPE.md`: *"Editorial and UGC surfaces. Lower commercial risk,
> high volume, and a natural place to define the content/article vocabulary the
> kit currently lacks."* That framing turned out to understate the risk. Two of
> these nine routes were **fabricating data and presenting it as the signed-in
> customer's own** — see Defects below. Lower *commercial* risk, yes; the
> honesty risk was the highest of any batch so far.

## Route → real path map

| Route | Page | Main component(s) | Data source |
|---|---|---|---|
| `challenges` | `app/challenges/page.tsx` (35) | `ChallengeCard` (55) | `challengesApi` |
| `challenges/[slug]` | `app/challenges/[slug]/page.tsx` (79) | `ChallengeRoom` (136) → `PostFeed` (44) | `challengesApi` |
| `challenges/tracker` | `app/challenges/tracker/page.tsx` (27) | `ChallengeTrackerView` | `ecosystemApi` |
| `team` | `app/team/page.tsx` (45) | `TeamCard` (36) | `teamApi` |
| `team/[slug]` | `app/team/[slug]/page.tsx` (124) | inline | `teamApi` + `catalog` |
| `recipes` | `app/recipes/page.tsx` (30) | `RecipesBrowser` (87) → `RecipeCard` (36) | `recipesApi` |
| `recipes/[slug]` | `app/recipes/[slug]/page.tsx` (118) | inline | `recipesApi` |
| `qa` | `app/qa/page.tsx` (27) | `CommunityQaForum` | `ecosystemApi` |
| `meal-guides/[dishSlug]` | `app/meal-guides/[dishSlug]/page.tsx` (55) | `ThermalInstructions` (50), `SourcingTransparency` (46) | `catalog` |

Every file is well under the 400-line `.tsx` cap.

## The architectural split that produced this batch's defects

Two distinct API families back these nine routes, and **the defects cluster
entirely in one of them**:

- **`challengesApi` / `teamApi` / `recipesApi`** — a coherent, well-tested
  family. Consistent `{key: [...]}` envelope, consistent
  server-fetch resilience (`[]` on list failure, `null` on 404), each with a
  `.test.ts`. The seven routes on this family were clean.
- **`ecosystemApi`** — a different, earlier "Ecosystem Phase 3" effort. Bare
  array/object responses, no resilience wrapper at the call site, so every
  consuming component has to invent its own error handling. The two routes on
  this family (`challenges/tracker`, `qa`) both invented it by **fabricating
  plausible-looking data** rather than rendering an honest state.

That's the generalisable lesson: when a client module leaves error handling to
each caller, some callers will fill the gap with fiction. Worth remembering
when the remaining `ecosystemApi` consumers get designed.

## Contracts that must survive wiring

### `challenges`, `challenges/[slug]` — the correct pattern, already

`ChallengeRoom` is the reference implementation for this whole batch: real
three-way `user` state, 401 → inline `PhoneAuth`, and — notably — it
distinguishes a 401 (session gone, bounce to sign-in) from a 403 (signed in
but not a member → "Join the challenge to post"). Nothing to fix; restyle only.
`Challenge.featured` is a **number** (0/1), correctly guarded as `> 0`.

### `team`, `team/[slug]` — clean, one real money surface

`team/[slug]` conditionally fetches the live catalog to resolve
`ownedDishSlugs` into real dishes, rendering `{calories} kcal ·
{formatPaise(price)}`. Real rupee amounts, correct shared helper — a brief must
treat those as live data, not decoration. `TeamProfile.role` and `.accent` are
typed as bare `string` rather than literal unions, so an unexpected accent
silently falls back to gold; noted, not fixed (server-side taxonomy question).

### `recipes`, `recipes/[slug]` — the batch's best prior art

`RecipesBrowser` filters client-side over the full server list (deliberate, so
SSR HTML carries the whole grid for SEO). `recipes/[slug]` is already the most
complete editorial template in the storefront: hero image → eyebrow pills →
title → dek → tabular stat blocks → ingredients → numbered method →
disclaimer, with genuinely careful schema.org `Recipe` JSON-LD that only emits
`nutrition` when a macro is actually present. `calories`/`proteinGrams` are
`number|null` and correctly `!= null`-guarded everywhere. Restyle only — but
this is the structure the rest of the batch's editorial vocabulary should be
derived from.

### `meal-guides/[dishSlug]` — real allergen data, static everything else

`SourcingTransparency` renders **real per-dish `dish.allergens`**;
`getSourcingForDish` maps the 4-value `DishKitchen` union exhaustively.
`ThermalInstructions` takes `dish` as a prop but its reheating copy is
identical for every dish regardless of `serveMode` — the prop is effectively
decorative today. Noted, not fixed: differentiating reheating instructions per
dish is a content/product decision, not a bug in the code as written.

## Defects fixed before design wiring

1. **`/challenges/tracker` fabricated a personal progress dashboard for anyone
   the API rejected — including signed-out visitors.** The component's
   `.catch(() => setLoading(false))` swallowed every failure mode identically
   (401, 500, network), and on `data === null` it rendered a hardcoded array of
   two invented challenges with a hardcoded streak (`daysDone = i === 0 ? 9 : 3`)
   as a convincing "Day 9/14 — 64% Completed" progress bar. A signed-out
   visitor saw a personal health-progress dashboard for challenges they had
   never joined, with no sign-in prompt anywhere. The route is filed under
   "Track" in `lib/nav.ts` alongside genuinely authenticated account surfaces,
   confirming it was always meant to be session-gated. **Fixed**: adopted
   `ChallengeRoom`'s island pattern (three-way `user` state, 401 → inline
   `PhoneAuth`), added a real error state with retry, deleted the fabricated
   fallback entirely, and derived progress from the **real** `memberships[].joinedAt`
   against `durationDays`. The tracker now shows only challenges you actually
   joined, and links each back to `/challenges/{slug}` (its `slug` field was
   present in the payload but previously unused).
2. **The same file's "Upcoming Dietitian Cohort Check-ins" block was also
   fabricated** — a hardcoded "Live Q&A — Navigating Midday Sugar Cravings /
   Hosted by RD Advisory Board • Friday at 5:00 PM IST" that ignored the real
   `checkIns[]` array (`{title, scheduledAt, joinUrl}`) sitting in the same
   response. **Fixed**: renders the real check-ins with real times and real
   join links, plus an honest empty state.
3. **`/qa` fabricated a successful submission whenever the POST failed.**
   `handleSubmit`'s catch block prepended a synthetic thread
   (`authorName: "You (Pending)"`, a canned "A Registered Dietitian will review
   and respond within 24 hours") that was visually indistinguishable from a
   real accepted question. Combined with the component having **no auth check
   at all** — despite `ecosystemApi`'s own header comment documenting session
   auth — a signed-out visitor's question would 401 and be papered over with
   fake success. They would never learn it was never sent to anyone. **Fixed**:
   removed the fabricated thread, added real error surfacing (401 → sign-in
   prompt + inline `PhoneAuth`, other errors → the real message), and a genuine
   "Sent" confirmation only on actual success.
4. **`/qa` also shipped two fully-authored fake seed threads** (`DEFAULT_THREADS`,
   complete with invented RD names and dated answers) that stayed visible
   permanently whenever the real list came back empty — making an empty forum
   indistinguishable from a populated one. **Fixed**: removed; the forum now has
   a real loading state, a real empty state, and a real error state.
5. **"Verified Response" was rendered even when there was no response.** The
   answer box printed a gold "★ Verified Response" header with the fallback body
   "Response pending review." — labelling a non-existent answer as verified.
   **Fixed**: the answer box only renders when `rdAnswer` is non-empty;
   otherwise an honest "Awaiting a dietitian's response." line.
6. **Dead Tailwind classes rendering unstyled** in 4 files —
   `bg-sage-100`/`text-sage-800`/`border-sage-200`. "Sage" has no numeric scale
   registered in this app's theme (only flat `--sage`/`--sage-soft`/`--sage-text`),
   so these generated no CSS whatsoever. Worst instance: the **allergen chips**
   on `/meal-guides/[dishSlug]` rendered with no background at all — safety-adjacent
   information styled as nothing. **Fixed** across all four files. Note the
   repo's `lint:tokens` gate could not have caught these: it was narrowed on
   2026-07-27 to raw-hex-only.
7. **Allergen chips were semantically inverted.** Beyond being unstyled, they
   used sage — the codebase's positive/success signal — for *listed allergens*.
   Rendering "Peanuts" in the success colour is misleading on a safety surface.
   **Fixed**: real allergens now render as neutral bordered chips; sage is used
   only for the genuine "None reported" case.
8. **Contrast-failing `text-white` on raw `bg-gold`** in 3 files, against the
   project's own documented rule that `--gold` requires the `--gold-ink`
   pairing (the same pairing 5+ components in this very batch already get
   right). **Fixed** in all Batch 8 files.

## Known issues, deliberately not fixed (out of scope or product decisions)

- **`/subscription/bridge` still has `text-white` on `bg-gold`** — same class of
  contrast defect, but that route belongs to **Batch 9** (G6). Left for that
  batch rather than blurring this PR's boundary. Recorded here so it isn't lost.
- **Two incompatible challenge data models.** `Challenge` (`challengesApi`) and
  `ChallengeTrackerData.challenges[]` (`ecosystemApi`) are separate shapes; the
  tracker's lacks `image`, `goalTags`, `memberCount`, `featured`, `startsAt`,
  `endsAt`. A brief must not assume the tracker can show challenge imagery or
  cohort size — reconciling them is a backend change, not a design pass.
- **`/qa`'s category taxonomy** (`pcos` / `macros` / `general`) is disconnected
  from the `goal` / `diet` vocabulary used by recipes and the rest of the app.
  Left as-is: the values are the wire contract for the POST body, and changing
  them is a server-side decision.
- **`ThermalInstructions` reheating copy is identical for every dish** despite
  `DishData.serveMode` existing. Content decision, not a bug.
- **`ACCENT` map duplicated verbatim** between `TeamCard.tsx` and
  `team/[slug]/page.tsx`. Cosmetic; left alone to keep this batch's diff scoped
  to defects and design.

## Shared vocabulary available

**Effectively none — this batch defines the editorial vocabulary.** None of the
nine routes import `FaqAccordion`, `LandingIcon`, `BenefitGrid`, or anything
from `content/landing/`. Batches 1–7 built landing, marketing, account, commerce
and clinical surfaces; none of them built an article, a bio, a leaderboard, or a
forum.

The one genuine prior art is `components/legal/LegalArticle.tsx` — a real
long-form document pattern (back-link → title → updated byline → dek → a
`sections[]` loop → `max-w-3xl` shell). `recipes/[slug]` independently reinvents
a richer version of the same idea inline without factoring it out. The briefs
should treat both as reference points for the editorial scope this batch
establishes, not as components to reuse unchanged.
