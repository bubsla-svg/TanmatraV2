/**
 * Plan the removal of dietitian/RD credentials from customer-facing dish copy
 * stored in Postgres — the pure half of `backfill-honest-claims.ts`.
 *
 * WHY A SCRIPT AT ALL
 * -------------------
 * The catalogue is not in this repo. `lib/menu-catalog` holds a static
 * FALLBACK; the dish copy a customer actually reads is `menu_items` rows served
 * by `/api/menu/public`. PRs #129 and #130 took "RD-formulated", "RD-reviewed"
 * and every other dietitian claim out of the storefront's own copy and out of
 * the fallback catalog — but a row in the database saying "RD-formulated for
 * high protein muscle recovery" keeps rendering that claim on the live site,
 * untouched by any of it. Measured against `/api/menu/public` on 2026-09-06,
 * SIX of the 95 live dishes carry such a claim in customer copy: one says
 * "RD-formulated" in `description`, and five carry a whole "RD Advisory Note:
 * … - Signed by Dr. Vikram Sethi" paragraph in `long_description`. The other 68
 * rows in the table (drafted, archived, or awaiting review — CLAUDE.md's 163)
 * are not in that response and are only visible with a database.
 *
 * WHY THE REWRITES ARE A TABLE, NOT A REGEX
 * -----------------------------------------
 * Detection is generic; rewriting is NOT. A regex that strips "RD-formulated "
 * from arbitrary prose produces "for high protein muscle recovery" — a
 * sentence fragment shipped to customers. So every rewrite is written out by
 * hand in REWRITES below, and anything this plan DETECTS but cannot rewrite
 * from that table becomes a BLOCKER: it is reported for a human to word, and
 * `--apply` refuses while one stands. The script can flag a claim it has never
 * seen; it can never invent prose for a dish nobody reviewed.
 *
 * SCOPE
 * -----
 * COPY_FIELDS — the columns this plan REWRITES — are customer copy only.
 *
 * `rd_note` is CLEARED, not rewritten (owner, 2026-09-06). `/api/menu/public`
 * serves it, and on 46 of the 95 live dishes it holds a health claim signed
 * "- Signed by Dr. Vikram Sethi" — a name from the seeded RD roster in
 * `artifacts/api-server/src/lib/rdIdentity.ts`, where he is listed as a
 * *dietitian*, not a doctor.
 *
 * Clearing is the only honest option. Stripping just the signature leaves
 * "MUFAs … support cardiovascular health" standing as an UNATTRIBUTED clinical
 * claim, which is worse, not better; rewording it would be inventing a review
 * nobody performed. The row's original text is preserved in the runner's backup
 * JSON, so nothing is lost — it stops being served.
 *
 * Only notes carrying a claim or a signature are cleared. `draft-thin-dishes.ts`
 * writes real ops records here ("Drafted below the data floor: …"), and those
 * carry neither, so they survive untouched. `unavailable_reason` is an ops field
 * and is out of scope entirely.
 */

/** The customer-facing text columns on `menu_items`, by their Drizzle names. */
export const COPY_FIELDS = [
  "name",
  "description",
  "longDescription",
  "seoTitle",
  "seoDescription",
  "badge",
] as const;

export type CopyField = (typeof COPY_FIELDS)[number];

/**
 * `rd_note` is written, but only ever to null — it is cleared, never reworded.
 * Keeping it out of COPY_FIELDS is what stops `rewriteCopy` being applied to it.
 */
export const CLEARED_FIELD = "rdNote" as const;

export type WritableField = CopyField | typeof CLEARED_FIELD;

/** The subset of a `menu_items` row this plan reads. */
export interface DbCopyRow {
  slug: string;
  archived: boolean;
  name: string | null;
  description: string | null;
  longDescription: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  badge: string | null;
  /** Cleared when it carries a claim or a signature — see SCOPE above. */
  rdNote?: string | null;
}

/** Does this `rd_note` carry an unearned claim, by vocabulary or by signature? */
export function rdNoteIsUnearned(note: string | null | undefined): boolean {
  if (typeof note !== "string" || note.length === 0) return false;
  return CLAIM_PATTERN.test(note) || ATTRIBUTION_PATTERN.test(note);
}

/**
 * The vocabulary. `\bRD\b` and `RD-` are the ones that bite: "RD-formulated",
 * "RD-reviewed", "RD Verified". The word boundary is what keeps "curd-delivered"
 * and "third-party" out — a naive /RD-/i matches inside both, which is exactly
 * the false positive an early scan of the live menu produced.
 */
export const CLAIM_PATTERN =
  /\bRD\b|\bRDs\b|(?<![A-Za-z])RD-[A-Za-z]|\bdietit[ia]ian?s?\b|\bdietitians?\b|\bnutritionists?\b/i;

/**
 * Curated rewrites, longest key first at match time so a specific phrase wins
 * over a shorter one inside it.
 *
 * "Built for high-protein muscle recovery." is not a fresh invention: it is the
 * exact wording already shipped for this same sentence in
 * `lib/menu-catalog/src/index.ts` (PR #129). Reusing it verbatim is the point —
 * the fallback catalog and the database must not describe the same dish
 * differently.
 */
/**
 * An attribution line — "… - Signed by Dr. Vikram Sethi". This is NOT in
 * CLAIM_PATTERN on purpose: CLAIM_PATTERN drives rewrites of customer copy, and
 * a name is not a word we can swap. It exists because `rd_note`'s claim on 46
 * live rows is the SIGNATURE, not the vocabulary — "MUFAs support
 * cardiovascular health. - Signed by Dr. Vikram Sethi" contains no "RD" and no
 * "dietitian", and scanning it for those alone reports the row as clean.
 */
export const ATTRIBUTION_PATTERN = /-\s*Signed by\s+\S/i;

export const REWRITES: ReadonlyArray<{ from: string; to: string }> = [
  { from: "RD-formulated for high protein muscle recovery.", to: "Built for high-protein muscle recovery." },
  { from: "RD-formulated for high-protein muscle recovery.", to: "Built for high-protein muscle recovery." },
  { from: "RD-formulated", to: "Chef-built" },
  { from: "RD-reviewed", to: "Kitchen-checked" },
  { from: "RD-verified", to: "Nutrition checked" },
  { from: "RD Verified", to: "Nutrition checked" },
  { from: "RD-approved", to: "Kitchen-checked" },
  { from: "RD-portioned", to: "Portion-controlled" },
  { from: "RD-designed", to: "Chef-built" },
  { from: "RD-crafted", to: "Chef-built" },
];

/**
 * A whole "RD Advisory Note: … - Signed by <name>" paragraph, as it is stored
 * on 5 live dishes' `long_description`, alongside a sibling "Chef Note:"
 * paragraph. Blocks are separated by a blank line.
 *
 * This one is STRUCTURAL rather than a phrase swap, and that is the only reason
 * it can be automated: the fix is to drop an unearned clinical endorsement
 * whole, not to reword it. Nothing else in the description is touched — the
 * dish copy and the Chef Note survive verbatim.
 */
const RD_NOTE_HEADING = /^\s*RD Advisory Note:/;

/** Drop every blank-line-separated block that opens with the advisory heading. */
function stripAdvisoryBlocks(value: string): string {
  return value
    .split(/\r?\n\s*\r?\n/)
    .filter((block) => !RD_NOTE_HEADING.test(block))
    .join("\n\n")
    .trim();
}

export interface CopyEdit {
  slug: string;
  field: WritableField;
  before: string;
  /** null only for `rd_note`, which is cleared rather than reworded. */
  after: string | null;
}

export interface Plan {
  edits: CopyEdit[];
  /** Detected claims no REWRITES entry can resolve. `--apply` refuses on these. */
  blockers: string[];
  counts: Record<string, number>;
}

/** Every field value carrying the vocabulary, in COPY_FIELDS order. */
export function claimFields(row: DbCopyRow): Array<{ field: CopyField; value: string }> {
  const out: Array<{ field: CopyField; value: string }> = [];
  for (const field of COPY_FIELDS) {
    const value = row[field];
    if (typeof value === "string" && value.length > 0 && CLAIM_PATTERN.test(value)) {
      out.push({ field, value });
    }
  }
  return out;
}

/**
 * Apply every rewrite whose `from` occurs, longest first. Returns the rewritten
 * string, or null when nothing in the table applied — which is the signal that
 * a human has to word this one.
 */
export function rewriteCopy(value: string): string | null {
  // Structural first: dropping the advisory block can remove the only claim,
  // leaving nothing for the phrase table to find.
  let out = stripAdvisoryBlocks(value);
  const ordered = [...REWRITES].sort((a, b) => b.from.length - a.from.length);
  for (const { from, to } of ordered) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out === value ? null : out;
}

export function buildPlan(rows: readonly DbCopyRow[]): Plan {
  const edits: CopyEdit[] = [];
  const blockers: string[] = [];
  let rowsWithClaims = 0;
  let archivedWithClaims = 0;
  let notesCleared = 0;

  for (const row of rows) {
    if (rdNoteIsUnearned(row.rdNote)) {
      // Cleared whole. No rewrite table, no blocker: there is no wording that
      // makes a review nobody performed true.
      edits.push({ slug: row.slug, field: CLEARED_FIELD, before: row.rdNote as string, after: null });
      notesCleared += 1;
    }
    const hits = claimFields(row);
    if (hits.length === 0) continue;
    rowsWithClaims += 1;
    if (row.archived) archivedWithClaims += 1;

    for (const { field, value } of hits) {
      const after = rewriteCopy(value);
      if (after === null) {
        blockers.push(`${row.slug}.${field}: no rewrite for — ${JSON.stringify(value)}`);
        continue;
      }
      // A rewrite that leaves the vocabulary behind is worse than none: it
      // reports success while the claim still renders.
      if (CLAIM_PATTERN.test(after)) {
        blockers.push(`${row.slug}.${field}: rewrite still carries a claim — ${JSON.stringify(after)}`);
        continue;
      }
      edits.push({ slug: row.slug, field, before: value, after });
    }
  }

  return {
    edits,
    blockers,
    counts: {
      rows: rows.length,
      rowsWithClaims,
      archivedWithClaims,
      edits: edits.length,
      blocked: blockers.length,
      notesCleared,
    },
  };
}

/**
 * Post-apply assertion: no customer-facing field on any row may still carry the
 * vocabulary. Returns the offending `slug.field` list, empty when clean.
 */
export function verifyPostState(rows: readonly DbCopyRow[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    for (const { field } of claimFields(row)) out.push(`${row.slug}.${field}`);
    if (rdNoteIsUnearned(row.rdNote)) out.push(`${row.slug}.${CLEARED_FIELD}`);
  }
  return out;
}

export function renderPlanMarkdown(plan: Plan): string {
  const lines: string[] = [
    "# Honest-claims copy backfill",
    "",
    `Rows scanned: **${plan.counts["rows"]}** · carrying a claim: **${plan.counts["rowsWithClaims"]}** ` +
      `(archived: ${plan.counts["archivedWithClaims"]}) · edits: **${plan.counts["edits"]}** · ` +
      `blocked: **${plan.counts["blocked"]}**`,
    "",
    `\`rd_note\` rows cleared: **${plan.counts["notesCleared"]}**`,
    "",
  ];
  if (plan.blockers.length > 0) {
    lines.push("## Blockers — a human has to word these", "");
    for (const b of plan.blockers) lines.push(`- ${b}`);
    lines.push("");
  }
  if (plan.edits.length > 0) {
    lines.push("## Edits", "");
    for (const e of plan.edits) {
      lines.push(
        `### \`${e.slug}\` · \`${e.field}\``,
        "",
        `- before: ${e.before}`,
        `- after: ${e.after === null ? "_(cleared)_" : e.after}`,
        "",
      );
    }
  }
  return lines.join("\n");
}
