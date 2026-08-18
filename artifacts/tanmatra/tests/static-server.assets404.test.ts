/**
 * The static server must tell the truth about missing FILES.
 *
 * It serves a SPA, so a missing client ROUTE correctly returns the shell with
 * 200 — that is how deep links survive a reload. The bug was applying that
 * same rule to assets: a request for a JPEG that is not in the container also
 * got `200 text/html`, which tells the browser, any CDN in front, and every
 * monitor that the file exists.
 *
 * That is not hypothetical. On 2026-08-18 all 63 dish photographs the live
 * catalog serves from this origin were missing from the deployed image, and
 * every one answered 200 with 8464 bytes of index.html. The storefront's
 * SafeImage contract degraded to its branded tile, so the pages looked
 * intentional and nothing reported anything. See docs/IMAGE-ASSET-STRATEGY.md.
 *
 * Both halves are asserted here, because the fix is only safe if deep links
 * keep working — a 404 on /menu would be a far worse bug than the one being
 * fixed.
 *
 * Run with:
 *   node --test --import tsx ./tests/static-server.assets404.test.ts
 */
import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import type { AddressInfo } from "node:net";

let child: ChildProcess;
let base = "";
let tmp = "";

before(async () => {
  // The server resolves its docroot as ./public next to the script, so build a
  // throwaway tree with a copy of the script rather than mutating the repo's.
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tanmatra-static-"));
  const pub = path.join(tmp, "public");
  fs.mkdirSync(path.join(pub, "images", "dishes"), { recursive: true });
  fs.writeFileSync(path.join(pub, "index.html"), "<!DOCTYPE html><title>home</title>");
  fs.writeFileSync(path.join(pub, "__spa-fallback.html"), "<!DOCTYPE html><title>spa shell</title>");
  fs.writeFileSync(path.join(pub, "images", "dishes", "present.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xdb]));
  fs.copyFileSync(
    path.resolve(import.meta.dirname, "../server/static-server.mjs"),
    path.join(tmp, "static-server.mjs"),
  );

  // Port 0 is not supported by the server (it reads PORT), so pick a free one.
  const probe = http.createServer();
  await new Promise<void>((r) => probe.listen(0, "127.0.0.1", () => r()));
  const port = (probe.address() as AddressInfo).port;
  await new Promise<void>((r) => probe.close(() => r()));

  child = spawn(process.execPath, [path.join(tmp, "static-server.mjs")], {
    env: { ...process.env, PORT: String(port), API_UPSTREAM: "" },
    stdio: "ignore",
  });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${base}/`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("static server never came up");
});

after(() => {
  child?.kill();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

test("a MISSING image is a real 404, not the SPA shell", async () => {
  const res = await fetch(`${base}/images/dishes/definitely-absent.jpg`);
  assert.equal(res.status, 404, "a missing asset must not report success");
  const body = await res.text();
  assert.ok(!/spa shell/i.test(body), "must not return the SPA shell for an asset");
});

test("a PRESENT image is still served, with its real content type", async () => {
  const res = await fetch(`${base}/images/dishes/present.jpg`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/jpeg");
});

test("SPA deep links still return the shell with 200 — the fix must not break routing", async () => {
  // This is the assertion that makes the change safe. A 404 here would break
  // every deep link into the app.
  for (const route of ["/menu", "/dish/signature-quinoa-salad", "/account/orders"]) {
    const res = await fetch(`${base}${route}`);
    assert.equal(res.status, 200, `${route} must still serve the SPA shell`);
    assert.match(await res.text(), /spa shell/i, `${route} should be the shell`);
  }
});

test("a route containing a dot is still a route, not an asset", async () => {
  // Extension matching is deliberately allow-listed. A slug like `foo.bar` has
  // an "extension" of `bar`, which is not an asset type, so it must still
  // route rather than 404.
  const res = await fetch(`${base}/dish/some.unusual-slug`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /spa shell/i);
});

test("missing assets of every kind 404 — not just images", async () => {
  for (const p of [
    "/assets/absent.js",
    "/assets/absent.css",
    "/fonts/absent.woff2",
    "/absent.json",
    "/downloads/absent.pdf",
  ]) {
    const res = await fetch(`${base}${p}`);
    assert.equal(res.status, 404, `${p} should 404`);
  }
});

test("a missing .html page still falls through to the shell", async () => {
  // Deliberately NOT treated as an asset: a prerendered page that did not get
  // generated should still hydrate the right route rather than hard-404.
  const res = await fetch(`${base}/some-prerendered-page.html`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /spa shell/i);
});
