/**
 * Strip dietitian/RD credentials from customer-facing dish copy in Postgres —
 * plan-then-apply.
 *
 * PRs #129 and #130 removed every dietitian claim from the storefront's own
 * copy, the legal pages and the static fallback catalog. None of that reaches
 * `menu_items`: the dish copy a customer actually reads is a database row, so a
 * description saying "RD-formulated for high protein muscle recovery" keeps
 * rendering that claim on tanmatra.food regardless. Measured against
 * `/api/menu/public` on 2026-09-06, SIX of the 95 live dishes carry such a claim
 * in customer copy: one says "RD-formulated" in `description`, and five carry a
 * whole "RD Advisory Note: … - Signed by Dr. Vikram Sethi" paragraph in
 * `long_description`. The rest of the 163-row table is only visible with a
 * database, which is why this ships as a script rather than a one-line UPDATE.
 *
 * SAFETY MODEL (draft-thin-dishes.ts's, deliberately):
 *   1. Plan-only by default; `--apply` is explicit and REFUSES while any
 *      blocker stands — a claim the rewrite table cannot word is reported for
 *      a human, never guessed at.
 *   2. Apply runs in ONE transaction and snapshots every touched row to a
 *      backup JSON first, so a bad run is one restore away.
 *   3. It writes only the customer-facing copy columns it planned. Never the
 *      price, never `archived`, never `rd_note` — that last one carries the same
 *      signature on 46 rows and is REPORTED rather than edited, because
 *      rewriting a review record is a data decision, not a copy fix.
 *   4. After applying it re-reads and asserts convergence: no row may still
 *      carry the vocabulary. An apply that does not converge exits non-zero
 *      rather than reporting success.
 *
 * Usage (from repo root, DATABASE_URL required except with --offline):
 *   pnpm --filter @workspace/scripts run backfill-honest-claims                      # plan
 *   pnpm --filter @workspace/scripts run backfill-honest-claims -- --md plan.md
 *   pnpm --filter @workspace/scripts run backfill-honest-claims -- --apply
 *   pnpm --filter @workspace/scripts run backfill-honest-claims -- --offline --from rows.json
 */
import fs from "node:fs";
import { eq, inArray } from "drizzle-orm";
import {
  COPY_FIELDS,
  buildPlan,
  renderPlanMarkdown,
  verifyPostState,
  type DbCopyRow,
  type Plan,
} from "./lib/honestClaimsPlan";

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

function toPlanRow(r: Record<string, unknown>): DbCopyRow {
  const str = (k: string): string | null => (typeof r[k] === "string" ? (r[k] as string) : null);
  return {
    slug: String(r["slug"] ?? ""),
    archived: r["archived"] === true,
    name: str("name"),
    description: str("description"),
    longDescription: str("longDescription"),
    seoTitle: str("seoTitle"),
    seoDescription: str("seoDescription"),
    badge: str("badge"),
    // Read for the notice-only report; never written back.
    rdNote: str("rdNote"),
  };
}

async function fetchRows(): Promise<{ planRows: DbCopyRow[]; raw: Map<string, unknown> }> {
  if (OFFLINE) {
    if (!fromJson) {
      console.error("--offline needs --from <rows.json> (a dump of menu_items).");
      process.exit(1);
    }
    const parsed = JSON.parse(fs.readFileSync(fromJson, "utf8")) as Array<Record<string, unknown>>;
    return {
      planRows: parsed.map(toPlanRow),
      raw: new Map(parsed.map((r) => [String(r["slug"] ?? ""), r as unknown])),
    };
  }
  const { db, menuItemsTable } = await loadDb();
  const rows = await db.select().from(menuItemsTable);
  return {
    planRows: rows.map((r) => toPlanRow(r as unknown as Record<string, unknown>)),
    raw: new Map(rows.map((r) => [r.slug, r as unknown])),
  };
}

function report(plan: Plan): void {
  console.log(
    `rows ${plan.counts["rows"]} · carrying a claim ${plan.counts["rowsWithClaims"]} ` +
      `(archived ${plan.counts["archivedWithClaims"]}) · edits ${plan.counts["edits"]} · blocked ${plan.counts["blocked"]}`,
  );
  if (plan.noticeOnly.length > 0) {
    console.log(
      `  note: ${plan.noticeOnly.length} rd_note rows carry a claim. Served by /api/menu/public, ` +
        `rendered by no mounted component, NOT edited here — see the SCOPE note in lib/honestClaimsPlan.ts.`,
    );
  }
  for (const b of plan.blockers) console.error(`BLOCKER  ${b}`);
  for (const e of plan.edits) {
    console.log(`  edit   ${e.slug}.${e.field}`);
    console.log(`         - ${e.before}`);
    console.log(`         + ${e.after}`);
  }
}

async function applyPlan(plan: Plan, raw: Map<string, unknown>): Promise<void> {
  const { db, menuItemsTable } = await loadDb();

  const touched = [...new Set(plan.edits.map((e) => e.slug))];
  const backupPath = backupOut ?? `backfill-honest-claims-backup-${Date.now()}.json`;
  const backup = touched.map((s) => raw.get(s)).filter(Boolean);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`backup of ${backup.length} touched rows → ${backupPath}`);

  // One row can carry the claim in several columns; group so each row is a
  // single UPDATE carrying every field the plan decided for it.
  const bySlug = new Map<string, Record<string, unknown>>();
  for (const e of plan.edits) {
    const set = bySlug.get(e.slug) ?? { updatedAt: new Date() };
    set[e.field] = e.after;
    bySlug.set(e.slug, set);
  }

  await db.transaction(async (tx) => {
    for (const [slug, set] of bySlug) {
      await tx.update(menuItemsTable).set(set).where(eq(menuItemsTable.slug, slug));
    }
  });
  console.log(`applied: ${plan.edits.length} fields across ${bySlug.size} dishes.`);

  // Convergence. The assertion is about the whole table, not just what we
  // wrote — a row we skipped is as much a live claim as one we got wrong.
  const { planRows } = await fetchRows();
  const stillClaiming = verifyPostState(planRows);
  if (stillClaiming.length > 0) {
    console.error(`CONVERGENCE FAILED — ${stillClaiming.length} fields still carry a claim:`);
    for (const s of stillClaiming) console.error(`  ${s}`);
    process.exit(1);
  }
  console.log("convergence: clean — no dish copy carries a dietitian claim.");

  // Cheap sanity check that the write landed on exactly the rows planned.
  if (touched.length > 0) {
    const after = await db.select().from(menuItemsTable).where(inArray(menuItemsTable.slug, touched));
    const byslug = new Map(after.map((r) => [r.slug, r as unknown as Record<string, unknown>]));
    const wrong = plan.edits.filter((e) => byslug.get(e.slug)?.[e.field] !== e.after);
    if (wrong.length > 0) {
      console.error(
        `write did not take on ${wrong.length} fields: ${wrong.map((e) => `${e.slug}.${e.field}`).join(", ")}`,
      );
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  const { planRows, raw } = await fetchRows();
  const plan = buildPlan(planRows);

  console.log(`scanning ${COPY_FIELDS.length} customer-facing copy fields per row.`);
  report(plan);
  if (mdOut) {
    fs.writeFileSync(mdOut, renderPlanMarkdown(plan));
    console.log(`plan markdown → ${mdOut}`);
  }
  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(plan, null, 2));
    console.log(`plan json → ${jsonOut}`);
  }

  if (!APPLY) {
    console.log(plan.edits.length > 0 ? "plan only — re-run with --apply to write." : "nothing to do.");
    return;
  }
  if (plan.blockers.length > 0) {
    console.error(
      `refusing to apply: ${plan.blockers.length} claim(s) have no rewrite. Word them in ` +
        `REWRITES (scripts/src/lib/honestClaimsPlan.ts) and re-run.`,
    );
    process.exit(1);
  }
  if (plan.edits.length === 0) {
    console.log("nothing to apply.");
    return;
  }
  await applyPlan(plan, raw);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
