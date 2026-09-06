import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATTRIBUTION_PATTERN,
  CLAIM_PATTERN,
  COPY_FIELDS,
  buildPlan,
  claimFields,
  rewriteCopy,
  verifyPostState,
  type DbCopyRow,
} from "./honestClaimsPlan";

function row(over: Partial<DbCopyRow> = {}): DbCopyRow {
  return {
    slug: "dish",
    archived: false,
    name: "Grilled chicken",
    description: "Lean grilled chicken breast.",
    longDescription: null,
    seoTitle: null,
    seoDescription: null,
    badge: null,
    ...over,
  };
}

test("the vocabulary matches the claims and not the words that contain them", () => {
  for (const yes of [
    "RD-formulated for high protein muscle recovery.",
    "RD-reviewed kitchen",
    "Designed by our dietitians",
    "an accredited nutritionist",
    "Answered by our RDs",
    "Talk to an RD",
  ]) {
    assert.ok(CLAIM_PATTERN.test(yes), `should match: ${yes}`);
  }
  // The false positives an early scan of the live menu actually produced: a
  // naive /RD-/i matches inside "curd-delivered", and /\brd\b/ inside nothing
  // here — but "third", "curd" and "hard-boiled" are the ones that bite.
  for (const no of [
    "aliya-viral-beetroot-curd-delivered",
    "curd-ingredient",
    "third-party certified",
    "hard-boiled egg",
    "Standard portion",
    "sourdough",
  ]) {
    assert.ok(!CLAIM_PATTERN.test(no), `should NOT match: ${no}`);
  }
});

test("claimFields reads customer copy and never the staff note", () => {
  // rd_note and unavailable_reason are internal records. They are not in
  // COPY_FIELDS, so a row is not even able to offer them to this plan.
  assert.ok(!(COPY_FIELDS as readonly string[]).includes("rdNote"));
  assert.ok(!(COPY_FIELDS as readonly string[]).includes("unavailableReason"));

  const hits = claimFields(row({ description: "RD-formulated for high protein muscle recovery." }));
  assert.deepEqual(hits.map((h) => h.field), ["description"]);
});

test("the live offender rewrites to the wording the fallback catalog already ships", () => {
  // lib/menu-catalog/src/index.ts carries this exact sentence after PR #129.
  // If the two ever disagree, a DB-less clone and the live site describe the
  // same dish differently.
  assert.equal(
    rewriteCopy("Lean grilled chicken breast served with warm sautéed seasonal vegetables and creamy mashed potato. RD-formulated for high protein muscle recovery."),
    "Lean grilled chicken breast served with warm sautéed seasonal vegetables and creamy mashed potato. Built for high-protein muscle recovery.",
  );
});

test("a rewrite never leaves a sentence fragment behind", () => {
  // The whole reason REWRITES is a table: stripping "RD-formulated " would
  // leave "for high protein muscle recovery." as the sentence.
  const after = rewriteCopy("RD-formulated for high protein muscle recovery.");
  assert.equal(after, "Built for high-protein muscle recovery.");
  assert.ok(!after!.startsWith("for "), "a bare strip would produce a fragment");
});

test("rewriteCopy returns null when the table cannot resolve the claim", () => {
  assert.equal(rewriteCopy("Personally designed by our dietitians in Noida."), null);
});

test("an unrewritable claim is a blocker, not a silent skip", () => {
  const plan = buildPlan([
    row({ slug: "a", description: "RD-formulated for high protein muscle recovery." }),
    row({ slug: "b", description: "Personally designed by our dietitians in Noida." }),
  ]);
  assert.equal(plan.edits.length, 1);
  assert.equal(plan.edits[0]?.slug, "a");
  assert.equal(plan.blockers.length, 1);
  assert.match(plan.blockers[0] ?? "", /^b\.description: no rewrite for/);
});

test("a rewrite that still carries the vocabulary is refused", () => {
  // Guards the table itself: a future entry mapping one claim onto another
  // would otherwise report success while the claim still renders.
  const plan = buildPlan([row({ slug: "c", description: "RD-reviewed by our dietitians." })]);
  assert.equal(plan.edits.length, 0);
  assert.equal(plan.blockers.length, 1);
  assert.match(plan.blockers[0] ?? "", /still carries a claim/);
});

test("clean rows produce no edits and no blockers", () => {
  const plan = buildPlan([row(), row({ slug: "x", description: "Warm, simple, cooked to order." })]);
  assert.deepEqual(plan.edits, []);
  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.counts["rowsWithClaims"], 0);
});

test("archived rows are counted but not exempt — they can be unarchived", () => {
  const plan = buildPlan([
    row({ slug: "old", archived: true, description: "RD-reviewed and retired." }),
  ]);
  assert.equal(plan.counts["archivedWithClaims"], 1);
  assert.equal(plan.edits.length, 1, "an archived row is still fixed, not skipped");
});

test("every copy field is scanned, not just description", () => {
  const plan = buildPlan([
    row({
      slug: "multi",
      description: null,
      seoTitle: "RD-approved lunch",
      badge: "RD Verified",
    }),
  ]);
  assert.deepEqual(plan.edits.map((e) => e.field).sort(), ["badge", "seoTitle"]);
});

test("verifyPostState reports what an apply failed to clean", () => {
  assert.deepEqual(verifyPostState([row()]), []);
  assert.deepEqual(
    verifyPostState([row({ slug: "z", description: "RD-formulated." })]),
    ["z.description"],
  );
});

test("applying the plan's own edits converges", () => {
  // The property that matters: run the plan, write what it says, and a re-scan
  // must come back clean. An apply that does not converge exits non-zero.
  const rows = [
    row({ slug: "a", description: "RD-formulated for high protein muscle recovery." }),
    row({ slug: "b", seoDescription: "RD-portioned for daily energy." }),
  ];
  const plan = buildPlan(rows);
  assert.equal(plan.blockers.length, 0);
  const after = rows.map((r) => {
    const next = { ...r };
    for (const e of plan.edits.filter((x) => x.slug === r.slug)) next[e.field] = e.after;
    return next;
  });
  assert.deepEqual(verifyPostState(after), []);
});

// ─── The RD Advisory Note block, as five live dishes actually store it ───────

const LIVE_BLOCK =
  "A textures-rich bowl of crunchy pan-seared edamame and roasted spiced cauliflower tossed with kale, purple cabbage, and a warming ginger-turmeric vinaigrette.\n\n" +
  "RD Advisory Note: High-fiber and high-protein. The bitter greens and dry-roasted cauliflower are highly balancing for Kapha. Ginger-turmeric dressing brings warmth without heavy oil load. - Signed by Dr. Vikram Sethi\n\n" +
  "Chef Note: The edamame is quickly seared in a dry pan with sea salt and black pepper to create a crispy texture. - Signed by Head Chef Priya Iyer";

test("the advisory block is dropped whole, and nothing else is touched", () => {
  const after = rewriteCopy(LIVE_BLOCK);
  assert.ok(after !== null);
  // The dish copy and the Chef Note survive verbatim — this is a deletion of
  // one paragraph, not a rewrite of the description.
  assert.ok(after!.startsWith("A textures-rich bowl of crunchy pan-seared edamame"));
  assert.ok(after!.includes("Chef Note: The edamame is quickly seared"));
  assert.ok(after!.includes("- Signed by Head Chef Priya Iyer"));
  // …and the endorsement is gone, signature included.
  assert.ok(!after!.includes("RD Advisory Note"));
  assert.ok(!after!.includes("Vikram Sethi"));
  assert.ok(!CLAIM_PATTERN.test(after!));
  // No double blank line left where the block was.
  assert.ok(!/\n{3,}/.test(after!), "removing the block must not leave a gap");
});

test("a description that is ONLY an advisory block collapses to empty, not to a fragment", () => {
  const after = rewriteCopy("RD Advisory Note: Balancing for Kapha. - Signed by Dr. Vikram Sethi");
  assert.equal(after, "");
});

test("rd_note claims are reported, never edited", () => {
  // 46 of 95 live dishes carry "- Signed by Dr. Vikram Sethi" here. Rewriting a
  // review record is a data decision; this plan surfaces it and stops.
  const plan = buildPlan([
    row({
      slug: "avocado-toast",
      description: "Sourdough, avocado, chilli.",
      rdNote: "MUFAs support cardiovascular health. - Signed by Dr. Vikram Sethi",
    }),
  ]);
  assert.deepEqual(plan.edits, [], "rd_note is never an edit");
  assert.deepEqual(plan.blockers, [], "and never blocks an apply");
  assert.equal(plan.counts["rdNoteClaims"], 1);
  assert.match(plan.noticeOnly[0] ?? "", /^avocado-toast\.rdNote: /);
});

test("an unearned signature is detected even with no RD vocabulary in the note", () => {
  // The gap this closes: 46 live rd_note rows read like clinical advice signed
  // by a person, with no "RD" or "dietitian" anywhere. Scanning for the
  // vocabulary alone reported every one of them as clean.
  const note = "MUFAs support cardiovascular health. - Signed by Dr. Vikram Sethi";
  assert.ok(!CLAIM_PATTERN.test(note), "the vocabulary genuinely is not present");
  assert.ok(ATTRIBUTION_PATTERN.test(note), "the signature is what makes it a claim");
  assert.ok(!ATTRIBUTION_PATTERN.test("Cooked to order. Signed, sealed, delivered."));
});
