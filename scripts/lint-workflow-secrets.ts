import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Workflow-secret interpolation gate.
//
// WHY THIS EXISTS — a real, shipped outage, not a hypothetical:
//
//   deploy.yml passed the admin password hash to Cloud Run as
//     --update-env-vars "^;^...;ADMIN_PASSWORD_HASH=${{ secrets.ADMIN_PASSWORD_HASH }};..."
//   inside a `run:` block. GitHub Actions substitutes the secret as LITERAL
//   TEXT into the script, and only then does bash parse it. The hash format is
//     scrypt$16384$8$1$<salt>$<hash>
//   so bash performed parameter expansion on every `$`:
//     $16384 -> "" + "6384"   ($1 is an unset positional)
//     $8, $1, $<salt>, $<hash> -> ""
//   and Cloud Run received the string "scrypt6384".
//
//   verifyPassword() splits on "$" and requires 6 parts, so it returned false
//   for EVERY password — including the correct one. The admin console rejected
//   its own operator with `invalid_credentials` on every attempt, and because
//   the variable was present-but-corrupt rather than missing, the server's own
//   "admin auth not configured" guard never fired. Nothing was red. The only
//   symptom was a login that refused the right password.
//
//   It survived because the working values had been set by hand on Cloud Run;
//   every deploy silently overwrote them again.
//
// THE RULE: a secret may not be interpolated directly into a `run:` script.
// Bind it in the step's `env:` block and reference the shell variable:
//
//   env:
//     ADMIN_PASSWORD_HASH: ${{ secrets.ADMIN_PASSWORD_HASH }}
//   run: |
//     gcloud ... "ADMIN_PASSWORD_HASH=${ADMIN_PASSWORD_HASH}"
//
// The `env:` value is not a shell context, so it is passed through verbatim;
// and bash does NOT re-scan the result of a parameter expansion, so a `$` in
// the value survives. Same reason this is the documented fix for the closely
// related shell-injection class (a secret containing `"; rm -rf /` would be
// executed by the inline form and is inert in the env form).
//
// Usage: node --experimental-strip-types scripts/lint-workflow-secrets.ts

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const WORKFLOW_DIR = path.join(REPO_ROOT, ".github", "workflows");

/** `${{ secrets.NAME }}` / `${{secrets.NAME}}`, tolerant of inner spacing. */
const SECRET_REF = /\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g;

/**
 * Secrets that are allowed to appear inline in a `run:` script, with the
 * reason. Keep this SHORT — an entry here is a standing bet that the value
 * can never contain a shell metacharacter.
 */
const ALLOWED = new Map<string, string>([
  // Consumed by google-github-actions/auth via `with:`, never by a shell.
  // Listed for the case where a future step echoes it into one.
  ["GCP_SA_KEY", "json credential consumed by an action input, not a shell"],
]);

interface Finding {
  file: string;
  line: number;
  secret: string;
  text: string;
}

/**
 * Walk a workflow file and report every `${{ secrets.* }}` that lands inside a
 * `run:` block.
 *
 * Deliberately a line-oriented scan rather than a YAML parse: the thing being
 * checked is a TEXTUAL substitution that happens before YAML semantics matter,
 * and a parser would also have to model block scalars to tell a `run:` body
 * from a `with:` value. Indentation is enough — a `run:` block's body is
 * exactly the lines indented deeper than the `run:` key.
 */
function scanFile(file: string): Finding[] {
  const rel = path.relative(REPO_ROOT, file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const findings: Finding[] = [];

  let runIndent: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    if (runIndent !== null) {
      // A non-blank line at or above the `run:` key's own indent ends the block.
      if (trimmed !== "" && indent <= runIndent) runIndent = null;
    }

    if (runIndent === null && /^run:\s*[|>]?/.test(trimmed)) {
      runIndent = indent;
      // A single-line `run: cmd ${{ secrets.X }}` is still a shell context.
    } else if (runIndent === null) {
      continue;
    }

    SECRET_REF.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SECRET_REF.exec(line)) !== null) {
      const secret = m[1]!;
      if (ALLOWED.has(secret)) continue;
      findings.push({ file: rel, line: i + 1, secret, text: trimmed.slice(0, 120) });
    }
  }

  return findings;
}

function main(): void {
  if (!fs.existsSync(WORKFLOW_DIR)) {
    console.log("No .github/workflows directory — nothing to check.");
    return;
  }

  const files = fs
    .readdirSync(WORKFLOW_DIR)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .map((f) => path.join(WORKFLOW_DIR, f))
    .sort();

  const findings = files.flatMap(scanFile);

  if (findings.length > 0) {
    console.error("Secret interpolated directly into a `run:` script.\n");
    console.error(
      "GitHub substitutes the secret as literal text and bash then expands it:",
    );
    console.error(
      "  a value containing `$` is silently CORRUPTED (this broke admin login),",
    );
    console.error("  and a value containing shell syntax is EXECUTED.\n");
    console.error("Bind it in the step's `env:` block and use ${VAR} instead:\n");
    console.error("  env:");
    console.error("    MY_SECRET: ${{ secrets.MY_SECRET }}");
    console.error("  run: |");
    console.error('    some-command "FLAG=${MY_SECRET}"\n');
    for (const f of findings) {
      console.error(`  ${f.file}:${f.line}  secrets.${f.secret}`);
      console.error(`    ${f.text}`);
    }
    console.error(
      `\n${findings.length} occurrence(s). See scripts/lint-workflow-secrets.ts for the full account.`,
    );
    process.exit(1);
  }

  console.log(
    `✅ workflow-secret lint pass — ${files.length} workflow file(s), no secrets interpolated into a shell.`,
  );
}

main();
