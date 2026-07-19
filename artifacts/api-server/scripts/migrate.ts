/**
 * CLI entry for applying pending Drizzle migrations — the same
 * `migrateToLatest()` the api-server runs at boot (src/index.ts), exposed
 * as a standalone script so CI (and operators) can provision/update a
 * database's schema without booting the full server.
 *
 * Run via: node --import tsx ./scripts/migrate.ts   (from artifacts/api-server)
 */
import { migrateToLatest } from "@workspace/db/migrate";

await migrateToLatest();
console.log("Migrations applied.");
