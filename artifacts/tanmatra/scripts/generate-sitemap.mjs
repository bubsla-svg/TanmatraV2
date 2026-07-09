/**
 * Build-time sitemap generator.
 *
 * Walks build/client for prerendered per-route index.html files — the ground truth
 * of what actually serves real HTML — and emits sitemap.xml containing only
 * pages that do NOT declare `robots ... noindex` in their meta. Because the
 * input is the build output itself, the sitemap can never advertise a URL
 * that serves the SPA fallback, and never omits a prerendered page.
 *
 * Runs as part of `pnpm build` (see package.json).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://tanmatra.food";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "build", "client");

const pages = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (name === "index.html") {
      pages.push(full);
    }
  }
}
walk(ROOT);

const NOINDEX_RE = /name="robots"[^>]*content="[^"]*noindex|content="[^"]*noindex[^"]*"[^>]*name="robots"/i;

const urls = [];
for (const file of pages) {
  const html = readFileSync(file, "utf-8");
  if (NOINDEX_RE.test(html)) continue;
  const rel = relative(ROOT, file).split(sep).slice(0, -1).join("/");
  const path = rel ? `/${rel}` : "/";
  // Simple priority model: home > listing pages > detail pages.
  const depth = path === "/" ? 0 : path.split("/").length - 1;
  const priority = path === "/" ? "1.0" : depth === 1 ? "0.8" : "0.6";
  const changefreq = path === "/" || path === "/menu" ? "daily" : depth === 1 ? "weekly" : "monthly";
  urls.push({ loc: `${ORIGIN}${path}`, priority, changefreq });
}

urls.sort((a, b) => a.loc.localeCompare(b.loc));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

writeFileSync(join(ROOT, "sitemap.xml"), xml);
console.log(`sitemap.xml: ${urls.length} indexable URLs (from ${pages.length} prerendered pages)`);
