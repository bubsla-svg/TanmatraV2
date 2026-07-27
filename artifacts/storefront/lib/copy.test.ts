import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  orderStatusValues,
  statusLabels,
  cancellationSnippets,
  taxDisclosureCopy,
  skipCutoffCopy,
  creditExpiryCopy,
  fmt,
  corporateCopy,
  premiumCopy,
  subscriptionCopy,
} from "../content/copy";

test("CP-0 Copy Foundation — Vocabulary Membership Exhaustiveness", () => {
  const labelKeys = Object.keys(statusLabels);
  assert.equal(
    labelKeys.length,
    orderStatusValues.length,
    `statusLabels key count (${labelKeys.length}) does not match orderStatusValues count (${orderStatusValues.length})`
  );

  for (const status of orderStatusValues) {
    assert.ok(
      statusLabels[status],
      `orderStatusValues member "${status}" is missing from statusLabels map`
    );
    assert.ok(
      statusLabels[status].label && statusLabels[status].label.trim().length > 0,
      `statusLabels["${status}"].label is empty`
    );
  }
});

test("CP-0 Copy Foundation — Banned Strings Scanner", () => {
  const copyDir = path.join(process.cwd(), "..", "storefront", "content", "copy");
  const files = fs.readdirSync(copyDir).filter((f) => f.endsWith(".ts"));

  const globalBannedRegexes: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /₹[0-9]/, name: "Rupee symbol with hardcoded price literal" },
    { pattern: /1,?499/, name: "Legacy trial 1,499 price literal" },
    { pattern: /10\s?pm/i, name: "Hardcoded 10 PM cutoff drift in domain files (must use policy.ts)" },
    { pattern: /&#\d+;/, name: "Numeric HTML entity" },
    { pattern: /\boops\b/i, name: "Informal 'oops' error wording" },
    { pattern: /pure veg/i, name: "Unapproved 'pure veg' claim" },
    { pattern: /\bNV\b/, name: "Unapproved 'NV' abbreviation" },
  ];

  for (const file of files) {
    if (file === "policy.ts") continue; // policy.ts is the single authorized source for cutoff times
    const filePath = path.join(copyDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    for (const { pattern, name } of globalBannedRegexes) {
      assert.equal(
        pattern.test(content),
        false,
        `File ${file} contains banned pattern [${name}]: matches ${pattern}`
      );
    }
  }

  // Scoped check for subscription.ts: no coupon/voucher wording
  const subPath = path.join(copyDir, "subscription.ts");
  const subContent = fs.readFileSync(subPath, "utf-8");
  assert.equal(
    /\b(coupon|voucher)\b/i.test(subContent),
    false,
    "subscription.ts contains forbidden coupon/voucher wording"
  );
});

test("CP-0 Copy Foundation — [LOCKED] Verbatim Snippet Integrity", () => {
  assert.equal(
    cancellationSnippets.beforeCutoff,
    "Cancel anytime before cutoff for a 100% refund to your original payment method.",
    "beforeCutoff cancellation snippet modified"
  );
  assert.equal(
    cancellationSnippets.afterCutoff,
    "Cancellations after 10:00 PM cutoff cannot be refunded as meal preparation has already begun.",
    "afterCutoff cancellation snippet modified"
  );
  assert.equal(
    taxDisclosureCopy,
    "No platform fee. No surge. Prices include all taxes.",
    "taxDisclosureCopy modified"
  );
  assert.equal(
    skipCutoffCopy,
    "Orders for tomorrow close at 10:00 PM tonight. Any changes made after cutoff apply to the following delivery.",
    "skipCutoffCopy modified"
  );
  assert.equal(
    creditExpiryCopy,
    "Unused meal credits expire 30 days after issuance.",
    "creditExpiryCopy modified"
  );
});

test("CP-0 Copy Foundation — fmt() Interpolation Utility", () => {
  const result = fmt("Hello {name}, your order #{orderId} is confirmed.", {
    name: "Aarav",
    orderId: 1042,
  });
  assert.equal(result, "Hello Aarav, your order #1042 is confirmed.");

  assert.throws(
    () => fmt("Missing token {missing}", {}),
    /Missing required token "missing"/,
    "fmt() must throw on missing token"
  );

  const passthrough = fmt("No tokens here", {});
  assert.equal(passthrough, "No tokens here");
});

test("CP-0 Copy Foundation — Null-leaf Collapse For [OWNER] Gates", () => {
  assert.equal(corporateCopy.slaLeaf, null, "corporateCopy.slaLeaf must remain null until owner SLA gate closes");
  assert.equal(premiumCopy.ownerPerksLeaf, null, "premiumCopy.ownerPerksLeaf must remain null until owner entitlements gate closes");
});
