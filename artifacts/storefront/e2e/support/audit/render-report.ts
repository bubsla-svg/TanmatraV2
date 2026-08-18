/**
 * Assemble the per-route audit JSON into one markdown report.
 *
 * Separate from the spec because `fullyParallel` runs each test in its own
 * worker process — an in-spec accumulator only ever sees one worker's routes.
 * The spec writes `<route>.json`; this reads the directory.
 *
 * Usage (from repo root, after a run):
 *   node --experimental-strip-types \
 *     artifacts/storefront/e2e/support/audit/render-report.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface Finding {
  probe: string;
  severity: string;
  detail: string;
  selector?: string;
}
interface RouteReport {
  route: string;
  name: string;
  ok: boolean;
  status?: number;
  findings: Finding[];
  consoleErrors: string[];
  failedRequests: string[];
}

const DIR = resolve(process.cwd(), "artifacts/storefront/e2e/audit-report");
const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const reports: RouteReport[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".json") && f !== "findings.json")
  .map((f) => JSON.parse(readFileSync(resolve(DIR, f), "utf8")) as RouteReport)
  .sort((a, b) => a.route.localeCompare(b.route));

const all = reports.flatMap((r) => r.findings.map((f) => ({ ...f, route: r.route })));
const byProbe = new Map<string, number>();
const bySeverity = new Map<string, number>();
for (const f of all) {
  byProbe.set(f.probe, (byProbe.get(f.probe) ?? 0) + 1);
  bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
}

const L: string[] = [];
L.push("# Frontend audit report");
L.push("");
L.push(`Routes audited: **${reports.length}** · findings: **${all.length}**`);
L.push("");
L.push("| severity | count |");
L.push("|---|---:|");
for (const s of ["critical", "high", "medium", "low"]) {
  if (bySeverity.has(s)) L.push(`| ${s} | ${bySeverity.get(s)} |`);
}
L.push("");
L.push("| probe | count |");
L.push("|---|---:|");
for (const [p, n] of [...byProbe].sort((a, b) => b[1] - a[1])) L.push(`| \`${p}\` | ${n} |`);
L.push("");

for (const r of reports) {
  const head = r.ok
    ? `## \`${r.route}\``
    : `## \`${r.route}\` — **DID NOT RENDER (status ${r.status ?? "?"})**`;
  L.push(head);
  L.push("");
  if (r.findings.length === 0 && r.ok) {
    L.push("_no findings_");
  } else {
    const sorted = [...r.findings].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
    );
    for (const f of sorted) {
      L.push(`- **[${f.severity}] \`${f.probe}\`** — ${f.detail}`);
      if (f.selector) L.push(`  - \`${f.selector}\``);
    }
  }
  if (r.consoleErrors.length) {
    L.push("");
    L.push(`<details><summary>${r.consoleErrors.length} console error(s)</summary>`);
    L.push("");
    for (const e of r.consoleErrors.slice(0, 10)) L.push(`- \`${e}\``);
    L.push("");
    L.push("</details>");
  }
  if (r.failedRequests.length) {
    L.push("");
    L.push(`<details><summary>${r.failedRequests.length} failed request(s)</summary>`);
    L.push("");
    for (const e of r.failedRequests.slice(0, 10)) L.push(`- \`${e}\``);
    L.push("");
    L.push("</details>");
  }
  L.push("");
}

writeFileSync(resolve(DIR, "report.md"), L.join("\n") + "\n");
console.log(`report.md written — ${reports.length} routes, ${all.length} findings`);
for (const [p, n] of [...byProbe].sort((a, b) => b[1] - a[1])) console.log(`  ${p}: ${n}`);
