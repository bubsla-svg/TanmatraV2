// ─────────────────────────────────────────────────────────────────────────────
// Menu-engineering plan (PURE — no DB import, unit-testable without Postgres).
//
// Turns the curated-catalog CSV (scripts/data/curated_catalog.csv) into a
// concrete, reviewable plan of row-level changes against a set of candidate
// menu items (name + slug). The DB executor (apply-menu-engineering.ts) feeds
// it live `menu_items` rows; the unit test feeds it the static catalog.
//
// Matching is by NAME (normalized), never by slug: the CSV was exported from
// Petpooja sales and carries no stable id we share with `menu_items`.
//
// SAFETY POSTURE (this mutates a live availability/price surface):
//   • Only EXACT-normalized or AUDITED-OVERRIDE matches produce an applied
//     change. There is NO fuzzy substring auto-apply — a shorter/generic CSV
//     name must never silently disable or reprice a longer, more-specific dish.
//   • A CSV row that resolves to a candidate ALREADY claimed by an earlier row
//     is a CONFLICT (reported, never a second write) — so a KEEP and a later
//     CUT of the same dish can't quietly disable it.
//   • Rows matching >1 candidate are AMBIGUOUS (reported, never applied).
//   • Unmatched rows get a report-only substring SUGGESTION (never applied) so
//     an operator can add an override after eyeballing the live DB.
// ─────────────────────────────────────────────────────────────────────────────

export type CuratedAction = "KEEP-PUSH" | "PROMOTE" | "KEEP" | "HOLD-COST" | "CUT";

/** Sane bounds for a curated price (whole rupees) before it can drive a write. */
export const MIN_PRICE_RUPEES = 1;
export const MAX_PRICE_RUPEES = 100000;

export interface CuratedRow {
  action: CuratedAction;
  dish: string;
  category: string;
  /** Target menu price in whole rupees (from the sales sheet), or null. */
  priceRupees: number | null;
  reason: string;
}

export interface SkippedRow {
  /** 1-based body line index (excludes the header). */
  index: number;
  rawAction: string;
  dish: string;
  why: string;
}

export interface ParsedCsv {
  rows: CuratedRow[];
  /** Rows dropped during parse (unknown action / out-of-range price) — surfaced
   * so a re-labeled or malformed row can never vanish silently. */
  skipped: SkippedRow[];
}

export interface MenuCandidate {
  name: string;
  slug: string;
}

/** Current DB state consulted by the diff — enough to compute a minimal,
 * idempotent set of writes AND to notice a temporary-86 masquerading as done. */
export interface CurrentState {
  isAvailable: boolean;
  pricePaise: number;
  unavailableUntil: Date | string | null;
  unavailableReason: string | null;
}

export interface PlannedChange {
  slug: string;
  csvDish: string;
  matchedName: string;
  action: CuratedAction;
  /** true when this row cuts the dish (→ set unavailable). */
  cut: boolean;
  reason: string;
  /** Desired price in paise when the CSV carried a valid price, else null. */
  targetPricePaise: number | null;
  /** How the CSV row was matched. Substring is NEVER applied (see suggestions). */
  matchKind: "exact" | "override";
}

export interface Suggestion {
  row: CuratedRow;
  candidateSlug: string;
  candidateName: string;
}

export interface MenuEngineeringPlan {
  changes: PlannedChange[];
  /** CSV rows with no exact/override candidate (expected for off-brand SKUs). */
  unmatched: CuratedRow[];
  /** CSV rows whose normalized name matched more than one candidate. */
  ambiguous: { row: CuratedRow; candidates: string[] }[];
  /** CSV rows that resolved to a candidate an earlier row already claimed. */
  conflicts: { row: CuratedRow; slug: string; priorCsvDish: string }[];
  /** Report-only near-misses for unmatched rows (unique substring hit). */
  suggestions: Suggestion[];
}

// Manual overrides for names normalization alone cannot reconcile. Keyed by the
// NORMALIZED csv dish → the NORMALIZED target name. Kept tiny and explicit so a
// reviewer can audit every forced match. Extend only with a paired reason.
const NORMALIZED_OVERRIDES: Record<string, string> = {
  // "Falafal" is a consistent misspelling of "Falafel" in the sales export.
  "falafal garden salad": "falafel garden salad",
  "falafal hummus wrap": "falafel hummus wrap",
  "falafal pita pockets with hummus": "falafel pita pockets with hummus",
};

function normalizeRaw(raw: string): string {
  let s = raw.normalize("NFD").replace(/[̀-ͯ]/g, ""); // strip accents
  s = s.toLowerCase();
  s = s.replace(/\band\b/g, " ").replace(/&/g, " ");
  // Parenthetical handling is deliberately selective. A protein/diet qualifier
  // — "(Veg)", "(Chicken)", "(2 Egg)" — is IDENTITY and must be kept (so the
  // Veg / Chicken / Prawns variants of a dish never collapse into one another).
  // A pure serving-count — "(1)", "(2)" — and unit words ("Pc"/"piece") are
  // noise and are dropped so "Brownie (1) Pc" reconciles to "Brownie".
  s = s.replace(/\(\s*\d+\s*\)/g, " "); // drop pure-count parens: (1), (2)
  s = s.replace(/[()]/g, " "); // keep remaining parenthetical CONTENT as tokens
  s = s.replace(/\b\d*\s*(?:pc|pcs|piece|pieces)\b/g, " "); // drop serving-unit qualifiers
  s = s.replace(/[^a-z0-9]+/g, " "); // non-alphanumerics → space
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function normalizeName(raw: string): string {
  const s = normalizeRaw(raw);
  return NORMALIZED_OVERRIDES[s] ?? s;
}

/** True when the CSV name only reconciles to a candidate via a manual override. */
function isOverride(raw: string): boolean {
  return NORMALIZED_OVERRIDES[normalizeRaw(raw)] !== undefined;
}

/** Core content tokens (drops very common filler words that add no identity). */
const FILLER = new Set(["with", "the", "of", "a", "high", "protein", "healthy", "classic"]);
function coreTokens(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t && !FILLER.has(t));
}

/** The audit reason written to unavailable_reason for a CUT. Shared so the diff
 * and the executor agree on the exact idempotent target string. */
export function cutReason(reason: string): string {
  return `menu-engineering CUT: ${reason}`.slice(0, 500);
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields with commas). NOTE:
 * embedded newlines inside quoted fields are not supported — the curated sheet
 * has none, and parseCuratedCsv reports any row it cannot classify. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    if (line.trim() === "") continue;
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') inQ = false;
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") {
        fields.push(cur);
        cur = "";
      } else cur += c;
    }
    fields.push(cur);
    rows.push(fields);
  }
  return rows;
}

const VALID_ACTIONS = new Set<CuratedAction>([
  "KEEP-PUSH",
  "PROMOTE",
  "KEEP",
  "HOLD-COST",
  "CUT",
]);

/** Normalize an action token tolerantly (case + space/hyphen) before validating. */
function canonicalAction(raw: string): CuratedAction | null {
  const a = raw.trim().toUpperCase().replace(/\s+/g, "-");
  return VALID_ACTIONS.has(a as CuratedAction) ? (a as CuratedAction) : null;
}

/** Parse the curated-catalog CSV text into typed rows + a record of what was
 * dropped and why (nothing vanishes silently). */
export function parseCuratedCsv(text: string): ParsedCsv {
  const rows = parseCsv(text);
  if (rows.length === 0) return { rows: [], skipped: [] };
  const [header, ...body] = rows;
  const col = (name: string) => header.indexOf(name);
  const iAction = col("action");
  const iDish = col("dish");
  const iCategory = col("category");
  const iPrice = col("price");
  const iReason = col("reason");
  if (iAction < 0 || iDish < 0) {
    throw new Error("curated CSV missing required 'action'/'dish' columns");
  }
  const out: CuratedRow[] = [];
  const skipped: SkippedRow[] = [];
  body.forEach((f, i) => {
    const rawAction = (f[iAction] ?? "").trim();
    const dish = (f[iDish] ?? "").trim();
    const action = canonicalAction(rawAction);
    if (!action) {
      skipped.push({ index: i + 1, rawAction, dish, why: "unrecognized action" });
      return;
    }
    const priceRaw = iPrice >= 0 ? (f[iPrice] ?? "").trim() : "";
    let priceRupees: number | null = null;
    if (priceRaw !== "") {
      const n = Number(priceRaw);
      if (Number.isFinite(n) && n >= MIN_PRICE_RUPEES && n <= MAX_PRICE_RUPEES) {
        priceRupees = n;
      } else {
        // Out-of-range/malformed price → leave price alone (never write it), and
        // record so the operator sees it rather than silently syncing Rs 0.
        skipped.push({
          index: i + 1,
          rawAction,
          dish,
          why: `price "${priceRaw}" out of [${MIN_PRICE_RUPEES}, ${MAX_PRICE_RUPEES}] — price ignored`,
        });
      }
    }
    out.push({
      action,
      dish,
      category: (iCategory >= 0 ? f[iCategory] ?? "" : "").trim(),
      priceRupees,
      reason: (iReason >= 0 ? f[iReason] ?? "" : "").trim(),
    });
  });
  return { rows: out, skipped };
}

/**
 * Build the change plan. Match is EXACT normalized equality (override folded in)
 * against a single candidate that no earlier row has claimed. Everything else is
 * reported and never auto-applied:
 *   >1 candidate            → ambiguous
 *   candidate already taken → conflict
 *   0 candidates            → unmatched (+ a report-only substring suggestion)
 */
export function buildPlan(
  rows: CuratedRow[],
  candidates: MenuCandidate[],
): MenuEngineeringPlan {
  const byNorm = new Map<string, MenuCandidate[]>();
  for (const c of candidates) {
    const key = normalizeName(c.name);
    const list = byNorm.get(key) ?? [];
    list.push(c);
    byNorm.set(key, list);
  }

  const changes: PlannedChange[] = [];
  const unmatched: CuratedRow[] = [];
  const ambiguous: { row: CuratedRow; candidates: string[] }[] = [];
  const conflicts: { row: CuratedRow; slug: string; priorCsvDish: string }[] = [];
  const suggestions: Suggestion[] = [];
  const claimedBy = new Map<string, string>(); // slug → the csvDish that claimed it

  for (const row of rows) {
    const norm = normalizeName(row.dish);
    const hits = byNorm.get(norm) ?? [];

    if (hits.length > 1) {
      ambiguous.push({ row, candidates: hits.map((c) => c.slug) });
      continue;
    }

    if (hits.length === 1) {
      const cand = hits[0];
      const prior = claimedBy.get(cand.slug);
      if (prior !== undefined) {
        conflicts.push({ row, slug: cand.slug, priorCsvDish: prior });
        continue;
      }
      claimedBy.set(cand.slug, row.dish);
      changes.push({
        slug: cand.slug,
        csvDish: row.dish,
        matchedName: cand.name,
        action: row.action,
        cut: row.action === "CUT",
        reason: row.reason,
        targetPricePaise: row.priceRupees != null ? Math.round(row.priceRupees * 100) : null,
        matchKind: isOverride(row.dish) ? "override" : "exact",
      });
      continue;
    }

    // No exact/override match. Record a report-only substring SUGGESTION when the
    // CSV row's core tokens appear in exactly one candidate — never applied.
    unmatched.push(row);
    const tokens = coreTokens(norm);
    if (tokens.length > 0) {
      const near = candidates.filter((c) => {
        const cNorm = ` ${normalizeName(c.name)} `;
        return tokens.every((t) => cNorm.includes(` ${t} `));
      });
      if (near.length === 1) {
        suggestions.push({ row, candidateSlug: near[0].slug, candidateName: near[0].name });
      }
    }
  }

  return { changes, unmatched, ambiguous, conflicts, suggestions };
}

/** Only the changes that would actually mutate a row given current DB state.
 * Idempotent: a dish already in the exact CUT target state (unavailable, no
 * future window, audit reason set) is NOT re-touched; a temporary-86 dish that
 * should be permanently CUT still IS (its window/reason must be corrected). */
export function diffAgainstCurrent(
  changes: PlannedChange[],
  current: Map<string, CurrentState>,
): {
  toDisable: PlannedChange[];
  priceSyncs: { change: PlannedChange; fromPaise: number; toPaise: number }[];
} {
  const toDisable: PlannedChange[] = [];
  const priceSyncs: { change: PlannedChange; fromPaise: number; toPaise: number }[] = [];
  for (const ch of changes) {
    const cur = current.get(ch.slug);
    if (ch.cut) {
      const alreadyCut =
        cur != null &&
        cur.isAvailable === false &&
        cur.unavailableUntil == null &&
        cur.unavailableReason === cutReason(ch.reason);
      if (!alreadyCut) toDisable.push(ch);
      continue; // never re-price a dish we are removing
    }
    if (ch.targetPricePaise != null && cur && cur.pricePaise !== ch.targetPricePaise) {
      priceSyncs.push({ change: ch, fromPaise: cur.pricePaise, toPaise: ch.targetPricePaise });
    }
  }
  return { toDisable, priceSyncs };
}
