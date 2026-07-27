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
 *     and was migrated by hand. A database with public.orders but no
 *     tracking rows is hand-migrated — but that alone proves nothing about
 *     HOW FAR. The baseline therefore also requires currency probes
 *     (artefacts of the chain tip at the time this runner shipped: 0020's
 *     constraint, 0021's table, 0022's column). Probes pass → record all
 *     journal entries in one transaction, execute nothing. Probes fail →
 *     REFUSE (exit 1) and demand either hand-application of the tail or an
 *     explicit MIGRATE_BASELINE_THROUGH=<tag>, which records only up to
 *     <tag> and lets this same run apply the rest. A fresh empty database
 *     (no orders table) skips the baseline and applies the full chain.
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
    //
    // "public.orders exists" only proves the database was hand-migrated AT
    // SOME POINT (orders is created in 0000). Baselining on that alone would
    // silently mark an unapplied tail (e.g. a prod stuck at 0019) as applied
    // — green deploy, three broken features, unrecoverable once the tracking
    // rows exist. So the baseline additionally requires CURRENCY PROBES: one
    // distinctive artefact from each of the newest migrations at the time
    // this runner was introduced (the chain tip was 0022). The probes are
    // deliberately FROZEN — they only guard the one-time first run; once any
    // tracking rows exist this branch is never taken again, so they must
    // never be "updated" for later migrations.
    //
    // If the schema is present but a probe fails, the runner REFUSES to
    // guess and exits 1. A human then either hand-applies the missing tail
    // (per docs/runbook-prod-migration-baseline.md) or sets
    // MIGRATE_BASELINE_THROUGH=<tag> to record only the migrations up to and
    // including <tag> as applied — after which this same run applies the
    // rest normally.
    if (applied.size === 0) {
      const handMigrated = (await client.query("SELECT to_regclass('public.orders') AS t")).rows[0]?.t;
      if (handMigrated) {
        const throughTag = process.env.MIGRATE_BASELINE_THROUGH;
        let baselineEntries: JournalEntry[] | null = null;

        if (throughTag) {
          const at = entries.findIndex((e) => e.tag === throughTag);
          if (at === -1) throw new Error(`MIGRATE_BASELINE_THROUGH=${throughTag} is not a journal tag.`);
          baselineEntries = entries.slice(0, at + 1);
          console.log(`BASELINE (explicit): recording ${baselineEntries.length} entries through ${throughTag}; the rest apply below.`);
        } else {
          const probes: Array<[string, string]> = [
            ["orders_status_chk constraint (0020)",
              "SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_chk'"],
            ["serviceability_interest table (0021)",
              "SELECT 1 WHERE to_regclass('public.serviceability_interest') IS NOT NULL"],
            ["corporate_leads.rd_reg_no column (0022)",
              "SELECT 1 FROM information_schema.columns WHERE table_name='corporate_leads' AND column_name='rd_reg_no'"],
          ];
          const missing: string[] = [];
          for (const [label, sqlText] of probes) {
            const r = await client.query(sqlText);
            if (r.rowCount === 0) missing.push(label);
          }
          if (missing.length > 0) {
            throw new Error(
              `REFUSING TO BASELINE: schema present but NOT current.\n` +
              `Missing: ${missing.join("; ")}.\n` +
              `This database was hand-migrated part-way; blind baselining would mark the ` +
              `unapplied tail as applied and never revisit it.\n` +
              `Either hand-apply the missing migrations and re-run, or set ` +
              `MIGRATE_BASELINE_THROUGH=<last hand-applied tag> so this runner applies the rest.`,
            );
          }
          baselineEntries = entries;
          console.log(
            `BASELINE: schema present and currency probes pass — recording all ` +
            `${entries.length} journal entries as applied, executing nothing.`,
          );
        }

        if (!DRY_RUN) {
          // One transaction: a crash mid-loop must not leave partial tracking,
          // or the next run would EXECUTE the unrecorded tail against an
          // already-migrated database.
          await client.query("BEGIN");
          try {
            for (const e of baselineEntries) {
              await client.query(
                `INSERT INTO ${TRACKING_TABLE} (tag) VALUES ($1) ON CONFLICT DO NOTHING`,
                [e.tag],
              );
            }
            await client.query("COMMIT");
          } catch (err) {
            await client.query("ROLLBACK");
            throw err;
          }
          for (const e of baselineEntries) applied.add(e.tag);
        } else {
          console.log("(dry run — baseline not written)");
          for (const e of baselineEntries) applied.add(e.tag);
        }
        if (applied.size >= entries.length && !throughTag) {
          console.log(DRY_RUN ? "Would be up to date after baseline." : "Baseline recorded. Up to date.");
          return;
        }
      }
    }

    const pending = entries.filter((e) => !applied.has(e.tag));
    if (pending.length === 0) {
      console.log(`Up to date: all ${entries.length} migrations already applied.`);
      return;
    }

    console.log(`${pending.length} pending migration(s): ${pending.map((e) => e.tag).join(", ")}`);

    // Destructive scan happens BEFORE the dry-run early-return, so a dry run
    // reports exactly what the real run would refuse — not a green plan that
    // aborts mid-chain later. Comments are stripped first: this repo's
    // migrations carry long explanatory headers, and prose like "we do not
    // DROP TABLE here" must not abort the chain.
    for (const e of pending) {
      const { statements, raw } = statementsOf(e.tag);
      for (const stmt of statements) {
        const code = stmt.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
        if (DESTRUCTIVE.test(code) && !raw.includes(ALLOW_MARKER)) {
          throw new Error(
            `${e.tag} contains a destructive statement and no "${ALLOW_MARKER}" marker.\n` +
            `Statement: ${stmt.slice(0, 200)}\n` +
            `Data loss must be an explicit, reviewed decision — add the marker in the ` +
            `migration file itself if this is intended, and say why in the PR.`,
          );
        }
      }
    }
    if (DRY_RUN) {
      console.log("(dry run — nothing applied)");
      return;
    }

    for (const e of pending) {
      const { statements } = statementsOf(e.tag);
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
