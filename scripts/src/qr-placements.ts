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
 *   pnpm run qr-placements -- --qr box --distance 4            # printable SVG + PNG
 *   pnpm run qr-placements -- --retire gym12
 *
 * `--qr` writes the artwork. It encodes the all-uppercase URL
 * (HTTPS://TANMATRA.FOOD/Q/BOX) because uppercase is what QR alphanumeric mode
 * can pack — measurably a smaller symbol (25×25 vs 29×29 for this URL shape),
 * so it scans from farther away. The `/q/` route folds the case server-side.
 * See lib/qrPrint.ts, whose test asserts the mode so a tidy-up to lowercase
 * fails the build rather than quietly shrinking every future print run.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import QRCode from "qrcode";
import { db, qrPlacementsTable, qrScansTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  printedFallbackText,
  printedScanUrl,
  printWidthCm,
  SCAN_ORIGIN,
} from "./lib/qrPrint";

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

/**
 * Write the printable artwork for a code.
 *
 * SVG is the deliverable — it is vector, so the same file is a 3 cm box sticker
 * and a 40 cm standee with no resampling. The PNG is a convenience for slide
 * decks and WhatsApp, where an SVG often will not render.
 *
 * Error correction M (~15%) by default: enough to survive the scuffing a
 * delivery box takes, without inflating the symbol the way H (~30%) does. Raise
 * it with --ecc H only when something overlays the code, such as a logo.
 *
 * The 4-module quiet zone is REQUIRED by the QR spec, not decoration — a code
 * butted against dark artwork with no margin fails to scan, and it is the most
 * common way a print run is wasted. `margin` is left at the library default of
 * 4 deliberately; do not trim it to save space.
 */
async function writeArtwork(rawCode: string): Promise<void> {
  const code = normalizeCode(rawCode);
  if (!code) {
    console.error(`Invalid code "${rawCode}".`);
    process.exit(1);
  }
  // Best-effort, and NOT required to succeed. Making artwork is a design-desk
  // task; needing production database credentials to draw a square would push
  // people to a random online QR generator instead, which is how a code with a
  // typo'd or lowercase URL ends up on 5,000 printed boxes.
  let placement: { active: boolean } | undefined;
  try {
    [placement] = await db
      .select({ active: qrPlacementsTable.active })
      .from(qrPlacementsTable)
      .where(eq(qrPlacementsTable.code, code))
      .limit(1);
  } catch {
    console.warn("! No database reachable — drawing the code without checking it is registered.");
  }
  if (!placement) {
    // Not fatal: artwork is often produced before the row exists, and the
    // printed code would still resolve (to the generic landing) if it never
    // did. Warn loudly rather than refuse, so a real print run is never
    // blocked on ordering.
    console.warn(`! No placement registered for "${code}" — scans will land on the generic page.`);
    console.warn(`  Register it first: --add ${code} --label "..."`);
  } else if (!placement.active) {
    console.warn(`! "${code}" is RETIRED. Re-add it before printing, or its scans go to the generic page.`);
  }

  const url = printedScanUrl(code, arg("--origin") ?? SCAN_ORIGIN);
  const ecc = (arg("--ecc") ?? "M").toUpperCase();
  if (!["L", "M", "Q", "H"].includes(ecc)) {
    console.error(`Invalid --ecc "${ecc}" — use L, M, Q or H.`);
    process.exit(1);
  }
  const outDir = arg("--out") ?? "qr";
  fs.mkdirSync(outDir, { recursive: true });

  const opts = { errorCorrectionLevel: ecc as "L" | "M" | "Q" | "H" } as const;
  const symbol = await QRCode.create(url, opts);
  const svg = await QRCode.toString(url, { ...opts, type: "svg" });
  const svgPath = path.join(outDir, `${code}.svg`);
  fs.writeFileSync(svgPath, svg);
  const pngPath = path.join(outDir, `${code}.png`);
  await QRCode.toFile(pngPath, url, { ...opts, width: 1024 });

  const distance = Number(arg("--distance") ?? 4);
  console.log(`✓ ${svgPath}`);
  console.log(`✓ ${pngPath}`);
  console.log(`  encodes: ${url}`);
  console.log(
    `  symbol:  version ${symbol.version}, ${symbol.modules.size}×${symbol.modules.size} modules, ` +
      `${symbol.segments.map((s) => s.mode.id).join("+")} mode, ECC ${ecc}`,
  );
  if (Number.isFinite(distance) && distance > 0) {
    // Field rule of thumb: a symbol scans from roughly 10× its own width.
    console.log(`  print at ≥ ${printWidthCm(distance)} cm wide to scan from ${distance} m.`);
  }
  console.log(`  print "${printedFallbackText()}" as TEXT under the code — trust cue, and the fallback if the scan fails.`);
  console.log("  keep the white quiet zone around the symbol; trimming it is the usual way a print run fails.");
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
  const toDraw = arg("--qr");
  if (toAdd) await add(toAdd);
  else if (toRetire) await retire(toRetire);
  else if (toDraw) await writeArtwork(toDraw);
  else await list();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
