/**
 * FSSAI-claim accuracy gate (source pin, DB-free).
 *
 * The certificate on file (FBO: Anuradha, No. 22725926001018, premises:
 * Hajipur, Sector 104, Noida) is an FSSAI *Registration* under the FSS Act,
 * 2006 — the petty-FBO tier. A Registration and a Licence are distinct
 * instruments under the Licensing and Registration of Food Businesses
 * Regulations, and displaying "Licence" against a Registration number is a
 * false declaration (§61 of the Act). The 2026-08-29 sweep moved every
 * user-facing surface to "registered"/"Reg. No."; this test keeps the next
 * landing page or checkout trust line from quietly reintroducing the claim
 * we do not hold.
 *
 * Scope: user-facing source only — content/, components/, app/ (quarantine/
 * is non-live and keeps its historical copy). Comments in lib/ are not
 * customer claims and are not scanned.
 *
 * Run: node --test --import tsx ./lib/fssaiClaims.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPANY } from "../content/legal/company";
import { SITE } from "./nav";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCANNED = ["content", "components", "app"] as const;

/** "FSSAI licensed", "FSSAI-licensed", "FSSAI Licence No.", "FSSAI Lic." —
 *  any spelling of a licence claim tied to the FSSAI mark. At least one
 *  separator is required after "FSSAI" so the `fssaiLicenseNo` wire/DB field
 *  name — which deliberately keeps its historical spelling — never matches. */
const BANNED = /FSSAI[\s-]+licen[sc]/i;
const BANNED_ABBREV = /FSSAI\s+Lic\./i;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "quarantine" || name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test("no user-facing source claims an FSSAI licence — the certificate is a Registration", () => {
  const offenders: string[] = [];
  for (const base of SCANNED) {
    for (const file of walk(join(ROOT, base))) {
      const src = readFileSync(file, "utf8");
      if (BANNED.test(src) || BANNED_ABBREV.test(src)) {
        offenders.push(relative(ROOT, file));
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `FSSAI "licence/licensed" claim found — the certificate on file is a ` +
      `Registration; say "FSSAI-registered" / "FSSAI Reg. No." instead: ${offenders.join(", ")}`,
  );
});

test("the registration number matches the certificate everywhere it is declared", () => {
  const CERT_NO = "22725926001018";
  assert.equal(COMPANY.fssaiLicenseNo, CERT_NO);
  assert.equal(SITE.fssai, CERT_NO);
});

test("the footer's fallback address stays in lockstep with the legal pages' registeredOffice", () => {
  // Footer renders company?.registeredOffice ?? SITE.address; the two bundled
  // sources must agree or the footer and the grievance/privacy pages drift.
  assert.equal(SITE.address, COMPANY.registeredOffice);
});

test("the business address names the licensed premises' locality (Hazipur, Sector 104, Noida)", () => {
  for (const needle of ["237", "Hazipur", "Sector 104", "Noida"]) {
    assert.ok(
      COMPANY.registeredOffice.includes(needle),
      `registeredOffice must carry "${needle}" — got: ${COMPANY.registeredOffice}`,
    );
  }
});
