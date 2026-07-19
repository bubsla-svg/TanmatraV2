import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";

// Distinct from ensureRectificationSchema.ts's ADVISORY_LOCK_KEY (918273645)
// — each boot-time DB-mutating step gets its own lock key so they can run
// concurrently with each other (they touch disjoint objects) while still
// serializing multiple instances doing the SAME step.
const MIGRATION_LOCK_KEY = 727_100_200;

// esbuild rewrites `import.meta.url` to the URL of the OUTPUT file when
// bundling (documented behavior, not dependent on the build's custom
// __dirname banner shim), so this resolves correctly across every context
// this code actually runs in:
//   dev        (tsx, unbundled): .../lib/db/src                       → ../drizzle
//   prod       (bundled dist/index.mjs, Docker runner): .../dist       → ./drizzle
//     (see Dockerfile: migrations are copied to dist/drizzle alongside the bundle)
//   CI/bundled-but-uncopied (bundled dist/index.mjs run directly from a
//     full monorepo checkout, e.g. bulkhead-ci.yml's `pnpm run start` —
//     no Docker COPY step puts migrations next to the bundle): .../dist
//     → ../../../lib/db/drizzle (dist → api-server → artifacts → repo root)
const here = path.dirname(fileURLToPath(import.meta.url));

function resolveMigrationsFolder(): string {
  const override = process.env["DRIZZLE_MIGRATIONS_DIR"];
  if (override) return override;
  const candidates = [
    path.join(here, "drizzle"), // prod (Docker runner)
    path.join(here, "..", "..", "..", "lib", "db", "drizzle"), // bundled, uncopied (CI)
    path.join(here, "..", "drizzle"), // dev (workspace source, unbundled)
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "meta", "_journal.json"))) return dir;
  }
  throw new Error(
    `Could not locate the Drizzle migrations folder (checked: ${candidates.join(", ")}). ` +
      "Set DRIZZLE_MIGRATIONS_DIR to override.",
  );
}

/**
 * Apply any pending Drizzle migrations (lib/db/drizzle/*.sql) to the
 * database. Forward-only — runs exactly the committed, reviewed migration
 * files in order; never drops or alters anything beyond what a migration
 * file explicitly does. Applied migrations are tracked in
 * drizzle.__drizzle_migrations, so this is a no-op once a migration has run.
 *
 * Serialized across concurrently-booting instances via a Postgres advisory
 * lock (same idiom as ensureRectificationSchema.ts) — a Cloud Run cold start
 * that spins up multiple instances of the same revision at once can never
 * race the same migration against each other. Run this BEFORE the HTTP
 * server binds its port, so an instance never serves traffic against a
 * schema older than what the deployed code expects.
 */
export async function migrateToLatest(): Promise<void> {
  const folder = resolveMigrationsFolder();
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
  }
}
