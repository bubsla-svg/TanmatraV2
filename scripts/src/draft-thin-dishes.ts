/**
 * Draft dishes that fall below the customer data floor — plan-then-apply.
 *
 * A dish with no ingredient list sits inside an allergen filter and a
 * Diabetic Safe filter answering "what is in this?" with nothing, so a
 * customer excluding peanuts is shown it as though it had passed. This script
 * moves such rows to `allergen_review_state = 'pending_review'`: hidden from
 * `/menu/public` and `/menu/ranked`, still fully visible to staff and RD admin
 * routes, and back on the menu the moment an RD flips the state. See
 * `lib/dishDataFloorPlan.ts` for the floor and why it is absence-only.
 *
 * SAFETY MODEL (menu-catalog-v2-apply.ts's, deliberately):
 *   1. Plan-only by default; `--apply` is explicit and refuses while any
 *      blocker stands.
 *   2. Apply runs in ONE transaction and snapshots every touched row to a
 *      backup JSON first, so a bad run is one `psql` restore away.
 *   3. It writes exactly one column plus `unavailable_reason` — never
 *      `archived`, never the price, never the name. Drafting is reversible by
 *      construction; archiving is a curation verdict this script has no
 *      standing to make.
 *   4. After applying it re-reads and asserts convergence: no reviewed row may
 *      still be below the floor. An apply that does not converge exits
 *      non-zero rather than reporting success.
 *
 * `allergen_review_state` is outside the POS push-menu allowlist
 * (petpooja.menuFence.test.ts's POS_WRITABLE), so a Petpooja re-sync cannot
 * silently republish a drafted dish. That is the whole reason this uses the
 * review state rather than `is_available`, which the POS stock signal owns.
 *
 * Usage (from repo root, DATABASE_URL required except with --offline):
 *   pnpm --filter @workspace/scripts run draft-thin-dishes                 # plan
 *   pnpm --filter @workspace/scripts run draft-thin-dishes -- --md plan.md
 *   pnpm --filter @workspace/scripts run draft-thin-dishes -- --apply
 *   pnpm --filter @workspace/scripts run draft-thin-dishes -- --offline --from rows.json
 */
import fs from "node:fs";
import { eq, inArray } from "drizzle-orm";
import {
  buildPlan,
  renderPlanMarkdown,
  verifyPostState,
  type DbDishRow,
  type Plan,
} from "./lib/dishDataFloorPlan";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const OFFLINE = args.includes("--offline");
const mdOut = argValue("--md");
const jsonOut = argValue("--json");
const fromJson = argValue("--from");
const backupOut = argValue("--backup");

function argValue(flag: string): string | null {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? (args[i + 1] as string) : null;
}

if (APPLY && OFFLINE) {
  console.error("--apply needs the database; it cannot be combined with --offline.");
  process.exit(1);
}

/**
 * `@workspace/db` throws at import time without DATABASE_URL — correct for a
 * writer, but `--offline` exists so the plan can be reviewed from a JSON dump
 * on a machine with no production access. Hence the dynamic import.
 */
async function loadDb() {
  const mod = await import("@workspace/db");
  return { db: mod.db, menuItemsTable: mod.menuItemsTable };
}

/** The full row is kept for the backup; the plan only ever reads the subset. */
function toPlanRow(r: {
  slug: string;
  name: string;
  allergenReviewState: string;
  archived: boolean;
  ingredients: unknown;
}): DbDishRow {
  return {
    slug: r.slug,
    name: r.name,
    reviewState: r.allergenReviewState,
    archived: r.archived,
    // jsonb: anything that is not an array of strings is treated as no data,
    // which is the fail-safe direction — a malformed list cannot be filtered
    // on either.
    ingredients: Array.isArray(r.ingredients)
      ? (r.ingredients.filter((x) => typeof x === "string") as string[])
      : null,
  };
}

async function fetchRows(): Promise<{ planRows: DbDishRow[]; raw: Map<string, unknown> }> {
  if (OFFLINE) {
    if (!fromJson) {
      console.error("--offline needs --from <rows.json> (a dump of menu_items).");
      process.exit(1);
    }
    const parsed = JSON.parse(fs.readFileSync(fromJson, "utf8")) as Array<
      Parameters<typeof toPlanRow>[0]
    >;
    return {
      planRows: parsed.map(toPlanRow),
      raw: new Map(parsed.map((r) => [r.slug, r as unknown])),
    };
  }
  const { db, menuItemsTable } = await loadDb();
  const rows = await db.select().from(menuItemsTable);
  return {
    planRows: rows.map(toPlanRow),
    raw: new Map(rows.map((r) => [r.slug, r as unknown])),
  };
}

function report(plan: Plan): void {
  console.log(`rows ${plan.counts["rows"]} · draft ${plan.counts["draft"]} · passing ${plan.counts["passing"]} · already drafted ${plan.counts["alreadyDrafted"]} · archived ${plan.counts["archived"]}`);
  // Per-floor counts come from the plan's own keys, so this line cannot drift
  // out of step with the FLOORS table the way a hand-written one did.
  const perFloor = Object.entries(plan.counts)
    .filter(([k]) => k === k.toUpperCase())
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  if (perFloor) console.log(`  below floor: ${perFloor}`);
  for (const b of plan.blockers) console.error(`BLOCKER  ${b}`);
  for (const a of plan.actions) {
    console.log(`  draft  ${a.slug.padEnd(44)} ${a.failures.join(",")}  ${a.name}`);
  }
}

async function applyPlan(plan: Plan, raw: Map<string, unknown>): Promise<void> {
  const { db, menuItemsTable } = await loadDb();

  const touched = plan.actions.map((a) => a.slug);
  const backupPath = backupOut ?? `draft-thin-dishes-backup-${Date.now()}.json`;
  const backup = touched.map((s) => raw.get(s)).filter(Boolean);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`backup of ${backup.length} touched rows → ${backupPath}`);

  await db.transaction(async (tx) => {
    for (const action of plan.actions) {
      // `rd_note`, NOT `unavailable_reason`. The reason belongs on the same
      // axis as the column being written: `unavailable_reason` pairs with
      // `is_available`, which this script deliberately does not touch (it is
      // the POS stock signal), so writing a reason there would describe a
      // state the row is not in. `rd_note` pairs with
      // `allergen_review_state` and is equally outside the POS allowlist.
      const existing = raw.get(action.slug) as { rdNote?: string | null } | undefined;
      const set: Record<string, unknown> = {
        allergenReviewState: "pending_review",
        updatedAt: new Date(),
      };
      // Never clobber a human-written RD note — that is content someone
      // authored about this dish's safety review, and the plan artifact plus
      // the backup carry our reason either way.
      if (!existing?.rdNote) set["rdNote"] = action.note;
      await tx.update(menuItemsTable).set(set).where(eq(menuItemsTable.slug, action.slug));
    }
  });
  console.log(`applied: ${plan.actions.length} dishes drafted.`);

  // Convergence. Re-read only the touched rows plus everything still reviewed,
  // because the assertion is about the whole menu, not just what we wrote.
  const { planRows } = await fetchRows();
  const stillBelow = verifyPostState(planRows);
  if (stillBelow.length > 0) {
    console.error(
      `CONVERGENCE FAILED — ${stillBelow.length} reviewed rows are still below the floor:`,
    );
    for (const s of stillBelow) console.error(`  ${s}`);
    process.exit(1);
  }
  console.log("convergence: clean — no reviewed dish is below the floor.");

  // Cheap sanity check that the write landed on exactly the rows planned.
  if (touched.length > 0) {
    const after = await db
      .select({ slug: menuItemsTable.slug, state: menuItemsTable.allergenReviewState })
      .from(menuItemsTable)
      .where(inArray(menuItemsTable.slug, touched));
    const wrong = after.filter((r) => r.state !== "pending_review");
    if (wrong.length > 0) {
      console.error(`write did not take on ${wrong.length} rows: ${wrong.map((r) => r.slug).join(", ")}`);
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  const { planRows, raw } = await fetchRows();
  const plan = buildPlan(planRows);

  report(plan);
  if (mdOut) {
    fs.writeFileSync(mdOut, renderPlanMarkdown(plan));
    console.log(`plan markdown → ${mdOut}`);
  }
  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(plan, null, 2));
    console.log(`plan json → ${jsonOut}`);
  }

  if (plan.blockers.length > 0) {
    console.error(`\n${plan.blockers.length} blocker(s) — refusing to apply.`);
    process.exit(1);
  }

  if (!APPLY) {
    console.log("\nplan only. Re-run with --apply to write.");
    return;
  }
  if (plan.actions.length === 0) {
    console.log("\nnothing to apply.");
    return;
  }
  await applyPlan(plan, raw);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
