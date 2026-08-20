/**
 * Generates docs/RATE-LIMITS.md from the source of truth.
 *
 * Why generated rather than written: the 2026-08-18 architecture audit shipped
 * a hand-written rate-limit table in which nearly every number was wrong — menu
 * described as unlimited (it is 120/min), orders as 10/hour (30/min), the AI
 * routes as 20/day (20/min), a subscriptions/checkout limiter that does not
 * exist, and a guest tier that the code explicitly contradicts. A table like
 * that is worse than no table: it reads as authoritative and it is consulted
 * during incidents. The only durable fix is to stop writing the numbers down.
 *
 * Usage:
 *   node --experimental-strip-types scripts/gen-rate-limits-doc.ts          # write
 *   node --experimental-strip-types scripts/gen-rate-limits-doc.ts --check  # CI
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MW = path.join(REPO, "artifacts/api-server/src/middlewares/rateLimitMiddleware.ts");
const APP = path.join(REPO, "artifacts/api-server/src/app.ts");
const OUT = path.join(REPO, "docs/RATE-LIMITS.md");

interface Limiter {
  name: string;
  scope: string;
  max: string;
  windowMs: string;
  failClosed: boolean;
}

/** Evaluate the simple numeric-literal arithmetic these windows are written
 *  as (`60_000`, `24 * 60 * 60_000`). Deliberately NOT a general expression
 *  evaluator: it accepts digits, underscores, `*` and whitespace and nothing
 *  else, so a window written as anything more interesting falls through to the
 *  raw text rather than being silently mis-evaluated. */
function evalWindow(expr: string): number {
  if (!/^[\d_\s*]+$/.test(expr)) return NaN;
  return expr
    .replace(/_/g, "")
    .split("*")
    .map((t) => Number(t.trim()))
    .reduce((a, b) => (Number.isFinite(a) && Number.isFinite(b) ? a * b : NaN), 1);
}

function human(ms: string): string {
  const n = evalWindow(ms);
  if (!Number.isFinite(n)) return `\`${ms}\``;
  if (n % 86_400_000 === 0) return `${n / 86_400_000} day`;
  if (n % 3_600_000 === 0) return `${n / 3_600_000} hour`;
  if (n % 60_000 === 0) return `${n / 60_000} min`;
  return `${n} ms`;
}

const mwSrc = fs.readFileSync(MW, "utf8");

/** PLAN_DRAFT_LIMITS.x is a getter that re-reads an env var on every request,
 *  so the literal in the call site is a symbol, not a number. Resolve it to the
 *  documented default and say so, rather than printing the symbol. */
const planDefaults = new Map<string, string>();
{
  const block = mwSrc.split("PLAN_DRAFT_LIMIT_DEFAULTS = {")[1]?.split("} as const;")[0] ?? "";
  for (const m of block.matchAll(/^\s*(\w+):\s*(\d+),/gm)) planDefaults.set(m[1]!, m[2]!);
}
function resolveMax(raw: string): string {
  const m = raw.match(/^PLAN_DRAFT_LIMITS\.(\w+)$/);
  if (m && planDefaults.has(m[1]!)) return `${planDefaults.get(m[1]!)} _(default)_`;
  return raw.replace(/_/g, "");
}

// `export const NAME = rateLimitMiddleware("scope", MAX, WINDOW, { ...opts })`
// The options object is optional and may span lines; capture up to the closing
// paren of the call.
const limiters: Limiter[] = [];
const re =
  /export const (\w+)\s*=\s*rateLimitMiddleware\(\s*"([^"]+)"\s*,\s*([^,]+?)\s*,\s*([^,)]+?)\s*(?:,\s*(\{[\s\S]*?\}))?\s*,?\s*\)/g;
for (const m of mwSrc.matchAll(re)) {
  limiters.push({
    name: m[1]!,
    scope: m[2]!,
    max: m[3]!.trim(),
    windowMs: m[4]!.trim(),
    failClosed: /failClosed:\s*true/.test(m[5] ?? ""),
  });
}

// `app.use("/api/x", someRateLimit);`
const appSrc = fs.readFileSync(APP, "utf8");
const mounts = new Map<string, string[]>();
for (const m of appSrc.matchAll(/app\.use\(\s*"([^"]+)"\s*,\s*(\w*[Rr]ate[Ll]imit\w*)\s*\)/g)) {
  const list = mounts.get(m[2]!) ?? [];
  list.push(m[1]!);
  mounts.set(m[2]!, list);
}

const rows = limiters
  .map((l) => {
    const paths = mounts.get(l.name) ?? [];
    // paymentRouteRateLimit wraps paymentRateLimit; surface the wrapper's mount.
    const mounted =
      paths.length > 0
        ? paths.map((p) => `\`${p}\``).join(", ")
        : l.name === "paymentRateLimit"
          ? (mounts.get("paymentRouteRateLimit") ?? []).map((p) => `\`${p}\``).join(", ") ||
            "_route-level only_"
          : "_route-level only_";
    return `| \`${l.scope}\` | ${mounted} | ${resolveMax(l.max)} | ${human(l.windowMs)} | ${l.failClosed ? "**closed**" : "open"} | \`${l.name}\` |`;
  })
  .join("\n");

const doc = `# API rate limits

<!-- GENERATED FILE — DO NOT EDIT BY HAND.
     Source: artifacts/api-server/src/middlewares/rateLimitMiddleware.ts
             artifacts/api-server/src/app.ts
     Regenerate: pnpm run docs:rate-limits
     Verified in CI: pnpm run docs:rate-limits:check -->

Every number here is read out of the source at generation time. Do not edit
this file — change the limiter and regenerate, or the two will disagree and CI
will say so.

## How a bucket is keyed

Limiters are keyed on **client IP** by default. Authenticated and anonymous
callers therefore **share one counter per IP** — there is no separate, looser
or tighter tier for signed-in users. A few limiters override this to key per
user or per session where that matters; \`orders:claim\` is keyed per session
specifically so an attacker cannot buy more attempts by changing networks.

Two edge guards sit in front of all of this and are not per-scope:
\`routeBurstGuard(30)\` (30 req/s per IP per endpoint, disabled under
\`NODE_ENV=test\`) and \`concurrencyGuardMiddleware(250)\`.

## When the limiter itself cannot run

The store is Postgres. If the check throws — unreachable, statement timeout,
pool exhausted — each limiter resolves according to its **fail** column:

- **open** — admit the request. Correct for public reads: serving the menu
  through a database blip is worth more than the scraping it lets through.
- **closed** — answer \`429\` with \`Retry-After\`. Correct for money and
  mutating routes. Not because money is important, but because of a specific
  failure shape: a total outage is not the interesting case (the handler needs
  the same database, so the request was going to fail anyway), whereas partial
  degradation lets handlers keep partly working while the limiter throws —
  removing the brake exactly as a flood causes the degradation.

## Limits

| Scope | Mounted on | Max | Window | Fail | Export |
|---|---|---:|---|---|---|
${rows}

A refused request is rejected **before** the handler runs, so a 429 can never
have partially mutated anything.

\`/api/payments/razorpay/webhook\` is exempt from the payments limiter
entirely: it is authenticated by HMAC signature and arrives from Razorpay's own
small source-IP pool, so without the exemption every customer's payment
confirmation would share one browser-sized bucket.
`;

if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== doc) {
    console.error(
      "docs/RATE-LIMITS.md is stale — a limiter changed without regenerating.\n" +
        "Run: pnpm run docs:rate-limits",
    );
    process.exit(1);
  }
  console.log(`✓ docs/RATE-LIMITS.md matches source (${limiters.length} limiters)`);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, doc);
  console.log(`wrote docs/RATE-LIMITS.md (${limiters.length} limiters)`);
}
