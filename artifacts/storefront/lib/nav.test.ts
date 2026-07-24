import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_GROUPS, navGroup } from "./nav";

test("navGroup returns a group by key and throws on an unknown key", () => {
  assert.equal(navGroup("plan").key, "plan");
  assert.throws(() => navGroup("nope" as never), /unknown nav group/);
});

test("every nav link has an absolute (/-rooted) href", () => {
  for (const g of NAV_GROUPS) {
    for (const l of g.links) {
      assert.ok(l.href.startsWith("/"), `${g.key}:${l.label} href must be absolute`);
    }
  }
});

// The Footer renders a section's sub-heading the first time a link's `section`
// differs from the previous link's. If a group ever interleaved sections
// (A, B, A), that heading would render twice — so the flat `links` array must
// keep each section contiguous. This test is the guard for that invariant.
test("sectioned links are contiguous within every group", () => {
  for (const g of NAV_GROUPS) {
    const opened = new Set<string>();
    let prev: string | undefined;
    for (const l of g.links) {
      if (l.section && l.section !== prev) {
        assert.ok(!opened.has(l.section), `${g.key}: section "${l.section}" is not contiguous`);
        opened.add(l.section);
      }
      prev = l.section;
    }
  }
});

test("the Plan group is two-tier: core links + exactly one sub-section", () => {
  const plan = navGroup("plan");
  const sections = new Set(plan.links.map((l) => l.section).filter(Boolean));
  assert.equal(sections.size, 1, "expected a single Plan sub-section");
  assert.ok(plan.links.some((l) => !l.section), "expected core (unsectioned) Plan links");
  // The core actions lead the list (they render above the sub-section).
  assert.equal(plan.links[0]?.section, undefined);
  assert.equal(plan.links[1]?.section, undefined);
});
