/**
 * WhatsApp is the support channel (owner, 2026-09-06).
 *
 * The storefront used to offer exactly one way to reach a human — a `mailto:`
 * on /faq pointing at the grievance inbox. This pins the replacement: one
 * derived URL, no second address for it to drift from, and no surface quietly
 * putting the email back as the way to get help.
 *
 * Relative imports, not "@/…": lint:filecap blocks the path alias inside lib/
 * because the bare node test runner cannot resolve it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPANY, SUPPORT_WHATSAPP_URL } from "../content/legal/company";

const HERE = path.dirname(fileURLToPath(import.meta.url));

test("the WhatsApp link is derived from the number the legal pages print", () => {
  // Typing the number a second time is how the two would part company. wa.me
  // takes digits only — no "+", spaces or dashes.
  assert.equal(SUPPORT_WHATSAPP_URL, `https://wa.me/${COMPANY.supportPhone.replace(/\D/g, "")}`);
  assert.match(SUPPORT_WHATSAPP_URL, /^https:\/\/wa\.me\/\d{10,15}$/);
});

test("/faq offers WhatsApp, not an inbox", () => {
  const src = fs.readFileSync(path.join(HERE, "..", "app", "(global)", "faq", "page.tsx"), "utf8");
  assert.match(src, /SUPPORT_WHATSAPP_URL/, "the support CTA must use the shared constant");
  assert.doesNotMatch(src, /mailto:/, "email is no longer the support channel");
});

test("no customer surface offers a mailto: as support", () => {
  const roots = [path.join(HERE, "..", "app"), path.join(HERE, "..", "components")];
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "quarantine") continue;
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      if (/mailto:/.test(fs.readFileSync(full, "utf8"))) offenders.push(path.relative(HERE, full));
    }
  };
  for (const r of roots) walk(r);
  assert.deepEqual(offenders, [], `link SUPPORT_WHATSAPP_URL instead: ${offenders.join(", ")}`);
});
