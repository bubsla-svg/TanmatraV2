/**
 * WCAG 2.2 SC 2.5.8 Target Size (Minimum) — the five controls the frontend
 * audit measured under 24 CSS px.
 *
 * Pinned by source rather than by pixel because the pixel test needs a browser
 * and a build (the audit harness in e2e/ is where that belongs). What a source
 * test CAN do is stop the regression that actually happened: a standalone text
 * link written with no vertical box of its own, whose rendered height is
 * exactly its line-height, and which looks completely normal in a diff. Every
 * case below names the measured size it replaces.
 *
 * ONE MINIMUM, NOT TWO. `globals.css` already owns `.touch-target-min` (44px)
 * and `.touch-target-critical` (48px, for money-path controls where a mis-tap
 * costs an order). The first draft of this fix introduced a `--tap-min: 24px`
 * token in parallel with them — a second, WEAKER standard, which is worse than
 * either alone: two answers to "how big must a target be" and no way to tell
 * from a call site which one applies. The last test here is the guard against
 * repeating that.
 *
 * Run: node --test --import tsx ./lib/tapTargets.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";

const read = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");

/** The files this fix touched with a class. */
const FIXED = [
  "../app/(global)/page.tsx",
  "../components/landing/SectionTrialPush.tsx",
  "../components/menu/DishDrawer.tsx",
];

test("the house minimum clears the conformance floor", () => {
  const css = read("../app/globals.css");
  const rule = /\.touch-target-min\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.ok(rule, ".touch-target-min must exist — every fix below leans on it");
  const h = /min-height:\s*(\d+)px/.exec(rule);
  assert.ok(h && Number(h[1]) >= 24, `SC 2.5.8 floor is 24px; the utility is ${h?.[1]}px`);
  // A min-height with nothing to lay the text out against leaves the label at
  // the top of a taller box instead of centred in it.
  assert.match(rule, /display:\s*inline-flex/);
  assert.match(rule, /align-items:\s*center/);
});

test('landing "View menu" has a box of its own (was 81×16)', () => {
  const src = read("../app/(global)/page.tsx");
  // Matches <a> or <Link>: this assertion is about the tap target, not the
  // element. It went red when 3.2 converted the anchor to a router link, which
  // is the test doing its job — but pinning the tag was never the point.
  const link = /<(?:a|Link)\s[^>]*href="\/menu"[\s\S]*?>\s*View menu/.exec(src)?.[0] ?? "";
  assert.ok(link, "the rail header still links to the menu");
  assert.match(link, /touch-target-min/);
});

test('landing "Or see monthly plans" has a box of its own (was 328×20)', () => {
  const src = read("../components/landing/SectionTrialPush.tsx");
  const link = /<Link[\s\S]*?>\s*Or see monthly plans/.exec(src)?.[0] ?? "";
  assert.ok(link, "the secondary door out of the trial band still exists");
  assert.match(link, /touch-target-min/);
  // The utility is inline-flex, which shrink-wraps. Without w-full this link
  // stops filling its column and the centred full-width look is lost.
  assert.match(link, /\bw-full\b/);
});

test('drawer "Open full page" has a box of its own (was 93×20)', () => {
  // It shares the drawer footer with the Add button — the densest row on that
  // surface, so an undersized target here is also the easiest to mis-tap.
  const src = read("../components/menu/DishDrawer.tsx");
  const link = /<Link[\s\S]*?>\s*Open full page/.exec(src)?.[0] ?? "";
  assert.ok(link, "the drawer still offers the full page");
  assert.match(link, /touch-target-min/);
});

test("the dish page's accordion triggers get real padding (were 380×17)", () => {
  // These two are not links and cannot take the utility: Astryx's Collapsible
  // owns its button. It resolves `paddingBlock: 0` unless the GROUP sets a
  // density, so both triggers were exactly their capsize-trimmed text.
  // `balanced` is spacing-2 either side → 33px, which clears the SC 2.5.8
  // floor the audit measured against. It does NOT reach the house 44px, and
  // the library offers nothing that does (`spacious` is 41px) — overriding the
  // button's padding from outside would fight the component, so this is the
  // best its own API gives.
  const src = read("../app/(focus)/dish/[slug]/page.tsx");
  const group = /<CollapsibleGroup[^>]*>/.exec(src)?.[0] ?? "";
  assert.ok(group, "the dish page still groups its detail sections");
  assert.match(group, /density=/, "without a density the triggers collapse to text height again");
  assert.doesNotMatch(group, /density="?\{?"?compact/, "compact leaves 1px over the AA floor");
});

test("there is exactly one tap-target minimum in the codebase", () => {
  // The guard against the mistake this fix made on its first pass. Two
  // standards is worse than either: nothing at a call site says which applies,
  // and the weaker one silently becomes the real one wherever it is reached
  // for. A new tier belongs in globals.css beside the existing two, named for
  // WHY it differs — `touch-target-critical` earns its 48px by naming the
  // money path — not as a loose token somebody can point a class at.
  assert.doesNotMatch(read("../../../lib/tokens/src/tokens.css"), /tap-min/);
  for (const rel of FIXED) {
    assert.doesNotMatch(read(rel), /min-h-\[\d+px\]|min-h-\[var\(/, `${rel} restates a minimum`);
  }
});
