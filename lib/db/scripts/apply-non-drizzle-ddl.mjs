/**
 * Apply every `.sql` in `lib/db/ddl/` — the schema objects Drizzle cannot model.
 *
 * `drizzle-kit push` builds a database from the TypeScript schema, which covers
 * tables, columns and indexes and nothing else. Triggers are invisible to it, so
 * the two ways this repository builds a database disagree:
 *
 *   • deployments run the migration chain, which DOES install them;
 *   • CI builds its test database with `push-force`, which does NOT.
 *
 * A constraint that exists in production but not in CI is one CI can never tell
 * you that you broke, so `push`/`push-force` run this immediately afterwards.
 *
 * Plain `.mjs` on purpose: it runs under bare `node`, with no TypeScript loader
 * and no import of the workspace's TS sources, so it cannot be broken by
 * module-resolution settings that differ between tsc, tsx and node.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const DDL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ddl");

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("apply-non-drizzle-ddl: DATABASE_URL must be set");
  process.exit(1);
}

// Name order, so a future object that depends on an earlier one can say so with
// its filename rather than with a comment nobody reads.
const files = readdirSync(DDL_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  for (const file of files) {
    await client.query(readFileSync(join(DDL_DIR, file), "utf8"));
    console.log(`  ✓ ${file}`);
  }
  console.log(`Applied ${files.length} non-Drizzle DDL file(s).`);
} finally {
  await client.end();
}
