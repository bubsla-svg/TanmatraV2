/**
 * TNM-MENU-01 M-3 — Menu v2 plan-then-apply (manual §4, branch claude/menu-catalog-v2).
 *
 * Plan-only by default: prints the complete plan (creates / renames /
 * reprices in paise / section+rank / veg class / badges / §8 availability /
 * merge-source + disable-set archival) and every report class, then exits.
 * Nothing is written without --apply, and --apply refuses while any blocker
 * exists. Apply runs in ONE transaction, snapshots every touched row to a
 * backup JSON first, then re-plans and verifies §7 (fried set, Detox,
 * internal tags, Law 8) plus the §7.1 checksum — an apply that does not
 * converge to a zero-action re-plan exits non-zero.
 *
 * The §9 amendment procedure makes this the ONLY path menu changes take:
 * edit the payload CSV, re-run this script. Its idempotency (second run
 * plans zero) is what keeps amendments cheap and auditable.
 *
 * Usage (from repo root, DATABASE_URL required):
 *   pnpm --filter @workspace/scripts run menu-catalog-v2            # plan only
 *   pnpm --filter @workspace/scripts run menu-catalog-v2 -- --md plan.md
 *   pnpm --filter @workspace/scripts run menu-catalog-v2 -- --apply
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { db, menuItemsTable } from "@workspace/db";
import {
  buildPlan,
  parsePayloadCsv,
  parseRationalizationCsv,
  parseSlugMapCsv,
  verifyPostState,
  checksumGoverned,
  type DbMenuRow,
  type Plan,
  type PlanAction,
} from "./lib/menuCatalogV2Plan";

// Paths resolve from this file so the script runs identically on CI, Vercel
// and any checkout (working agreement §4 — never an absolute machine path).
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url)); // <repo>/scripts/src
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const DATA_DIR = path.join(REPO_ROOT, "docs", "TNM-MENU-01");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const mdOut = argValue("--md");
const jsonOut = argValue("--json");
const backupOut = argValue("--backup") ?? `m3-backup-${Date.now()}.json`;

function argValue(flag: string): string | null {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? (args[i + 1] as string) : null;
}

function readCsv(name: string): string {
  return fs.readFileSync(path.join(DATA_DIR, name), "utf8");
}

async function fetchDbRows(): Promise<{ planRows: DbMenuRow[]; raw: Map<string, any> }> {
  const rows = await db.select().from(menuItemsTable);
  const raw = new Map(rows.map((r) => [r.slug, r]));
  const planRows: DbMenuRow[] = rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    pricePaise: r.pricePaise,
    isVeg: r.isVeg,
    isAvailable: r.isAvailable,
    archived: r.archived,
    sectionOrder: r.sectionOrder,
    sortRank: r.sortRank,
    vegClass: r.vegClass,
    badge: r.badge,
    unavailableReason: r.unavailableReason,
    hasMacros: r.macros !== null,
    customizations: r.customizations ?? [],
  }));
  return { planRows, raw };
}

function computePlan(planRows: DbMenuRow[]): Plan {
  return buildPlan({
    payload: parsePayloadCsv(readCsv("menu-catalog-v2.1-payload.csv")),
    slugMap: parseSlugMapCsv(readCsv("m0-final-slug-map.csv")),
    rationalization: parseRationalizationCsv(readCsv("tanmatra-menu-rationalization.csv")),
    dbRows: planRows,
  });
}

function renderPlanMarkdown(plan: Plan, verify: ReturnType<typeof verifyPostState> | null): string {
  const lines: string[] = [];
  lines.push(`# TNM-MENU-01 M-3 plan — ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Actions: ${JSON.stringify(plan.counts)} · blockers: ${plan.blockers.length}`);
  lines.push(`Expected §7.1 checksum: \`${plan.expectedChecksum}\``);
  lines.push("");
  const section = (title: string, items: string[]) => {
    lines.push(`## ${title} (${items.length})`);
    lines.push("");
    for (const it of items) lines.push(`- ${it}`);
    if (items.length === 0) lines.push("- (none)");
    lines.push("");
  };
  section(
    "Blockers — apply refuses while any exist",
    plan.blockers,
  );
  section(
    "Creates (Law-8 gated: unavailable until M-6 macros)",
    plan.actions
      .filter((a): a is Extract<PlanAction, { kind: "create" }> => a.kind === "create")
      .map((a) => `\`${a.slug}\` ← "${a.displayName}" · ${a.section} #${a.values.sortRank} · ${a.values.pricePaise}p · ${a.values.vegClass}${a.values.badge ? ` · ${a.values.badge}` : ""}`),
  );
  section(
    "Updates (field diffs only)",
    plan.actions
      .filter((a): a is Extract<PlanAction, { kind: "update" }> => a.kind === "update")
      .map(
        (a) =>
          `\`${a.slug}\`: ${Object.entries(a.diff)
            .map(([k, v]) => `${k}: ${JSON.stringify((a.before as any)[k])} → ${JSON.stringify(v)}`)
            .join(" · ")}`,
      ),
  );
  section(
    "Archived as merge-sources (maps_from continuity)",
    plan.actions
      .filter((a): a is Extract<PlanAction, { kind: "archive" }> => a.kind === "archive" && a.reason === "merge-source")
      .map((a) => `\`${a.slug}\` → ${a.into}`),
  );
  section(
    "Archived by the disable set (CUT/MERGE/DELIST, soft only)",
    plan.actions
      .filter((a): a is Extract<PlanAction, { kind: "archive" }> => a.kind === "archive" && a.reason === "rationalized")
      .map((a) => `\`${a.slug}\` — ${a.note}`),
  );
  section(
    "Seasonal (unavailable, not archived — winter return)",
    plan.actions.filter((a) => a.kind === "seasonal").map((a) => `\`${a.slug}\``),
  );
  section(
    "STOP-AND-ASK — ungoverned KEEP rows (in the rationalization keep set but absent from the payload; left untouched)",
    plan.reports.ungovernedKeeps,
  );
  section("STOP-AND-ASK — expected rows missing from DB", plan.reports.missingExpected);
  section("Disable-set rows with no matching DB row (informational)", plan.reports.unresolvedRationalization);
  section("Rows untouched by every pass (informational)", plan.reports.untouched);
  if (verify) {
    section(
      verify.ok ? "§7 verification — clean" : "§7 verification — VIOLATIONS",
      verify.violations,
    );
  }
  return lines.join("\n");
}

async function applyPlan(plan: Plan, raw: Map<string, any>): Promise<void> {
  const touchedSlugs = plan.actions.map((a) => a.slug);
  const backup = touchedSlugs.map((s) => raw.get(s)).filter(Boolean);
  fs.writeFileSync(backupOut, JSON.stringify(backup, null, 2));
  console.log(`backup of ${backup.length} touched rows → ${backupOut}`);

  await db.transaction(async (tx) => {
    for (const action of plan.actions) {
      if (action.kind === "create") {
        await tx.insert(menuItemsTable).values({
          slug: action.slug,
          name: action.values.name,
          pricePaise: action.values.pricePaise,
          category: action.values.category,
          isVeg: action.values.isVeg,
          vegClass: action.values.vegClass,
          sectionOrder: action.values.sectionOrder,
          sortRank: action.values.sortRank,
          badge: action.values.badge,
          isAvailable: action.values.isAvailable,
          unavailableReason: action.values.unavailableReason,
          customizations: action.values.customizations,
          contraindications: [],
        });
      } else if (action.kind === "update") {
        await tx
          .update(menuItemsTable)
          .set({ ...action.diff, updatedAt: new Date() })
          .where(eq(menuItemsTable.slug, action.slug));
      } else if (action.kind === "archive") {
        await tx
          .update(menuItemsTable)
          .set({
            archived: true,
            isAvailable: false,
            unavailableReason: action.note,
            updatedAt: new Date(),
          })
          .where(eq(menuItemsTable.slug, action.slug));
      } else if (action.kind === "seasonal") {
        await tx
          .update(menuItemsTable)
          .set({
            isAvailable: false,
            unavailableReason: action.note,
            updatedAt: new Date(),
          })
          .where(eq(menuItemsTable.slug, action.slug));
      }
    }
  });
}

async function main(): Promise<void> {
  const { planRows, raw } = await fetchDbRows();
  const plan = computePlan(planRows);

  console.log(`plan: ${JSON.stringify(plan.counts)} · blockers ${plan.blockers.length}`);
  for (const b of plan.blockers) console.log(`  BLOCKER: ${b}`);
  for (const k of plan.reports.ungovernedKeeps) console.log(`  STOP-AND-ASK ungoverned keep: ${k}`);

  if (!APPLY) {
    const md = renderPlanMarkdown(plan, null);
    if (mdOut) fs.writeFileSync(mdOut, md);
    else console.log(md);
    if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(plan, null, 2));
    process.exit(plan.blockers.length > 0 ? 1 : 0);
  }

  if (plan.blockers.length > 0) {
    console.error("refusing to apply: blockers present (see plan)");
    process.exit(1);
  }

  await applyPlan(plan, raw);

  // Idempotency + §7 + §7.1: the applied state must re-plan to zero actions,
  // pass verification, and reproduce the expected checksum.
  const { planRows: postRows } = await fetchDbRows();
  const rePlan = computePlan(postRows);
  const verify = verifyPostState(postRows);
  // Post-apply, exactly the payload-governed rows carry a section_order and
  // are un-archived (no other writer sets section_order — it is R-1-fenced),
  // so this filter reproduces the engine's governed set including rows that
  // needed no change this run.
  const postChecksum = checksumGoverned(
    postRows
      .filter((r) => r.sectionOrder !== null && !r.archived)
      .map((r) => ({
        slug: r.slug,
        name: r.name,
        sectionOrder: r.sectionOrder,
        sortRank: r.sortRank,
        pricePaise: r.pricePaise,
        isAvailable: r.isAvailable,
      })),
  );

  const md = renderPlanMarkdown(plan, verify);
  if (mdOut) fs.writeFileSync(mdOut, md);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ plan, rePlan, verify, postChecksum }, null, 2));

  const converged = rePlan.actions.length === 0;
  const checksumOk = postChecksum === plan.expectedChecksum;
  console.log(`re-plan actions: ${rePlan.actions.length} (must be 0)`);
  console.log(`§7 verify: ${verify.ok ? "clean" : `${verify.violations.length} violation(s)`}`);
  for (const v of verify.violations) console.log(`  §7: ${v}`);
  console.log(`§7.1 checksum: ${checksumOk ? "MATCH" : `MISMATCH (${postChecksum} ≠ ${plan.expectedChecksum})`}`);
  process.exit(converged && checksumOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
