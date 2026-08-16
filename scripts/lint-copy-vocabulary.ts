import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Customer-copy vocabulary gate (Experience Contract Law 6).
//
// WHY THIS EXISTS
// ---------------
// Law 6 says customer surfaces speak the customer's language. The failures are
// never syntax errors — they are internal vocabulary that leaked into rendered
// text and reads as correct to the person who wrote it, because that person
// already knows what the word means. "server-priced" is an implementation
// guarantee, not a customer benefit. A raw status enum (`payment_pending`) is a
// database value wearing a UI. "cycle" promises recurrence.
//
// That last one is the sharp edge, and it is why this gate is worth having
// rather than trusting review. `lib/db/src/schema/subscriptions.ts:44-52` is
// explicit: a LIVE TRIAL is marketed as a one-time purchase that "does not
// auto-renew" and must never carry a recurring mandate; only a `converted`
// subscription re-enters the recurring path. So "cycle" / "renews" / "next
// billing date" are *correct* on post-conversion surfaces and are a broken
// promise on trial surfaces — the same word, contract-compliant in one file and
// a Law 5 violation in the next. A reviewer reading a diff in isolation cannot
// see which side of that line the file sits on. A gate that knows the file can.
//
// WHAT IT CHECKS
// --------------
// Banned terms are matched ONLY inside customer-visible text: JSX text nodes and
// string literals. Comments are stripped first, so prose explaining why a term
// is banned — this header, a doc-comment, a changelog note — is not itself a
// violation. Identifiers are never matched: `billingCycleStart` is a variable
// name, not copy, and renaming code is not this gate's business.
//
// Recurrence vocabulary is scoped by surface. On a trial/one-time path it fails.
// Elsewhere it passes, because there it is the truth.
//
// ESCAPE HATCH
// ------------
// A line carrying `law6-allow: <reason>` is exempt. Deliberate, greppable, and
// it forces the reason into the diff where a reviewer sees it.
//
// Usage:
//   node --experimental-strip-types scripts/lint-copy-vocabulary.ts [targetDir]

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TARGET = path.resolve(REPO_ROOT, process.argv[2] ?? "artifacts/storefront");
const SCAN_SUBDIRS = ["components", "app", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "quarantine"]);
const ALLOW_MARKER = /law6-allow:/;

interface BannedTerm {
  label: string;
  pattern: RegExp;
  why: string;
  /** When set, only files whose path matches are checked. */
  onlyIn?: RegExp;
  /**
   * When the surrounding text matches, the hit is not a violation.
   *
   * Recurrence vocabulary needs this: "never auto-renews" is not a promise of
   * recurrence, it is the DENIAL Law 5 requires on a trial surface — and it is
   * asserted verbatim by e2e/specs/cuj-04-trial.spec.ts. A gate that failed the
   * one sentence the contract mandates would be worse than no gate.
   */
  unless?: RegExp;
}

/**
 * Surfaces where a live trial / one-time purchase is being sold. Recurrence
 * vocabulary here contradicts the "never auto-renews" promise.
 */
const TRIAL_SURFACE = /(trial|one-?time|alacarte|a-la-carte)/i;

const BANNED: BannedTerm[] = [
  {
    label: "implementation detail as a selling point",
    pattern: /\bserver[- ]priced\b/i,
    why: "Describes our architecture, not their benefit. Say what it means for them.",
  },
  {
    label: "raw status enum in copy",
    pattern: /\b(payment|order|delivery|subscription)_(pending|failed|succeeded|active|cancelled|canceled|paused)\b/i,
    why: "A database value rendered at a customer. Write the sentence a person would say.",
  },
  {
    label: "developer phrasing for a list",
    pattern: /\bcomma[- ]separated\b/i,
    why: "An input-format instruction borrowed from a config file. Describe the thing, not the delimiter.",
  },
  {
    label: '"track" as a plan-type selector',
    // Noun position only — a determiner or interrogative in front of it.
    // "track" as a VERB is correct and ships on the confirmation screen
    // ("Track live", "track it here"), so this cannot be a bare word ban. The
    // first draft required choose/select/pick/your and therefore missed the
    // live instance — PlanDetails.tsx's "Which track?" — which is exactly the
    // usage the contract names. A gate reporting clean while the canonical
    // example sits in the tree is worse than no gate.
    pattern: /\b(which|what|choose|select|pick|your|a|the)\s+track\b/i,
    why: 'Internal taxonomy. To a customer "track" is what you do to a delivery, not a plan you buy.',
  },
  {
    label: "recurrence vocabulary on a one-time surface",
    pattern: /\b(billing\s+cycle|each\s+cycle|per\s+cycle|next\s+billing|recurring\s+charge|auto[- ]?renews?)\b/i,
    why:
      "This surface sells a one-time purchase. schema/subscriptions.ts:44-52 — a live trial " +
      "must never carry a recurring mandate, so promising a cycle here is a broken promise " +
      "(Law 5). Recurrence copy belongs on post-conversion surfaces only.",
    onlyIn: TRIAL_SURFACE,
    // "never auto-renews" / "does not auto-renew" is the required denial, not a promise.
    unless: /\b(never|no|not|doesn'?t|does\s+not|won'?t|will\s+not)\b[^.]{0,24}\bauto[- ]?renew/i,
  },
];

/** Strip comments so prose about a banned term is not itself a violation. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, lead: string) => lead);
}

/**
 * String literals that are IDENTIFIERS rather than copy, blanked before the
 * scan so a name that happens to look like a status enum is not read as a
 * sentence shown to someone.
 *
 * The gate's own header already says "identifiers are never matched"; these are
 * identifiers that happen to be spelled as string literals, which is the one
 * case that rule missed. An analytics event is the clearest example — the whole
 * point of `emitFunnel("payment_failed", …)` is that it is a stable machine
 * name, and renaming it to read like prose would break the scoreboard while
 * changing nothing a customer ever sees.
 *
 * Deliberately narrow. Each entry names a specific position, not a general
 * "strings near this word are fine" — a broad carve-out would quietly stop the
 * gate catching the real thing it exists for.
 */
const IDENTIFIER_POSITIONS: RegExp[] = [
  // Analytics event name: the first argument to emitFunnel(.
  /emitFunnel\(\s*(["'`])[^"'`]*\1/g,
  // A string-literal member of a type union — `| "payment_failed"` — which is
  // a type, and cannot be rendered at all.
  /^\s*\|\s*(["'`])[^"'`]*\1/g,
];

function blankIdentifierPositions(line: string): string {
  let out = line;
  for (const re of IDENTIFIER_POSITIONS) {
    out = out.replace(re, (m) => m.replace(/[^\s]/g, " "));
  }
  return out;
}

/**
 * Customer-visible text on a line: string literals plus JSX text nodes.
 * Import specifiers are excluded — a path is not copy.
 */
function visibleText(rawLine: string): string {
  const line = blankIdentifierPositions(rawLine);
  if (/^\s*(import|export)\b.*\bfrom\b/.test(line)) return "";
  const parts: string[] = [];
  for (const m of line.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)) {
    parts.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  // JSX text: >…< with no braces (an interpolation is code, not literal copy).
  for (const m of line.matchAll(/>([^<>{}]+)</g)) parts.push(m[1] ?? "");
  return parts.join("  ");
}

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(abs, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(abs);
    }
  }
}

const files: string[] = [];
for (const sub of SCAN_SUBDIRS) walk(path.join(TARGET, sub), files);

interface Violation {
  term: BannedTerm;
  file: string;
  line: number;
  text: string;
}

const violations: Violation[] = [];

for (const file of files) {
  const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
  const raw = fs.readFileSync(file, "utf8");
  const rawLines = raw.split("\n");
  const lines = stripComments(raw).split("\n");

  lines.forEach((line, i) => {
    // Tested against the RAW line: the marker is normally written as a trailing
    // `//` comment, and stripComments would have removed it before we looked —
    // which silently made the documented escape hatch a no-op.
    if (ALLOW_MARKER.test(rawLines[i] ?? "")) return;
    const text = visibleText(line);
    if (!text) return;
    for (const term of BANNED) {
      if (term.onlyIn && !term.onlyIn.test(rel)) continue;
      if (term.unless?.test(text)) continue;
      if (term.pattern.test(text)) {
        violations.push({ term, file: rel, line: i + 1, text: text.trim().slice(0, 100) });
      }
    }
  });
}

if (violations.length > 0) {
  const byTerm = new Map<string, Violation[]>();
  for (const v of violations) {
    const list = byTerm.get(v.term.label) ?? [];
    list.push(v);
    byTerm.set(v.term.label, list);
  }

  console.error(`\n✗ Law 6 copy gate: ${violations.length} violation(s) in customer-visible text:\n`);
  for (const [label, list] of byTerm) {
    console.error(`  ${label} — ${list[0]?.term.why ?? ""}`);
    for (const v of list) console.error(`      ${v.file}:${v.line}  “${v.text}”`);
    console.error("");
  }
  console.error(
    "  Rewrite in the customer's words. If a term is genuinely correct here " +
      "(e.g. recurrence copy on a post-conversion surface), add `law6-allow: <reason>` to the line.\n",
  );
  process.exit(1);
}

console.log(
  `✓ Law 6 copy gate: no internal vocabulary in customer-visible text (${files.length} files scanned).`,
);
