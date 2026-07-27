/**
 * Apply the committed Drizzle migrations to the database at DATABASE_URL —
 * the missing "migrate" step that kept the api-server deploy human-gated.
 *
 * WHY THIS EXISTS
 * ---------------
 * lib/db has exactly two scripts, push and push-force, and both are
 * drizzle-kit SCHEMA DIFFING — they compute whatever statements close the gap
 * between code and database, including drops, and they do not replay the
 * committed .sql files. Production has always been migrated by hand-running
 * those files (0000..0022 so far), which is why merging an api-server change
 * could not auto-deploy: code that reads a column its migration creates
 * would land before the column exists.
 *
 * This runner replays the committed files, in journal order, exactly as
 * written, and records what it applied. It never diffs, never generates,
 * never drops anything the files themselves do not contain.
 *
 * WHAT IT DOES
 * ------------
 *  1. Reads lib/db/drizzle/meta/_journal.json for the canonical order.
 *  2. Ensures a tracking table `ci_applied_migrations` (tag PK, applied_at).
 *  3. BASELINE CASE — the one subtle branch: production predates this runner
 *     and was migrated by hand, so it has the full schema and no tracking
 *     table. If the tracking table is empty AND public.orders exists, every
 *     journal entry is recorded as applied WITHOUT executing anything, and
 *     the run stops there. A fresh empty database (no orders table) skips
 *     the baseline and applies the full chain. The heuristic is deliberate:
 *     orders is the oldest, most load-bearing table in the system — a
 *     database that has it but no tracking rows can only be a hand-migrated
 *     one.
 *  4. Applies each missing migration: file split on drizzle's
 *     `--> statement-breakpoint`, all statements in ONE transaction, then the
 *     tracking row in the same transaction — a failed migration leaves no
 *     partial state and no false "applied" record.
 *
 * SAFETY RAILS
 * ------------
 *  - Destructive statements (DROP TABLE/COLUMN, TRUNCATE, DELETE FROM) abort
 *    the run unless the migration file itself carries the marker comment
 *    `-- ci:allow-destructive` — making data loss a reviewed, in-diff
 *    decision rather than something CI does because a file said so.
 *  - --dry-run prints the plan (baseline / apply list / up-to-date) and
 *    exits 0 without touching anything. CI runs this first so the log shows
 *    intent before action.
 *  - Every statement runs with a 60s statement_timeout: a migration that
 *    would sit on a lock forever fails loudly instead of hanging the deploy.
 *    (0020's NOT VALID design keeps the known-long operations short; see the
 *    comments in that file.)
 *
 * Run:  DATABASE_URL=... pnpm --filter @workspace/scripts run apply-migrations [--dry-run]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const DRIZZLE_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../lib/db/drizzle",
);
const TRACKING_TABLE = "ci_applied_migrations";
const DRY_RUN = process.argv.includes("--dry-run");
const DESTRUCTIVE = /\b(DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/i;
const ALLOW_MARKER = "-- ci:allow-destructive";

interface JournalEntry { idx: number; tag: string }

function journal(): JournalEntry[] {
  const j = JSON.parse(readFileSync(path.join(DRIZZLE_DIR, "meta/_journal.json"), "utf8"));
  return [...j.entries].sort((a: JournalEntry, b: JournalEntry) => a.idx - b.idx);
}

function statementsOf(tag: string): { statements: string[]; raw: string } {
  const raw = readFileSync(path.join(DRIZZLE_DIR, `${tag}.sql`), "utf8");
  const statements = raw
    .split(/-->\s*statement-breakpoint/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { statements, raw };
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — refusing to guess a target.");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("SET statement_timeout = '60s'");
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
         tag text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    const entries = journal();
    const appliedRows = await client.query(`SELECT tag FROM ${TRACKING_TABLE}`);
    const applied = new Set(appliedRows.rows.map((r: { tag: string }) => r.tag));

    // Baseline: hand-migrated database, first run of this runner.
    if (applied.size === 0) {
      const probe = await client.query("SELECT to_regclass('public.orders') AS t");
      if (probe.rows[0]?.t) {
        console.log(
          `BASELINE: schema present (public.orders exists) but no tracking rows — ` +
          `recording all ${entries.length} journal entries as already applied, executing nothing.`,
        );
        if (!DRY_RUN) {
          for (const e of entries) {
            await client.query(
              `INSERT INTO ${TRACKING_TABLE} (tag) VALUES ($1) ON CONFLICT DO NOTHING`,
              [e.tag],
            );
          }
        }
        console.log(DRY_RUN ? "(dry run — nothing written)" : "Baseline recorded. Up to date.");
        return;
      }
    }

    const pending = entries.filter((e) => !applied.has(e.tag));
    if (pending.length === 0) {
      console.log(`Up to date: all ${entries.length} migrations already applied.`);
      return;
    }

    console.log(`${pending.length} pending migration(s): ${pending.map((e) => e.tag).join(", ")}`);
    if (DRY_RUN) {
      console.log("(dry run — nothing applied)");
      return;
    }

    for (const e of pending) {
      const { statements, raw } = statementsOf(e.tag);
      for (const stmt of statements) {
        if (DESTRUCTIVE.test(stmt) && !raw.includes(ALLOW_MARKER)) {
          throw new Error(
            `${e.tag} contains a destructive statement and no "${ALLOW_MARKER}" marker.\n` +
            `Statement: ${stmt.slice(0, 200)}\n` +
            `Data loss must be an explicit, reviewed decision — add the marker in the ` +
            `migration file itself if this is intended, and say why in the PR.`,
          );
        }
      }
      console.log(`Applying ${e.tag} (${statements.length} statement(s))…`);
      await client.query("BEGIN");
      try {
        for (const stmt of statements) await client.query(stmt);
        await client.query(`INSERT INTO ${TRACKING_TABLE} (tag) VALUES ($1)`, [e.tag]);
        await client.query("COMMIT");
        console.log(`  ✓ ${e.tag}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`${e.tag} FAILED and was rolled back: ${(err as Error).message}`);
      }
    }
    console.log(`Done: ${pending.length} migration(s) applied.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("apply-migrations failed:", (err as Error).message);
  process.exit(1);
});
