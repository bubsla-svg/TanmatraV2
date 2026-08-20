/**
 * Dish data-floor plan engine — pure and DB-free, in the mould of
 * menuCatalogV2Plan.ts and bomPlan.ts.
 *
 * WHAT IT DOES. Decides which live dishes fall below the floor of data a
 * customer-facing card needs, and drafts them: `allergen_review_state` moves
 * to `pending_review`, which hides the row from `/menu/public` and
 * `/menu/ranked` while leaving it fully visible to staff and RD admin routes.
 * A drafted dish returns to the menu the moment someone writes the missing
 * content and an RD flips the state back to `reviewed`.
 *
 * WHY DRAFT AND NOT ARCHIVE. `archived` is the M-3 curation verdict — CUT,
 * MERGE, DELIST — a statement that the business no longer sells the dish.
 * These dishes are not cut; they are unfinished. Archiving them would record
 * the wrong reason and put them in the same bucket as rationalized SKUs, so
 * the person who eventually writes the ingredients would have no way to tell
 * "we stopped selling this" from "nobody typed this in yet".
 *
 * WHY THIS IS NOT A NEW POLICY. `menu.ts`'s SAFETY_RELEVANT_FIELDS already
 * demotes a reviewed dish to `pending_review` the moment its `ingredients`
 * are edited — an allergen review cannot survive a change to the thing it
 * reviewed. The rows this engine catches never went through that gate at all:
 * they arrived from a POS import already stamped reviewed (finding F5:
 * `rd_verified` is true on 112/112), carrying ingredient data that was never
 * written. This engine applies the existing rule to the rows that skipped it.
 *
 * THE FLOOR IS ABSENCE, NEVER DISAGREEMENT — and it must be absence the
 * CUSTOMER can see, which is a stricter test than "the column is empty".
 *
 *   NO_INGREDIENTS — `ingredients` is empty, or is a placeholder phrase
 *   carrying no food in it ("fresh ingredients"). tanmatra.food ships an
 *   allergen filter and a Diabetic Safe filter; a dish that answers "what is
 *   in this?" with nothing cannot be filtered by either, so a customer
 *   excluding peanuts is shown it as though it had passed their filter. That
 *   is the safety case, and it is the whole reason this engine exists.
 *
 *   It is the one floor because `menuResolver.ts` reads ingredients straight
 *   off the row — `ingredients: row.ingredients ?? []`, no fallback — so an
 *   empty column IS an empty card.
 *
 * THERE WAS A SECOND FLOOR (NO_MACROS) AND IT WAS WRONG TWICE OVER. Do not
 * re-add it without re-reading menuResolver first. The 2026-08-20 production
 * plan run flagged ~100 of 112 dishes, including ones that visibly render
 * macros today (Quinoa Khichdi, Cheese Omelette, Diet Coke), because:
 *
 *   1. WRONG FIELD. It read `macros.calories`. The DB jsonb key is `kcal`
 *      (see lib/db schema); `calories` is the MERGED catalog's name, mapped at
 *      menuResolver.ts's `calories: row.macros.kcal`. So it saw `undefined` on
 *      every row that in fact had macros.
 *
 *   2. WRONG LAYER, which survives fixing (1). A null `macros` column is not
 *      a blank card. menuResolver has two paths and both already cover it: a
 *      row with a static counterpart falls back to `stat.macros` (curated
 *      numbers render), and a row without one gets an all-zero block that
 *      `macroTrust` already grades `unverified`. There is no dish whose null
 *      macros column produces an ungated customer-visible claim, so the floor
 *      had no legitimate target — it could only ever draft dishes that were
 *      rendering correctly.
 *
 * The lesson generalises: this engine reads `menu_items`, but the customer
 * reads the MERGED catalog. Before adding a floor, check which of the two the
 * field actually comes from. Ingredients pass that test; macros do not.
 *
 * Deliberately NOT a floor: macros that disagree with the recipe. The macro
 * truth report found 33 dishes off by ≥40%, but those have both ingredients
 * and numbers — they are a BACKFILL problem with a known fix (compute from
 * ingredients, mark `estimated`, render with ≈). Drafting them would take a
 * third of the catalogue off the menu to fix an arithmetic error. Wrong data
 * gets corrected; missing data gets drafted.
 */

// ---------------------------------------------------------------------------
// Input shape — the subset of `menu_items` this engine reads

export interface DbDishRow {
  slug: string;
  name: string;
  /** `allergen_review_state`. Only `reviewed` rows are candidates. */
  reviewState: string;
  /** M-3 curation verdict. Archived rows are already off the menu. */
  archived: boolean;
  /** `ingredients` jsonb — null when the column was never written. */
  ingredients: string[] | null;
}

// ---------------------------------------------------------------------------
// Output shapes

/** One member today. Kept as a union — the FLOORS table below is built to take
 *  more, and a second floor is legitimate the moment one is checked against
 *  the merged catalog rather than the raw row. */
export type FloorFailure = "NO_INGREDIENTS";

export interface DraftAction {
  kind: "draft";
  slug: string;
  name: string;
  /** Every floor this row fails, in declaration order. Never empty. */
  failures: FloorFailure[];
  /** One line for the plan log and the audit note. */
  note: string;
}

export interface Plan {
  actions: DraftAction[];
  /** Fatal problems — apply must refuse while any exist. */
  blockers: string[];
  reports: {
    /** Passed both floors and stays on the menu. */
    passing: string[];
    /** Already `pending_review` or `blocked` — nothing to do, not a pass. */
    alreadyDrafted: string[];
    /** Archived (M-3 CUT/MERGE/DELIST) — off the menu for a different reason. */
    archived: string[];
  };
  counts: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Floor 1 — ingredients

/**
 * Placeholder ingredient phrases: strings that occupy the field without
 * naming a single food. Matched on the WHOLE normalised entry, never as a
 * substring — "fresh ingredients" is a placeholder, but "fresh coriander" is
 * an ingredient and a substring rule would eat it.
 *
 * `["fresh ingredients"]` is the one in production (17 dishes as of the
 * 2026-08-18 macro truth report); the rest are the neighbouring phrasings a
 * later import would plausibly write, listed so the next one does not sail
 * through. Extend rather than loosen: a substring or fuzzy rule here would
 * start drafting dishes that DO list their food.
 */
export const PLACEHOLDER_INGREDIENTS: ReadonlySet<string> = new Set([
  "fresh ingredients",
  "fresh ingredient",
  "assorted ingredients",
  "seasonal ingredients",
  "chef's selection",
  "chefs selection",
  "as per recipe",
  "n/a",
  "na",
  "tbd",
  "-",
]);

/** Trim, collapse inner whitespace, lowercase. Punctuation is left alone so
 *  "chef's selection" and "chefs selection" are two entries above rather than
 *  one lossy normalisation that might collapse a real ingredient. */
export function normalizeIngredient(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * True when the list names no food at all: empty, or every entry is blank or
 * a known placeholder.
 *
 * ANY real entry passes the floor. A list of ["fresh ingredients", "paneer"]
 * is thin but not blank — it can be filtered on paneer, so a customer
 * excluding dairy is correctly warned. Drafting it would be a content-quality
 * judgement, and this engine only ever decides absence.
 */
export function hasNoIngredientData(ingredients: string[] | null): boolean {
  if (!ingredients || ingredients.length === 0) return true;
  return ingredients.every((entry) => {
    const norm = normalizeIngredient(entry);
    return norm === "" || PLACEHOLDER_INGREDIENTS.has(norm);
  });
}

// ---------------------------------------------------------------------------
// The plan

/** Floors in the order they are reported, so a row's `failures` array and the
 *  note derived from it are stable across runs (the note reaches an audit_log
 *  row, and churn there is indistinguishable from a real change). */
const FLOORS: ReadonlyArray<{
  id: FloorFailure;
  fails: (row: DbDishRow) => boolean;
  phrase: string;
}> = [
  {
    id: "NO_INGREDIENTS",
    fails: (row) => hasNoIngredientData(row.ingredients),
    phrase: "no ingredient data (allergen and Diabetic Safe filters cannot see it)",
  },
];

export function evaluateFloors(row: DbDishRow): FloorFailure[] {
  return FLOORS.filter((f) => f.fails(row)).map((f) => f.id);
}

function noteFor(failures: FloorFailure[]): string {
  const phrases = FLOORS.filter((f) => failures.includes(f.id)).map((f) => f.phrase);
  return `Drafted below the data floor: ${phrases.join("; ")}.`;
}

/**
 * Build the plan.
 *
 * Only `reviewed`, non-archived rows are candidates — those are the rows a
 * customer can currently see. A `pending_review` row is already drafted and a
 * `blocked` row is already off; re-stating either would churn `updated_at`
 * and write an audit entry for a change that did not happen. An archived row
 * is off the menu under the M-3 verdict, and drafting it on top would blur
 * two different reasons for the same absence.
 *
 * Duplicate slugs are a BLOCKER rather than a dedup: `menu_items.slug` is
 * unique, so a repeat here means the caller's query is wrong, and silently
 * picking one row would apply a plan built from data the operator never saw.
 */
export function buildPlan(rows: readonly DbDishRow[]): Plan {
  const blockers: string[] = [];

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.slug)) {
      blockers.push(
        `duplicate slug in input: ${row.slug} — menu_items.slug is unique, so the query is wrong`,
      );
    }
    seen.add(row.slug);
  }

  const actions: DraftAction[] = [];
  const passing: string[] = [];
  const alreadyDrafted: string[] = [];
  const archived: string[] = [];

  for (const row of rows) {
    if (row.archived) {
      archived.push(row.slug);
      continue;
    }
    if (row.reviewState !== "reviewed") {
      alreadyDrafted.push(row.slug);
      continue;
    }
    const failures = evaluateFloors(row);
    if (failures.length === 0) {
      passing.push(row.slug);
      continue;
    }
    actions.push({
      kind: "draft",
      slug: row.slug,
      name: row.name,
      failures,
      note: noteFor(failures),
    });
  }

  const sortBySlug = (a: string, b: string) => a.localeCompare(b);
  actions.sort((a, b) => sortBySlug(a.slug, b.slug));
  passing.sort(sortBySlug);
  alreadyDrafted.sort(sortBySlug);
  archived.sort(sortBySlug);

  return {
    actions,
    blockers,
    reports: { passing, alreadyDrafted, archived },
    counts: {
      rows: rows.length,
      draft: actions.length,
      passing: passing.length,
      alreadyDrafted: alreadyDrafted.length,
      archived: archived.length,
      // Per-floor tallies derived from FLOORS rather than hand-listed, so a
      // floor added later cannot be silently missing from the plan log — the
      // hand-listed version is how a wrong floor stayed unexamined.
      ...Object.fromEntries(
        FLOORS.map((f) => [f.id, actions.filter((a) => a.failures.includes(f.id)).length]),
      ),
    },
  };
}

/**
 * Re-plan assertion: after applying, no `reviewed` row may still be below the
 * floor. Returns the slugs that are, which must be empty.
 *
 * This is the convergence check every plan-then-apply script in this
 * directory runs — an apply that does not converge means the write did not
 * take, and reporting success on that is how a silent failure ships.
 */
export function verifyPostState(rows: readonly DbDishRow[]): string[] {
  return rows
    .filter((r) => !r.archived && r.reviewState === "reviewed")
    .filter((r) => evaluateFloors(r).length > 0)
    .map((r) => r.slug)
    .sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Rendering

export function renderPlanMarkdown(plan: Plan): string {
  const lines: string[] = [];
  lines.push("# Dish data-floor plan");
  lines.push("");
  lines.push(
    "Dishes below the floor are moved to `allergen_review_state = 'pending_review'`:",
    "hidden from `/menu/public` and `/menu/ranked`, still visible to staff and RD",
    "admin routes, and back on the menu as soon as an RD flips the state.",
    "",
  );
  lines.push("| | count |");
  lines.push("|---|---:|");
  for (const [k, v] of Object.entries(plan.counts)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push("");

  if (plan.blockers.length > 0) {
    lines.push("## Blockers — apply refuses while any of these stand");
    lines.push("");
    for (const b of plan.blockers) lines.push(`- ${b}`);
    lines.push("");
  }

  if (plan.actions.length === 0) {
    lines.push("No dish is below the floor. Nothing to draft.");
    return lines.join("\n") + "\n";
  }

  lines.push("## Drafted");
  lines.push("");
  lines.push("| slug | dish | failures |");
  lines.push("|---|---|---|");
  for (const a of plan.actions) {
    lines.push(`| \`${a.slug}\` | ${a.name} | ${a.failures.join(", ")} |`);
  }
  lines.push("");
  return lines.join("\n") + "\n";
}
