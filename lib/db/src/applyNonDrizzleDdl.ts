/**
 * The schema objects Drizzle cannot model, for callers inside the TypeScript
 * world — chiefly tests, which need the same guarantees production has.
 *
 * The SQL lives in `lib/db/ddl/*.sql`, read at call time rather than embedded
 * as a string constant, so there is exactly one text of each object shared by:
 *
 *   • `pnpm --filter @workspace/db run push` (via scripts/apply-non-drizzle-ddl.mjs)
 *   • tests, via this function
 *
 * Migration `0031` carries its own copy on purpose: a shipped migration must
 * never change, so it cannot read a file that might.
 *
 * Everything here must be idempotent — it runs on every push.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DDL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ddl");

/** The `.sql` files defining non-Drizzle objects, in application order. */
export function nonDrizzleDdlFiles(): string[] {
  return readdirSync(DDL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** The text of one DDL file. Exported so a test can assert the SQL and the
 *  TypeScript constants it mirrors have not drifted apart. */
export function nonDrizzleDdlSource(file: string): string {
  return readFileSync(join(DDL_DIR, file), "utf8");
}

/** Install every non-Drizzle object using any executor taking raw SQL — the
 *  app pool, a transaction, or a test's own handle. */
export async function applyNonDrizzleDdl(
  execute: (sql: string) => Promise<unknown>,
): Promise<string[]> {
  const applied: string[] = [];
  for (const file of nonDrizzleDdlFiles()) {
    await execute(nonDrizzleDdlSource(file));
    applied.push(file);
  }
  return applied;
}
