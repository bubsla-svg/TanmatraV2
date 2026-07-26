import { pool } from "@workspace/db";
import { logger } from "./logger";

// ---- Curated safe data layer ------------------------------------------------
// We expose the warehouse to the NL analytics agent and to manual SQL ONLY
// through SQL VIEWS that we own and maintain in this file. Each view selects
// a deliberately narrow column set — sensitive PII (phone, address, email)
// is omitted. The validator below refuses any query that references a name
// outside this allowlist, so column-level safety is enforced by the DB
// itself even if the validator is somehow bypassed.

export interface SafeColumn {
  name: string;
  type: string;
  description?: string;
}
export interface SafeTable {
  name: string; // view name analysts can reference
  source: string; // underlying table the view is built from
  description: string;
  columns: SafeColumn[];
}

export const SAFE_SCHEMA: SafeTable[] = [
  {
    name: "safe_orders",
    source: "orders",
    description:
      "EVERY order the business touched, from every channel and of every kind — not just our own customers'. Filter with order_channel / order_kind before calling any total 'revenue'. items is jsonb [{name,qty,price (paise)}].",
    columns: [
      { name: "id", type: "int" },
      { name: "user_id", type: "varchar" },
      { name: "status", type: "varchar" },
      {
        name: "total_paise",
        type: "int",
        description:
          "gross order value in paise, GST and delivery included. NOTE: rows differ in composition — own_app rows priced by our checkout carry the same gross, aggregator rows carry the aggregator's grand total. Summing across channels mixes our revenue with a marketplace's gross merchandise value",
      },
      { name: "city", type: "varchar" },
      { name: "pincode", type: "varchar" },
      { name: "items", type: "jsonb" },
      { name: "created_at", type: "timestamptz" },
      // ── appended 2026-07 ──────────────────────────────────────────────────
      // New columns MUST go at the end of this list. ensureSafeViews uses
      // CREATE OR REPLACE VIEW, and Postgres accepts added columns only at the
      // tail: inserting one mid-list fails with 42P16 ("cannot change name of
      // view column"), which leaves the OLD view in place while
      // describeSchemaForPrompt() starts advertising a column the database does
      // not have. See classifySafeViewError below — that failure used to be
      // logged as "source missing", which is the opposite of what happened.
      {
        name: "order_channel",
        type: "varchar",
        description:
          "how the order reached us: 'own_app' (our storefront — the only rows that are our own customers), 'zomato', 'swiggy', 'pos' (arrived via the POS, provenance unstated), 'other'. Use order_channel = 'own_app' for anything describing OUR revenue, customers or funnel",
      },
      {
        name: "order_kind",
        type: "varchar",
        description:
          "'meal' (kitchen-prepared delivery) or 'marketplace' (shelf-stable goods). Food metrics want order_kind = 'meal'",
      },
    ],
  },
  {
    name: "safe_menu_items",
    source: "menu_items",
    description: "Catalog menu items.",
    columns: [
      { name: "slug", type: "varchar" },
      { name: "name", type: "varchar" },
      { name: "price_paise", type: "int" },
      { name: "is_available", type: "boolean" },
      { name: "category", type: "varchar" },
    ],
  },
  {
    name: "safe_dish_reviews",
    source: "dish_reviews",
    description: "Customer dish reviews. rating is 1..5.",
    columns: [
      { name: "id", type: "int" },
      { name: "slug", type: "varchar" },
      { name: "rating", type: "int" },
      { name: "body", type: "text" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    name: "safe_anomaly_alerts",
    source: "anomaly_alerts",
    description: "Auto-detected metric anomalies.",
    columns: [
      { name: "id", type: "int" },
      { name: "metric", type: "varchar" },
      { name: "severity", type: "varchar" },
      { name: "status", type: "varchar" },
      { name: "value", type: "double precision" },
      { name: "baseline", type: "double precision" },
      { name: "summary", type: "text" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    name: "safe_subscriptions",
    source: "subscriptions",
    description:
      "Customer meal subscriptions, every status — filter on status for active ones. There is no single 'plan' column: a subscription is priced by cadence × meals_per_delivery.",
    columns: [
      { name: "id", type: "int" },
      { name: "user_id", type: "varchar" },
      { name: "status", type: "varchar", description: "'active', 'paused', 'cancelled'" },
      // `plan` used to be listed here and does not exist on `subscriptions` —
      // it never has, in any migration. So this view has never been created in
      // any environment: every `create or replace view safe_subscriptions` has
      // failed with 42703 since the day it was written, the analytics prompt
      // has advertised it the whole time, and the boot log called it "source
      // missing", which sent anyone who looked to check a table that was there.
      // The drift check added alongside this is what found it.
      //
      // Removing a column would normally be the one edit CREATE OR REPLACE
      // VIEW cannot do (see classifySafeViewError). It is free here precisely
      // because there is no existing view to replace.
      {
        name: "cadence",
        type: "varchar",
        description: "'weekly', 'fortnightly' or 'monthly' — the delivery frequency",
      },
      { name: "meals_per_delivery", type: "int" },
      {
        name: "price_per_delivery_paise",
        type: "int",
        description: "what this subscriber is billed per delivery, in paise",
      },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    name: "safe_credit_ledger",
    source: "credit_ledger",
    description: "Customer credit/loyalty ledger. delta_paise > 0 = credit, < 0 = redemption.",
    columns: [
      { name: "id", type: "int" },
      { name: "user_id", type: "varchar" },
      { name: "delta_paise", type: "int" },
      { name: "reason", type: "varchar" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    name: "safe_support_messages",
    source: "messages",
    description:
      "Customer-side support chat messages (role='user' only is the typical filter). content is the raw message text.",
    columns: [
      { name: "id", type: "int" },
      { name: "conversation_id", type: "int" },
      { name: "role", type: "text" },
      { name: "content", type: "text" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    name: "safe_nps_responses",
    source: "nps_responses",
    description: "Customer NPS responses (0-10) with optional comment.",
    columns: [
      { name: "id", type: "int" },
      { name: "score", type: "int" },
      { name: "comment", type: "text" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    name: "safe_funnel_events",
    source: "funnel_events",
    description:
      "First-party funnel event log (one row per tracked event). Event names are snake_case contracts (view_menu, add_to_cart, checkout_start, order_created…). props (jsonb) is deliberately NOT exposed: the view mechanism selects whole columns and cannot filter jsonb keys, and although props are PII-scrubbed at ingest, free-form keys could still carry incidental identifiers. Use safe_funnel_daily for aggregates.",
    columns: [
      { name: "id", type: "int" },
      { name: "name", type: "varchar", description: "snake_case event name" },
      { name: "session_id", type: "varchar", description: "client session (null for server-emitted events)" },
      { name: "user_id", type: "varchar", description: "nullable — only set for signed-in users" },
      { name: "path", type: "varchar", description: "SPA route that fired the event ('server' for server-truth money events)" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    name: "safe_funnel_daily",
    source: "funnel_daily",
    description:
      "Nightly per-day per-event rollup of funnel_events (unique on day+name). distinct_sessions/distinct_users are per-day distincts — summing across days over-counts.",
    columns: [
      { name: "day", type: "date" },
      { name: "name", type: "varchar", description: "snake_case event name" },
      { name: "event_count", type: "int" },
      { name: "distinct_sessions", type: "int" },
      { name: "distinct_users", type: "int" },
    ],
  },
];

const ALLOWED_TABLE_NAMES = new Set(SAFE_SCHEMA.map((t) => t.name));

// Substring tokens that are unambiguous DDL/DML markers regardless of
// surrounding context. We deliberately do NOT include single English words
// that are also legitimate column names (e.g. "comment") — those are
// handled by the per-keyword regex list below which only matches when the
// word starts a SQL statement form, not a column reference.
const FORBIDDEN_SUBSTRINGS = [
  "pg_", "information_schema", ";--", "/*", "*/", "\\copy", "lo_",
  // Double-quoted identifiers would let a caller reference base tables like
  // "orders" or "users" that the FROM/JOIN allowlist regex (which only
  // matches unquoted lowercase identifiers) wouldn't catch. All safe_*
  // views are unquoted lowercase, so callers never need quoted identifiers.
  '"',
  // Postgres dollar-quoted strings ($$...$$ or $tag$...$tag$) bypass the
  // single-quote stripper in `stripStringLiterals`, so a `;` or DDL token
  // hidden inside one would not be visible to the keyword/statement
  // checks below. No legitimate analyst query needs them — refuse outright.
  "$$", "$tag$",
  // Functions that execute dynamic SQL or read raw files/cross-database
  // data — defense in depth on top of the role-based privilege boundary.
  "dblink", "xpath", "query_to_xml", "query_to_json",
  "current_setting", "set_config", "format(",
];
const FORBIDDEN_LEADING_KEYWORDS = [
  "insert", "update", "delete", "drop", "alter", "create", "truncate",
  "grant", "revoke", "copy", "vacuum", "analyze", "reset", "do", "call",
  "merge", "set",
];
// `comment on ...` is the SQL DDL we want to block; the bare word `comment`
// is a valid column name in safe_nps_responses, so we only refuse the
// statement form.
const FORBIDDEN_PHRASES = [
  /\bcomment\s+on\b/,
  /\bwith\s+recursive\b/,
];

const MAX_ROWS = 500;
const STATEMENT_TIMEOUT_MS = 4000;

export interface SafeSqlResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}

export class UnsafeSqlError extends Error {}

function stripStringLiterals(sql: string): string {
  // Remove single-quoted strings so identifiers inside literals don't trip us.
  return sql.replace(/'(?:''|[^'])*'/g, "''");
}

export function validateSafeSql(sqlIn: string): string {
  const sql = sqlIn.trim().replace(/;+\s*$/g, "");
  if (!sql) throw new UnsafeSqlError("empty SQL");
  const lowerFull = sql.toLowerCase();
  if (!lowerFull.startsWith("select ") && !lowerFull.startsWith("select\n")) {
    throw new UnsafeSqlError("only SELECT queries are allowed");
  }
  const stripped = stripStringLiterals(sql).toLowerCase();
  // Run the statement-separator check on the string-literal-stripped form,
  // not the raw input. A `;` inside a quoted literal (e.g. `where note =
  // 'a;b'`) is harmless; a `;` outside any literal is an unambiguous
  // attempt to chain a second statement and must be refused. Using `sql`
  // directly here would both false-positive on benign literals and miss
  // attacks that hide DDL after a `;` inside a malformed literal.
  if (stripped.includes(";")) {
    throw new UnsafeSqlError("only a single SELECT statement is allowed");
  }
  for (const tok of FORBIDDEN_SUBSTRINGS) {
    if (stripped.includes(tok)) {
      throw new UnsafeSqlError(`forbidden token: ${tok.trim()}`);
    }
  }
  for (const re of FORBIDDEN_PHRASES) {
    if (re.test(stripped)) {
      throw new UnsafeSqlError(`forbidden statement form: ${re.source}`);
    }
  }
  // Tokenize once and check if any DDL/DML keyword starts a statement.
  // Statement starts are: index 0, or the position right after `;` (already
  // rejected), or right after `)` followed by a leading keyword. Since we
  // already require the query to start with SELECT and disallow `;`, a
  // forbidden leading keyword can only appear inside a subquery — which is
  // also disallowed (e.g. `select * from safe_orders where exists (delete ...)`).
  for (const kw of FORBIDDEN_LEADING_KEYWORDS) {
    const re = new RegExp(`(^|[\\s(])${kw}\\b`);
    if (re.test(stripped)) {
      throw new UnsafeSqlError(`forbidden keyword: ${kw}`);
    }
  }
  // Reject implicit (comma) joins outright. The table-extraction regex
  // below only sees identifiers that follow FROM or JOIN, so a query like
  // `select * from safe_orders, orders` would otherwise expose the base
  // `orders` table. We walk every FROM clause and refuse if a top-level
  // comma appears before the next clause boundary.
  if (hasFromCommaJoin(stripped)) {
    throw new UnsafeSqlError("comma joins are not allowed; use explicit JOIN");
  }
  // Block derived tables / subqueries in the FROM/JOIN position. The regex
  // identifier check below scans every `from|join <ident>` occurrence
  // (including inside subqueries), but disallowing parenthesized FROM
  // sources entirely is a clearer guarantee that every relation reference
  // is a bare allowlisted view name.
  if (/\b(?:from|join)\s*\(/.test(stripped)) {
    throw new UnsafeSqlError("subqueries / derived tables in FROM/JOIN are not allowed");
  }
  // CTEs (WITH ...) similarly introduce named relations that bypass the
  // safe-view allowlist; refuse them.
  if (/^\s*with\b/.test(stripped) || /\)\s*select\b/.test(stripped)) {
    throw new UnsafeSqlError("CTEs are not allowed");
  }
  // Column-level safety is enforced by the DB itself: queries are only
  // allowed to reference `safe_*` views (created by ensureSafeViews) which
  // SELECT a narrow, explicit column list from each underlying table. Even
  // if the validator missed something, `select phone from safe_orders` will
  // fail at parse time inside Postgres because the view doesn't expose it.
  const tables = [
    ...stripped.matchAll(/\b(?:from|join)\s+(?:public\.)?([a-z_][a-z0-9_]*)/g),
  ].map((m) => m[1] ?? "");
  if (tables.length === 0) {
    throw new UnsafeSqlError("query must reference at least one table");
  }
  for (const t of tables) {
    if (!ALLOWED_TABLE_NAMES.has(t) || !t.startsWith("safe_")) {
      throw new UnsafeSqlError(`table not in safe view: ${t}`);
    }
  }
  return sql;
}

// Walks the (already-lowercased, string-literals-stripped) SQL and returns
// true if any top-level comma appears inside a FROM clause — i.e. an
// implicit (comma) join such as `from safe_orders, orders` or
// `from safe_orders o, users u`. Commas inside parentheses (function args,
// subqueries) are ignored.
export function hasFromCommaJoin(s: string): boolean {
  const CLAUSE_END = /^\s+(?:where|group|order|having|limit|offset|union|intersect|except|fetch|window|for|returning)\b/;
  let i = 0;
  while (i < s.length) {
    const idx = s.indexOf("from", i);
    if (idx === -1) return false;
    const before = idx === 0 ? "" : s[idx - 1] ?? "";
    const after = s[idx + 4] ?? "";
    // Require word boundaries so we don't match inside identifiers.
    if (/[a-z0-9_]/.test(before) || /[a-z0-9_]/.test(after)) {
      i = idx + 4;
      continue;
    }
    let j = idx + 4;
    let depth = 0;
    while (j < s.length) {
      const c = s[j];
      if (c === "(") {
        depth++;
        j++;
        continue;
      }
      if (c === ")") {
        if (depth === 0) break;
        depth--;
        j++;
        continue;
      }
      if (depth === 0) {
        if (c === ",") return true;
        if (CLAUSE_END.test(s.slice(j))) break;
      }
      j++;
    }
    i = j + 1;
  }
  return false;
}

// Postgres role used for executing user/NL-generated SQL. It is granted
// SELECT on the safe_* views ONLY. All analytics queries SET LOCAL ROLE to
// this identity inside the read-only transaction, so even if the regex
// validator missed a payload, Postgres itself enforces "no access to base
// tables" because the role has no privileges on them.
export const SAFE_ROLE = "safe_analytics_reader";

/**
 * Why a `create or replace view` was refused. The two causes need opposite
 * responses and used to be logged identically, as "source missing".
 *
 *   source-missing     the base table has not been migrated in yet (e.g.
 *                      nps_responses on a fresh database). Benign: the rest of
 *                      the pack still works and the view appears on the next
 *                      boot after the migration. Warn and carry on.
 *
 *   column-missing     the source table is there but SAFE_SCHEMA names a column
 *                      it does not have. Never benign and never self-healing:
 *                      the view is not created at all, so the prompt describes
 *                      a view that does not exist. This is not hypothetical —
 *                      safe_subscriptions declared a `plan` column the
 *                      subscriptions table has never had, and every boot since
 *                      logged it as "source missing", which pointed the reader
 *                      at a table that was present the whole time.
 *
 *   definition-refused Postgres 42P16 — CREATE OR REPLACE VIEW may only ADD
 *                      columns at the END of the list. Someone inserted or
 *                      reordered one in SAFE_SCHEMA. This is the dangerous one:
 *                      the PREVIOUS view definition survives untouched, so the
 *                      database silently keeps the old column set while
 *                      describeSchemaForPrompt() hands the analytics model a
 *                      schema listing a column that does not exist. Every query
 *                      the model then writes against it fails at runtime, and
 *                      the log says the source table is missing. It is not.
 *
 * Exported so the behaviour is unit-testable without provoking a real failure.
 */
export type SafeViewErrorKind =
  | "source-missing"
  | "column-missing"
  | "definition-refused"
  | "unknown";

export function classifySafeViewError(err: unknown): SafeViewErrorKind {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "42P01") return "source-missing"; // undefined_table
  if (code === "42703") return "column-missing"; // undefined_column
  if (code === "42P16") return "definition-refused"; // invalid_object_definition
  return "unknown";
}

/**
 * What each failure means, written for whoever finds it in a boot log at 2am
 * with no context. Every one of these ends with the edit that fixes it.
 */
const SAFE_VIEW_FAILURE_MESSAGE: Record<SafeViewErrorKind, string> = {
  "source-missing": "safe view NOT created (source table missing)",
  "column-missing":
    "safe view NOT created — SAFE_SCHEMA names a column the source table does not have. The view does not exist at all, so describeSchemaForPrompt() is advertising a view the analytics model cannot query. Fix the column list in safeSql.ts to match the table.",
  "definition-refused":
    "safe view NOT replaced — CREATE OR REPLACE VIEW only accepts new columns appended at the END of the column list. The previous definition is still live and no longer matches SAFE_SCHEMA, so the analytics prompt is describing columns the database does not have. Move the new column to the end, or drop the view and let it be recreated.",
  unknown: "safe view NOT replaced",
};

/**
 * Compare each safe view's real column list against SAFE_SCHEMA and return the
 * views that disagree. The allowlist is only a safety boundary while the two
 * match: if they drift, `describeSchemaForPrompt` is describing a schema that
 * is not there. Views whose source table has not been migrated in yet are
 * reported as `actual: []` rather than being hidden, because "absent" and
 * "wrong shape" both mean the prompt is wrong.
 */
export async function findSafeViewDrift(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
): Promise<Array<{ view: string; expected: string[]; actual: string[] }>> {
  const names = SAFE_SCHEMA.map((t) => t.name);
  const res = await client.query(
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public' and table_name = any($1)
      order by table_name, ordinal_position`,
    [names],
  );
  const actualByView = new Map<string, string[]>();
  for (const row of res.rows) {
    const view = String(row.table_name);
    const list = actualByView.get(view) ?? [];
    list.push(String(row.column_name));
    actualByView.set(view, list);
  }
  const drift: Array<{ view: string; expected: string[]; actual: string[] }> = [];
  for (const t of SAFE_SCHEMA) {
    const expected = t.columns.map((c) => c.name);
    const actual = actualByView.get(t.name) ?? [];
    // Order matters as much as membership: it is the ordering rule that
    // CREATE OR REPLACE enforces, so an out-of-order match is a latent failure
    // on the next edit, not a cosmetic difference.
    if (expected.length !== actual.length || expected.some((c, i) => c !== actual[i])) {
      drift.push({ view: t.name, expected, actual });
    }
  }
  return drift;
}

export async function ensureSafeViews(): Promise<void> {
  // Idempotent: run on startup. Each view selects only the explicitly listed
  // columns from its source table. CREATE OR REPLACE means we can edit the
  // SAFE_SCHEMA above and a server restart updates the views.
  const client = await pool.connect();
  try {
    // Create the locked-down reader role and make the application user a
    // member so SET LOCAL ROLE will succeed inside runSafeSql.
    try {
      await client.query(
        `do $$ begin
           if not exists (select 1 from pg_roles where rolname = '${SAFE_ROLE}') then
             create role ${SAFE_ROLE} nologin nosuperuser noinherit nocreatedb nocreaterole;
           end if;
         end $$;`,
      );
      await client.query(
        `do $$ begin
           execute 'grant ${SAFE_ROLE} to ' || quote_ident(current_user);
         exception when others then null;
         end $$;`,
      );
      // Strip any incidental privileges that might exist on base tables
      // for this role (defensive — should be a no-op on a fresh role).
      await client.query(`revoke all on all tables in schema public from ${SAFE_ROLE}`);
      await client.query(`revoke all on schema public from ${SAFE_ROLE}`);
      await client.query(`grant usage on schema public to ${SAFE_ROLE}`);
    } catch (err) {
      logger.warn({ err }, "safe role bootstrap failed (continuing without role boundary)");
    }
    for (const t of SAFE_SCHEMA) {
      const cols = t.columns.map((c) => `"${c.name}"`).join(", ");
      const ddl = `create or replace view ${t.name} as select ${cols} from ${t.source}`;
      try {
        await client.query(ddl);
        await client.query(`grant select on ${t.name} to ${SAFE_ROLE}`);
      } catch (err) {
        const kind = classifySafeViewError(err);
        if (kind === "source-missing") {
          // Benign: the base table has not been migrated in yet. Log and
          // continue so the rest of the pack still works.
          logger.warn({ err, view: t.name }, "skipping safe view (source table missing)");
        } else {
          logger.error({ err, view: t.name, kind }, SAFE_VIEW_FAILURE_MESSAGE[kind]);
        }
      }
    }

    // Whatever happened above, state plainly whether the views now match what
    // describeSchemaForPrompt() will tell the model. A replace that was refused
    // leaves the OLD view in place and no exception anywhere downstream, so
    // without this check the drift is invisible until a generated query errors.
    try {
      const drift = await findSafeViewDrift(client);
      if (drift.length > 0) {
        logger.error(
          { drift },
          "safe views do not match SAFE_SCHEMA — the analytics schema prompt is describing columns that are not there",
        );
      }
    } catch (err) {
      logger.warn({ err }, "safe view drift check failed");
    }
  } finally {
    client.release();
  }
}

export async function runSafeSql(sqlIn: string): Promise<SafeSqlResult> {
  const sql = validateSafeSql(sqlIn);
  const client = await pool.connect();
  const start = Date.now();
  try {
    // Explicit read-only transaction guarantees no DML can succeed even if
    // the validator missed something. statement_timeout is set inside the
    // same transaction so it applies to the wrapped query.
    await client.query("begin read only");
    try {
      await client.query(`set local statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
      // Privilege boundary (MANDATORY, fail-closed): switch to the safe
      // reader role for this transaction. The role only has SELECT on
      // safe_* views, so any attempt to reference a base table — even via
      // a payload the regex validator missed — will fail with a permission
      // error. If we can't enter the safe role we refuse to execute at
      // all, rather than silently falling back to validator-only.
      try {
        await client.query(`set local role ${SAFE_ROLE}`);
      } catch (err) {
        logger.error({ err }, "set local role failed; refusing to execute analytics SQL");
        throw new UnsafeSqlError("safe role boundary unavailable; refusing to execute");
      }
      const wrapped = `select * from (${sql}) as _safe limit ${MAX_ROWS + 1}`;
      const result = await client.query(wrapped);
      const truncated = result.rows.length > MAX_ROWS;
      const rows = (truncated ? result.rows.slice(0, MAX_ROWS) : result.rows) as Record<string, unknown>[];
      return {
        rows,
        rowCount: rows.length,
        truncated,
        durationMs: Date.now() - start,
      };
    } finally {
      // Read-only transaction: rollback is the cheapest way to end it.
      await client.query("rollback").catch(() => undefined);
    }
  } finally {
    client.release();
  }
}

export function describeSchemaForPrompt(): string {
  return SAFE_SCHEMA.map((t) => {
    const cols = t.columns
      .map((c) => `  - ${c.name} (${c.type})${c.description ? ` — ${c.description}` : ""}`)
      .join("\n");
    return `View ${t.name} — ${t.description}\n${cols}`;
  }).join("\n\n");
}
