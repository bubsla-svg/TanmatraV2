import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Law 6 copy-gate behaviour.
 *
 * The gate is a CI script, so it is exercised the way CI runs it — by invoking
 * it against a throwaway tree — rather than by importing internals it does not
 * export. That also pins the contract that matters to a caller: exit code and
 * which file:line it names.
 *
 * The negation case is the one worth guarding hardest. "The trial never
 * auto-renews" is not a recurrence promise, it is the DENIAL Law 5 requires,
 * it ships in lib/trial.ts, and e2e/specs/cuj-04-trial.spec.ts asserts it
 * verbatim. The first draft of this gate flagged it — a gate that fails the one
 * sentence the contract mandates would have forced someone to either delete
 * compliant copy or blanket-exempt the rule.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const GATE = path.join(REPO_ROOT, "scripts", "lint-copy-vocabulary.ts");

interface GateResult {
  code: number;
  output: string;
}

/** Run the gate over a temp tree containing `files`, keyed by path under the target. */
function runGate(files: Record<string, string>): GateResult {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "law6-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body);
    }
    try {
      const output = execFileSync(
        process.execPath,
        ["--experimental-strip-types", GATE, dir],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      return { code: 0, output };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { code: e.status ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('"never auto-renews" passes — it is the denial Law 5 requires, not a promise', () => {
  const r = runGate({
    "lib/trial.ts": `export const copy = { note: "7 days to decide. The trial never auto-renews — continuing is one tap." };\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("a bare recurrence promise on a trial surface fails", () => {
  const r = runGate({
    "lib/trial.ts": `export const copy = { note: "Your trial auto-renews unless you cancel." };\n`,
  });
  assert.equal(r.code, 1);
  assert.match(r.output, /recurrence vocabulary/);
});

test("the same recurrence wording passes off a trial surface", () => {
  // Post-conversion subscriptions genuinely do recur — schema/subscriptions.ts
  // only forbids a mandate on a LIVE trial. The gate must not blanket-ban it.
  const r = runGate({
    "components/account/Billing.tsx": `export const C = () => <p>Billed each cycle.</p>;\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("implementation vocabulary fails anywhere on a customer surface", () => {
  const r = runGate({
    "components/checkout/Total.tsx": `export const C = () => <span>Total (server-priced, incl. GST)</span>;\n`,
  });
  assert.equal(r.code, 1);
  assert.match(r.output, /implementation detail/);
  assert.match(r.output, /Total\.tsx:1/);
});

test("a raw status enum in copy fails", () => {
  const r = runGate({
    "components/order/Status.tsx": `export const C = () => <p>Your order is payment_pending.</p>;\n`,
  });
  assert.equal(r.code, 1);
  assert.match(r.output, /raw status enum/);
});

test("prose ABOUT a banned term is not a violation", () => {
  // Otherwise the gate fails its own documentation, and every doc-comment
  // explaining why a word was removed becomes a build break.
  const r = runGate({
    "lib/notes.ts": `// We removed "server-priced" here because it is implementation detail.\n/* payment_pending was also rendered raw. */\nexport const x = 1;\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("an identifier is not copy", () => {
  const r = runGate({
    "lib/billing.ts": `export function nextBillingCycleStart(): number { return 0; }\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("law6-allow exempts a line", () => {
  const r = runGate({
    "components/checkout/Total.tsx":
      `export const C = () => <span>Total (server-priced)</span>; // law6-allow: internal debug panel\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("test files are not scanned", () => {
  // Specs assert on copy verbatim; scanning them would double-report every
  // violation and fail on fixtures that deliberately contain bad strings.
  const r = runGate({
    "lib/thing.test.ts": `const bad = "server-priced";\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test('"Which track?" is caught — the live instance the first draft missed', () => {
  // PlanDetails.tsx shipped exactly this. The original pattern demanded
  // choose/select/pick/your, so the gate passed while the canonical banned
  // usage sat in the tree.
  const r = runGate({
    "components/checkout/plan/PlanDetails.tsx": `export const C = () => <span>Which track?</span>;\n`,
  });
  assert.equal(r.code, 1);
  assert.match(r.output, /plan-type selector/);
});

test('"track" as a verb still passes', () => {
  // The confirmation screen's "Track live" CTA and "track it here" are correct
  // English and correct product copy. Broadening the noun rule must not ban
  // the verb, or the fix for one Law 6 violation manufactures another.
  const r = runGate({
    "app/order/confirmed/page.tsx":
      `export const C = () => <div><a>Track live</a><p>You can track it here any time.</p></div>;\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});
