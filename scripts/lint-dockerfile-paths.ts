import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Dockerfile COPY-path gate.
//
// A Dockerfile `COPY` is a hard reference to a repo path with NO compiler,
// linter or test behind it. Delete the path and every check in this repo still
// passes — typecheck, the storefront and legacy suites, all the lint gates —
// while `docker build` fails at the COPY, seconds in, on the deploy runner.
//
// Not hypothetical. On 2026-08-18 the prune that removed `lib/agency-agents`
// left `artifacts/tanmatra/Dockerfile` copying its manifest:
//
//     COPY lib/agency-agents/package.json     lib/agency-agents/
//
// The PR was green on every gate. main deployed PARTIALLY — api-server and
// storefront shipped, `frontend-cloud-run` failed — so the legacy service
// (which serves /images/* to the storefront) could no longer be rebuilt, and
// every later deploy failed the same way with nothing red until someone read
// the deploy logs. See PR #79.
//
// The removal PR's own inbound-reference sweep covered .github/, scripts/,
// tools/, tsconfig.json and the docs. It did not think to grep Dockerfiles.
// This gate makes that impossible to forget.
//
// What it checks: every COPY source in every tracked Dockerfile that names a
// repo path must exist on disk. Build-stage copies (`COPY --from=...`) refer to
// a previous stage's filesystem, not the repo, and are skipped.
//
// Usage: node --experimental-strip-types scripts/lint-dockerfile-paths.ts

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

/** Dockerfiles are few and deliberate — list them by walking, not globbing a
 *  package manager's output, so a new one is covered the day it lands. */
function findDockerfiles(dir: string, acc: string[] = []): string[] {
  const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", ".turbo"]);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) findDockerfiles(path.join(dir, entry.name), acc);
    } else if (/^Dockerfile(\..+)?$/.test(entry.name)) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

/** The sources of one COPY/ADD instruction, or [] when the line is not one we
 *  can resolve against the repo. Handles line continuations, --flags, and both
 *  shell and JSON (exec) forms. */
function copySources(line: string): string[] {
  const trimmed = line.trim();
  if (!/^(COPY|ADD)\s/i.test(trimmed)) return [];

  // `COPY --from=builder /app/x ./y` copies from a prior BUILD STAGE, not the
  // repo. Same for --from=<image>. Nothing on disk to verify.
  if (/--from=/i.test(trimmed)) return [];

  let rest = trimmed.replace(/^(COPY|ADD)\s+/i, "");
  rest = rest.replace(/--[a-z-]+(=\S+)?\s*/gi, ""); // --chown=, --chmod, --link

  let parts: string[];
  if (rest.startsWith("[")) {
    try {
      parts = JSON.parse(rest) as string[];
    } catch {
      return []; // malformed JSON form — not this gate's job to report
    }
  } else {
    parts = rest.split(/\s+/).filter(Boolean);
  }
  // Last element is the destination inside the image.
  return parts.slice(0, -1);
}

/** A COPY source can be a glob or a bare path. Only verify literal paths —
 *  a glob that matches nothing is a different (and legal) situation. */
function isLiteralRepoPath(src: string): boolean {
  if (src === "." || src === "./") return false;
  if (/[*?\[\]]/.test(src)) return false;
  if (src.startsWith("/")) return false; // absolute: an image path, not repo
  return true;
}

const dockerfiles = findDockerfiles(REPO_ROOT).sort();
const failures: string[] = [];
let checked = 0;

for (const file of dockerfiles) {
  const rel = path.relative(REPO_ROOT, file);
  const raw = fs.readFileSync(file, "utf8");

  // Fold line continuations into one logical instruction while KEEPING the
  // line number the instruction starts on. Collapsing first and indexing the
  // result reports the wrong line — which is worse than useless in a message
  // whose whole job is to point at a build failure.
  const rawLines = raw.split(/\r?\n/);
  const logical: Array<{ text: string; line: number }> = [];
  for (let i = 0; i < rawLines.length; i++) {
    const startLine = i + 1;
    let text = rawLines[i] ?? "";
    while (/\\\s*$/.test(text) && i + 1 < rawLines.length) {
      text = text.replace(/\\\s*$/, " ") + (rawLines[++i] ?? "").trim();
    }
    logical.push({ text, line: startLine });
  }

  for (const { text, line } of logical) {
    for (const src of copySources(text)) {
      if (!isLiteralRepoPath(src)) continue;
      checked++;
      const resolved = path.resolve(REPO_ROOT, src);
      if (!fs.existsSync(resolved)) {
        failures.push(
          `${rel}:${line} COPY source does not exist: ${src}\n` +
            `    → the image build will fail at this line. Either restore the path ` +
            `or delete the COPY.`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error(
    `\n❌ Dockerfile path gate — ${failures.length} COPY source(s) missing from the repo:\n`,
  );
  for (const f of failures) console.error(`  ${f}\n`);
  console.error(
    "A Dockerfile COPY is a hard reference with no compiler behind it: every other\n" +
      "gate in this repo passes while the image build fails on the deploy runner.\n",
  );
  process.exit(1);
}

console.log(
  `✅ Dockerfile path gate — ${checked} COPY source(s) across ` +
    `${dockerfiles.length} Dockerfile(s) all exist.`,
);
