import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The client-navigation gate, and the ten links it was written for (3.2).
 *
 * `<a href="/menu">` in an App Router app is a full document load — router
 * unmounted, providers re-run, query cache discarded, scroll lost, nothing
 * prefetched. It is correct HTML, it is correct in a plain React app, and it is
 * correct here for external links. Only the leading `/` makes it wrong, and
 * only in this framework, which is why ten of them accumulated.
 *
 * The gate is exercised as a subprocess over throwaway trees, the way CI runs
 * it. The cases that would make it useless are the ones guarded hardest: it
 * must not touch external links (that IS what an anchor is for), and its escape
 * hatch must actually work on a multi-line tag, where the href — and so the
 * reason — sits on its own line.
 *
 * Run: node --test --import tsx ./lib/clientNav.test.ts
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const GATE = path.join(REPO_ROOT, "scripts", "lint-client-nav.ts");
const STOREFRONT = path.join(REPO_ROOT, "artifacts", "storefront");

interface GateResult {
  code: number;
  output: string;
}

function runGate(files: Record<string, string>): GateResult {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clientnav-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body);
    }
    try {
      return {
        code: 0,
        output: execFileSync(process.execPath, ["--experimental-strip-types", GATE, dir], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }),
      };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { code: e.status ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("a raw anchor to an app route fails, and the gate names the href", () => {
  const r = runGate({
    "components/Cta.tsx": `export const C = () => <a href="/menu">Menu</a>;\n`,
  });
  assert.equal(r.code, 1);
  assert.match(r.output, /Cta\.tsx:1/);
  assert.match(r.output, /→ \/menu/);
});

test("a templated internal href fails too — that is the grid-loop case", () => {
  // marketplace/page.tsx and recipes/page.tsx each had one of these INSIDE a
  // .map(), so every card in the grid was a full document load.
  const r = runGate({
    "app/list/page.tsx":
      "export const P = () => items.map((i) => <a key={i.id} href={`/marketplace/${i.slug}`}>{i.name}</a>);\n",
  });
  assert.equal(r.code, 1);
});

test("an external link is never touched — that is what an anchor is for", () => {
  const r = runGate({
    "components/Footer.tsx":
      `export const F = () => (<div>` +
      `<a href="https://wa.me/919000000000">WhatsApp</a>` +
      `<a href="mailto:hello@tanmatra.food">Email</a>` +
      `<a href="tel:+919000000000">Call</a>` +
      `<a href="#nutrition">Nutrition</a>` +
      `</div>);\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("a protocol-relative URL is external, not an app route", () => {
  // `//cdn.example.com/x` starts with a slash but leaves the origin. Reading it
  // as internal would fail a link the gate has no business touching.
  const r = runGate({
    "components/Cta.tsx": `export const C = () => <a href="//cdn.example.com/x">CDN</a>;\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("<Link> is what the gate is asking for", () => {
  const r = runGate({
    "components/Cta.tsx":
      `import Link from "next/link";\nexport const C = () => <Link href="/menu">Menu</Link>;\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("the escape hatch works on a multi-line tag", () => {
  // The href — and so the reason — sits on its own line in every real case. A
  // marker check that only looked at the tag's first line would make the
  // documented hatch a no-op, which is how SegmentError.tsx would have been
  // forced into a <Link> it must not use.
  const r = runGate({
    "components/SegmentError.tsx":
      `export const E = () => (\n  <a\n    href="/menu" // client-nav-allow: full reload is the recovery after a crash\n    className="x"\n  >\n    Back\n  </a>\n);\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("quarantine and e2e are not scanned", () => {
  const r = runGate({
    "components/quarantine/Old.tsx": `export const C = () => <a href="/menu">Menu</a>;\n`,
  });
  assert.equal(r.code, 0, `expected pass, got:\n${r.output}`);
});

test("the real storefront passes", () => {
  // A gate that ships red gets an allow-list on day one.
  const out = execFileSync(process.execPath, ["--experimental-strip-types", GATE, STOREFRONT], {
    encoding: "utf8",
  });
  assert.match(out, /every internal link goes through the router/);
});

// ── The fixes themselves ─────────────────────────────────────────────────────

test("the cart's checkout button goes through the router, and prefetches", () => {
  // The money-path entry, and the one link where the next step is near-certain:
  // it renders in an open cart drawer with items in it. Everywhere else the
  // default is right — a menu of ~100 dishes would fire one full RSC render per
  // visible card if each one prefetched eagerly.
  const src = fs.readFileSync(path.join(STOREFRONT, "components/cart/CartDrawer.tsx"), "utf8");
  assert.match(src, /<Link href="\/checkout\?mode=alacarte" prefetch>/);
});

test("no other link opts into eager prefetch without saying why", () => {
  // `prefetch` on a dynamic route fetches the full RSC payload. Sprinkled
  // across a grid that is load on the API server, paid for every card a
  // customer scrolls past and never taps.
  const eager: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!["node_modules", ".next", "quarantine", "e2e"].includes(e.name)) walk(abs);
      } else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) {
        const src = fs.readFileSync(abs, "utf8");
        if (/<Link[^>]*\sprefetch(\s|>|=\{true\})/s.test(src)) eager.push(path.relative(STOREFRONT, abs));
      }
    }
  };
  for (const sub of ["app", "components"]) walk(path.join(STOREFRONT, sub));
  assert.deepEqual(eager, ["components/cart/CartDrawer.tsx"]);
});

test("the error boundary keeps its raw anchor, with the reason on the line", () => {
  // A <Link> here would client-navigate with the broken tree still mounted,
  // back into a router that may be what threw. The marker is what tells the
  // next person that is deliberate rather than one the sweep missed.
  const src = fs.readFileSync(path.join(STOREFRONT, "components/SegmentError.tsx"), "utf8");
  assert.match(src, /client-nav-allow:/);
  assert.match(src, /<a\s/);
});
