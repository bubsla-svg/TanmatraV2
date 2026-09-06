import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { formatPaise } from "./format";
import { deriveHeroContent } from "./heroContent";
import { PLAN_PRICE_TABLE } from "@workspace/subscription-rules";

const basePrice = formatPaise(PLAN_PRICE_TABLE.desk_fuel.veg.perMealPaise!);

// These two assert ROUTING — which cookie class reaches which variant — not
// the wording, which is marketing's to change. The referral variant is pinned
// by the badge and by being distinct, NOT by naming its source: it used to
// assert /dietitian/i on the eyebrow, and the storefront no longer names that
// profession anywhere (owner, 2026-09-06). The gym variant still names its
// source because "gym" is not a claim about us.
const referralHero = deriveHeroContent("rd_sharma");
const gymHero = deriveHeroContent("gym_cult");

test("a referral cookie yields the referral hero, whatever profession sent it", () => {
  for (const ref of ["rd_sharma", "dietitian_kaur", "apollo_clinic", "dr_mehta", "DIET_partner"]) {
    const hero = deriveHeroContent(ref);
    assert.deepEqual(hero, referralHero, `${ref} should reach the referral variant`);
    assert.ok(hero.badge, "a referred visitor gets a badge on the hero photo");
  }
});

/**
 * The cookie prefixes still say `rd_` / `dietitian_` — they are attribution
 * keys in links already in the wild. What must never come back is that
 * vocabulary in the COPY: the storefront claims no dietitian (owner,
 * 2026-09-06), and a hero is the loudest place it could reappear.
 */
test("no hero variant renders dietitian vocabulary in its copy", () => {
  for (const ref of [undefined, "rd_sharma", "dietitian_kaur", "gym_cult", "utm_facebook"]) {
    const hero = deriveHeroContent(ref);
    const copy = [hero.eyebrow, hero.headline, hero.blurb, hero.badge ?? ""].join(" ");
    assert.doesNotMatch(copy, /dietitian|nutritionist|\bRDs?\b/i, `${ref} leaks a dietitian claim: ${copy}`);
  }
});

test("a gym/trainer referral cookie yields the training hero", () => {
  for (const ref of ["gym_cult", "trainer_47", "fitfirst", "coach_raj"]) {
    const hero = deriveHeroContent(ref);
    assert.deepEqual(hero, gymHero, `${ref} should reach the training variant`);
    assert.match(hero.eyebrow, /gym/i, "the eyebrow must name the referral source");
    assert.ok(hero.badge, "a referred visitor gets a badge on the hero photo");
  }
});

test("the three variants are actually different copy, not the same hero thrice", () => {
  const variants = [deriveHeroContent(), referralHero, gymHero];
  const headlines = new Set(variants.map((v) => v.headline));
  assert.equal(headlines.size, 3, "personalisation that renders identical copy is not personalisation");
});

test("no cookie, an empty cookie and an unrecognised cookie all fall back to the default hero", () => {
  const expected = deriveHeroContent();
  assert.equal(expected.badge, null);
  for (const ref of ["", "utm_facebook", "referral"]) {
    assert.deepEqual(deriveHeroContent(ref), expected, `${JSON.stringify(ref)} must not personalise`);
  }
});

test("every variant quotes the price from PLAN_PRICE_TABLE, never a literal", () => {
  for (const ref of [undefined, "rd_sharma", "gym_cult"]) {
    assert.ok(
      deriveHeroContent(ref).blurb.includes(basePrice),
      "hero copy must render the table price so a price change cannot leave stale copy behind",
    );
  }
});

// The regression this module exists for. deriveHeroContent used to be exported
// from components/landing/Section01ClinicalHero.tsx, which is a "use client"
// module; app/page.tsx is a Server Component and calls it. That combination
// builds fine and works in dev, then throws "Attempted to call
// deriveHeroContent() from the server" and 500s / in a production build.
// Nothing in the type system catches it, so pin it here.
test("the module stays server-safe — no 'use client' in it or anything it imports", () => {
  const here = path.dirname(new URL(import.meta.url).pathname);
  for (const file of ["heroContent.ts", "format.ts"]) {
    const src = readFileSync(path.join(here, file), "utf8");
    assert.ok(
      !/^\s*["']use client["']/m.test(src),
      `lib/${file} must not be a client module — app/page.tsx calls into it from the server`,
    );
  }
});
