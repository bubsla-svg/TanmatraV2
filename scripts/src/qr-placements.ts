/**
 * Manage printed-code placements — the operator side of the QR funnel.
 *
 * A placement code is the ONE thing that gets printed, and print is the only
 * artefact in this product that cannot be redeployed. So the code is a lookup
 * key and the destination is a column: `/q/box` can be repointed at a new offer
 * next month without anyone peeling a sticker off a delivery box.
 *
 * The corollary is that a code is never DELETED, only retired. A deleted row
 * and a retired row resolve identically for the visitor (both land on the
 * generic landing — Law 10), but a retired row keeps its scan history, which is
 * the only way to tell "that poster stopped working" from "that poster was
 * never counted".
 *
 *   pnpm run qr-placements                                    # list
 *   pnpm run qr-placements -- --add box --label "Box sticker"
 *   pnpm run qr-placements -- --add gym12 --label "FitLife Sec-12" --to "/start?src=gym12"
 *   pnpm run qr-placements -- --retire gym12
 *
 * Print the all-uppercase URL (HTTPS://TANMATRA.FOOD/Q/BOX): uppercase fits QR
 * alphanumeric mode, which yields a lower-density symbol that scans smaller and
 * from farther away. The `/q/` route folds the case server-side.
 */
import { db, qrPlacementsTable, qrScansTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";

/** Must match the api-server's `normalizeQrCode` (routes/qr.ts) exactly — a
 *  code this script accepts but that route rejects is a poster that never
 *  resolves. */
function normalizeCode(raw: string): string | null {
  const code = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(code) ? code : null;
}

/** Must match the api-server's `isSafeDestination`. Same-origin absolute paths
 *  only; `//host` is a protocol-relative URL wearing a path. */
function isSafeDestination(dest: string): boolean {
  return /^\/(?![/\\])[\w\-./?=&%:+]*$/.test(dest);
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function list(): Promise<void> {
  const rows = await db
    .select({
      code: qrPlacementsTable.code,
      label: qrPlacementsTable.label,
      destination: qrPlacementsTable.destination,
      active: qrPlacementsTable.active,
      scans: sql<number>`(select count(*) from qr_scans s where s.code = ${qrPlacementsTable.code})`,
    })
    .from(qrPlacementsTable)
    .orderBy(desc(qrPlacementsTable.active), qrPlacementsTable.code);

  if (rows.length === 0) {
    console.log("No placements yet. Add one with --add <code> --label <label>.");
    return;
  }
  for (const r of rows) {
    const state = r.active ? "live   " : "retired";
    console.log(
      `${state}  ${r.code.padEnd(16)} ${String(r.scans).padStart(7)} scans  → ${r.destination}   (${r.label})`,
    );
    console.log(`         print: HTTPS://TANMATRA.FOOD/Q/${r.code.toUpperCase()}`);
  }
  const [orphans] = await db
    .select({ n: sql<number>`count(*)` })
    .from(qrScansTable)
    .where(eq(qrScansTable.known, false));
  if (Number(orphans?.n ?? 0) > 0) {
    // Worth surfacing: these are scans of a code no placement matches — a
    // misprint, or a poster whose code was never registered. They are real
    // people who scanned something and got the generic landing.
    console.log(`\n${orphans?.n} scan(s) hit a code with no placement. Check for a misprint.`);
  }
}

async function add(rawCode: string): Promise<void> {
  const code = normalizeCode(rawCode);
  if (!code) {
    console.error(`Invalid code "${rawCode}" — lowercase letters, digits, - and _ only, max 64.`);
    process.exit(1);
  }
  const label = arg("--label");
  if (!label) {
    console.error("--label is required: the scoreboard is unreadable without one.");
    process.exit(1);
  }
  const destination = arg("--to") ?? "/start";
  if (!isSafeDestination(destination)) {
    console.error(`Refusing "${destination}" — destinations must be same-origin absolute paths.`);
    process.exit(1);
  }
  await db
    .insert(qrPlacementsTable)
    .values({ code, label, destination, active: true })
    // Re-adding an existing code REPOINTS it (and un-retires it). That is the
    // whole purpose of the indirection, so it must not be an error.
    .onConflictDoUpdate({
      target: qrPlacementsTable.code,
      set: { label, destination, active: true, retiredAt: null },
    });
  console.log(`✓ ${code} → ${destination}`);
  console.log(`  print: HTTPS://TANMATRA.FOOD/Q/${code.toUpperCase()}`);
  console.log("  print tanmatra.food in text under the code — trust cue, and a fallback if the scan fails.");
}

async function retire(rawCode: string): Promise<void> {
  const code = normalizeCode(rawCode);
  if (!code) {
    console.error(`Invalid code "${rawCode}".`);
    process.exit(1);
  }
  const updated = await db
    .update(qrPlacementsTable)
    .set({ active: false, retiredAt: new Date() })
    .where(and(eq(qrPlacementsTable.code, code), eq(qrPlacementsTable.active, true)))
    .returning({ code: qrPlacementsTable.code });
  if (updated.length === 0) {
    console.log(`${code} is already retired, or was never registered.`);
    return;
  }
  console.log(`✓ ${code} retired. Posters still in the wild now land on the generic page, never a 404.`);
}

async function main(): Promise<void> {
  const toAdd = arg("--add");
  const toRetire = arg("--retire");
  if (toAdd) await add(toAdd);
  else if (toRetire) await retire(toRetire);
  else await list();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
