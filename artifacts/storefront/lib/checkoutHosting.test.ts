import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The thesis of this consolidation, pinned as a gate: **every money path ends
 * on /checkout.**
 *
 * Before it, five surfaces took money and only two of them were the checkout.
 * The pantry PDP, /premium and the RD booking card each opened the Razorpay
 * modal where they stood, each with its own auth gate, its own retry rules and
 * its own answer to a captured-but-unverified payment — and two of the three
 * had no answer at all, so a verify blip re-enabled a pay button over money
 * that had already left the customer's account.
 *
 * Nothing about that is visible to a type-checker, and it only shows up when a
 * payment actually fails. The invariant is what gets pinned: the browser
 * gateway is opened from ONE directory, and every CTA that starts a purchase
 * builds its link through lib/checkoutIntent.
 *
 * Parsed rather than rendered, matching paymentFailureParity.test.ts and
 * moneyFunnel.test.ts — these are client components behind "@/" aliases and the
 * storefront's node --test suite has no DOM.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const CHECKOUT_DIR = path.join("components", "checkout");

/** Source with comments removed. Several of these files carry a comment
 *  explaining the URL they USED to hand-write, and that history is worth
 *  keeping — but only the code is the thing under test. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const SOURCES = [...walk(path.join(ROOT, "components")), ...walk(path.join(ROOT, "app"))].map(
  (full) => [path.relative(ROOT, full), fs.readFileSync(full, "utf8")] as const,
);

test("the payment gateway is opened from components/checkout and nowhere else", () => {
  const openers = SOURCES.filter(([, src]) => src.includes("createRazorpayAdapter(")).map(
    ([rel]) => rel,
  );
  assert.ok(openers.length > 0, "expected at least one gateway call site — did the import move?");
  const strays = openers.filter((rel) => !rel.startsWith(CHECKOUT_DIR));
  assert.deepEqual(
    strays,
    [],
    `these open the pay modal outside the checkout: ${strays.join(", ")}. ` +
      "Route the purchase to /checkout via lib/checkoutIntent instead.",
  );
});

test("no surface outside the checkout calls a verify endpoint", () => {
  // The other half of the same rule. A component that verifies is a component
  // that has taken money, wherever it opened the modal.
  const verifiers = SOURCES.filter(([, src]) =>
    /\b(verifyPayment|verifyPremium|verifyAppointment|retryVerifyPayment)\s*\(/.test(src),
  ).map(([rel]) => rel);
  const strays = verifiers.filter((rel) => !rel.startsWith(CHECKOUT_DIR));
  assert.deepEqual(strays, [], `these verify a payment outside the checkout: ${strays.join(", ")}`);
});

test("every /checkout link is built by lib/checkoutIntent, not hand-written", () => {
  // A hand-written query string is how the five paths drifted apart in the
  // first place: each invented its own parameters and its own validation.
  // `checkoutHref` is the one place that vocabulary lives.
  const handWritten = SOURCES.filter(
    ([rel, src]) =>
      // The checkout page itself redirects to its own à-la-carte leg, which is
      // a route-level fallback rather than a purchase CTA.
      rel !== path.join("app", "(focus)", "checkout", "page.tsx") &&
      /href=["'`]\/checkout|push\(["'`]\/checkout|push\(`\/checkout/.test(code(src)),
  ).map(([rel]) => rel);
  assert.deepEqual(
    handWritten,
    [],
    `these hand-write a /checkout URL: ${handWritten.join(", ")}. Use checkoutHref().`,
  );
});

test("the three folded-in surfaces no longer run a money path themselves", () => {
  // Named explicitly, because a regression here would be someone re-adding the
  // convenience of paying "right where the customer already is" — which is
  // exactly how each of these came to have its own broken failure handling.
  for (const rel of [
    path.join("components", "marketplace", "MarketplaceBuyNow.tsx"),
    path.join("components", "premium", "PremiumMembership.tsx"),
    path.join("components", "rd", "RdBooking.tsx"),
  ]) {
    const entry = SOURCES.find(([r]) => r === rel);
    assert.ok(entry, `${rel} not found — update this list if it moved`);
    assert.doesNotMatch(code(entry[1]), /razorpay/i, `${rel} must not touch the gateway`);
    assert.match(entry[1], /checkoutHref/, `${rel} must route its purchase to /checkout`);
  }
});
