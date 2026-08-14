import { test } from "node:test";
import assert from "node:assert/strict";
import { RD_IDENTITIES, rdIdentity, type RdIdentity } from "./rdIdentity";

test("rdIdentity: resolves each RD by slug", () => {
  assert.equal(rdIdentity("rd-anjali-nair").name, "Anjali Nair");
  assert.equal(rdIdentity("rd-vikram-sethi").name, "Vikram Sethi");
  assert.equal(rdIdentity("rd-kavya-menon").name, "Kavya Menon");
});

test("rdIdentity: throws on an unknown slug instead of returning undefined", () => {
  assert.throws(() => rdIdentity("rd-nobody"), /unknown RD slug/);
});

test("rdIdentity: slugs are unique", () => {
  const slugs = RD_IDENTITIES.map((r) => r.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

// The honorific is the drift that reached the UI: `/team` said "Dr. Anjali
// Nair" while `/rd/directory` said "Anjali Nair", so a `name.split(" ")[0]`
// greeting rendered "Meet Dr." depending on which record a page happened to
// read. One spelling, and it is the one without a doctorate we cannot show.
test("rdIdentity: no name carries a title or honorific", () => {
  for (const rd of RD_IDENTITIES) {
    assert.doesNotMatch(
      rd.name,
      /^(dr|dt|mr|mrs|ms|prof)\b\.?/i,
      `${rd.slug} carries an honorific`,
    );
  }
});

// Pinned deliberately. These are the values the booking record already served
// — the ones a customer pays against — and they are the conservative side of
// every conflict with the old team-page copy (no PhD, no named institution,
// fewer years). A future edit to any of them should be a decision someone made
// on purpose about a real person's qualifications, not a merge artifact.
test("rdIdentity: credentials and years are the booking record's, not the team page's", () => {
  const anjali = rdIdentity("rd-anjali-nair");
  assert.deepEqual(anjali.credentials, ["RD (India)", "MSc Clinical Nutrition", "CDE"]);
  assert.equal(anjali.yearsExperience, 12);
  assert.equal(anjali.title, "Lead Registered Dietitian");

  assert.equal(rdIdentity("rd-vikram-sethi").yearsExperience, 9);
  assert.equal(rdIdentity("rd-kavya-menon").yearsExperience, 8);
});

// The old records claimed degrees from named institutions on one side only
// ("PhD Clinical Nutrition, AIIMS", "MSc Sports Nutrition, Loughborough",
// "MSc Nutrition & Dietetics, KMC Manipal"). A credential naming a specific
// university is the most checkable claim on the page and the least defensible
// to carry on seed data, so none survives here.
test("rdIdentity: no credential claims a doctorate or a named institution", () => {
  for (const rd of RD_IDENTITIES) {
    for (const c of rd.credentials) {
      assert.doesNotMatch(c, /\bPhD\b/i, `${rd.slug}: "${c}" claims a doctorate`);
      assert.doesNotMatch(c, /,/, `${rd.slug}: "${c}" names an institution`);
    }
  }
});

test("rdIdentity: every entry is fully populated", () => {
  for (const rd of RD_IDENTITIES) {
    const r: RdIdentity = rd;
    assert.ok(r.slug.length > 0, "slug");
    assert.ok(r.name.trim().length > 0, `${r.slug}: name`);
    assert.ok(r.title.trim().length > 0, `${r.slug}: title`);
    assert.ok(r.credentials.length > 0, `${r.slug}: credentials`);
    assert.ok(r.yearsExperience > 0, `${r.slug}: yearsExperience`);
  }
});
