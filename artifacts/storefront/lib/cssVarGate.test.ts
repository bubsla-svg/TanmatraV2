import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The undeclared-custom-property gate.
 *
 * Exercised the way CI runs it — as a subprocess over a throwaway tree — rather
 * than by importing internals it does not export. That pins the contract a
 * caller depends on: the exit code, and which file:line it names.
 *
 * The two cases worth guarding hardest are the ones that would make the gate
 * lie. A `var(--x, 1rem)` fallback still renders, so failing it would force
 * people to declare properties that were never a problem. And an unresolvable
 * stylesheet must be a loud failure, because if the gate silently reads zero
 * declarations it reports EVERY property as undeclared — noise so large the
 * gate gets switched off, which is how a real find would be lost.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const GATE = path.join(REPO_ROOT, "scripts", "lint-undeclared-css-var.ts");

const LAYOUT = `import "./globals.css";\nexport default function L() { return null; }\n`;

interface GateResult {
  code: number;
  output: string;
}

/** Run the gate over a temp tree. `app/layout.tsx` is supplied unless overridden. */
function runGate(files: Record<string, string>): GateResult {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cssvar-"));
  const tree = { "app/layout.tsx": LAYOUT, ...files };
  try {
    for (const [rel, body] of Object.entries(tree)) {
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

test("a property nothing declares fails, and the gate says where", () => {
  // The whole point: this renders identically to no rule at all, with no
  // console warning and no build error.
  const r = runGate({
    "app/globals.css": ":root { --gold: #d4af37; }\n",
    "components/Cta.tsx": `export const C = () => <a className="min-h-[var(--fixture-pad)]">Go</a>;\n`,
  });
  assert.equal(r.code, 1);
  assert.match(r.output, /--fixture-pad/);
  assert.match(r.output, /Cta\.tsx:1/);
});

test("declaring it in a shipped stylesheet clears the failure", () => {
  const r = runGate({
    "app/globals.css": ":root { --fixture-pad: 24px; }\n",
    "components/Cta.tsx": `export const C = () => <a className="min-h-[var(--fixture-pad)]">Go</a>;\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("a use with a fallback is not a failure", () => {
  // `var(--x, 1rem)` renders 1rem. It is not the silent no-op this gate is
  // about, and failing it would be a gate demanding busywork.
  const r = runGate({
    "app/globals.css": ":root { --gold: #d4af37; }\n",
    "components/Cta.tsx": `export const C = () => <a className="p-[var(--pad,1rem)]">Go</a>;\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("prose about a property is not a use of it", () => {
  // globals.css really does carry "do not re-introduce var(--color-*) reads
  // here". Reading that as a use of a property named `--color-` made the gate
  // fail on its own documentation.
  const r = runGate({
    "app/globals.css": "/* Do not re-introduce var(--color-*) reads here. */\n:root { --gold: #d4af37; }\n",
    "components/Cta.tsx": `// We removed var(--legacy-pad) from this file.\nexport const C = () => <a>Go</a>;\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("a property set from JS counts as declared", () => {
  // `style={{ "--ring": … }}` genuinely defines it at runtime; it is simply not
  // in a stylesheet.
  const r = runGate({
    "app/globals.css": ":root { --gold: #d4af37; }\n",
    "components/Ring.tsx":
      `export const C = () => <div style={{ "--ring": "40%" }} className="bg-[conic-gradient(var(--ring))]" />;\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("an unresolvable stylesheet import fails loudly instead of reporting everything", () => {
  // With zero declarations read, every property in the tree looks undeclared.
  // A gate that produced that much noise would be turned off, and a real find
  // would go with it — so this has to be its own, explicit failure.
  const r = runGate({
    "app/layout.tsx": `import "@nonexistent/pkg/theme.css";\nimport "./globals.css";\n`,
    "app/globals.css": ":root { --gold: #d4af37; }\n",
    "components/Cta.tsx": `export const C = () => <a className="text-[var(--gold)]">Go</a>;\n`,
  });
  assert.equal(r.code, 1);
  assert.match(r.output, /could not resolve/i);
  assert.match(r.output, /@nonexistent\/pkg\/theme\.css/);
  assert.doesNotMatch(r.output, /--gold/, "a declared property must not be blamed for the missing sheet");
});

test("test files are not scanned", () => {
  const r = runGate({
    "app/globals.css": ":root { --gold: #d4af37; }\n",
    "lib/thing.test.ts": `const cls = "min-h-[var(--never-declared)]";\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("the real storefront passes", () => {
  // The gate is only worth wiring if the tree is clean today; a gate that ships
  // red gets an allow-list on day one.
  const out = execFileSync(
    process.execPath,
    ["--experimental-strip-types", GATE, path.join(REPO_ROOT, "artifacts", "storefront")],
    { encoding: "utf8" },
  );
  assert.match(out, /every custom property used is declared/);
});
