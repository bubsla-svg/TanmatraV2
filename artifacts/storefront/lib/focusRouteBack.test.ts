import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Law 3 — every step has a visible way back.
 *
 * FocusLayout strips ALL global chrome by design: no Header, no
 * MobileBottomNav, no Footer, no MiniCartBar. That is deliberate — a
 * high-intent flow owns its whole canvas. The consequence is that a focus
 * route with no back affordance of its own has NONE AT ALL. Not a hidden one,
 * not an awkward one: the only exit is browser chrome, and in an installed PWA
 * running standalone there is no visible browser back button either.
 *
 * FocusHeader exists precisely for this and its own doc calls it "the compact
 * route header every FocusLayout flow must carry", noting the defect "shipped
 * twice (PDP, then checkout) before this component existed". It then shipped a
 * third time: seven routes — custom-build, quick-setup, login, group/[code],
 * marketplace/[slug], office-lunch/[id], corporate/invite/[token] — carried no
 * back at all.
 *
 * A documented contract that has regressed three times is not a documentation
 * problem. This enumerates the route group from the filesystem, so a NEW focus
 * route is covered the day it is added rather than the day someone remembers.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FOCUS = path.join(HERE, "..", "app", "(focus)");

/** Every page.tsx under app/(focus)/, as route-ish labels. */
function focusRoutes(): { label: string; file: string }[] {
  const out: { label: string; file: string }[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name === "page.tsx") {
        out.push({ label: path.relative(FOCUS, dir).split(path.sep).join("/") || "(index)", file: abs });
      }
    }
  };
  walk(FOCUS);
  return out;
}

/**
 * A back affordance is a RENDERED FocusHeader, or a hand-rolled equivalent:
 * an explicit router.back(), or a link whose label says where it goes.
 * Deliberately permissive about which — the point is that an exit exists, not
 * that one component is mandatory.
 *
 * `<FocusHeader`, not `FocusHeader`: matching the bare name also matches the
 * import statement, so deleting the JSX while leaving the import would have
 * passed. The first draft of this rule did exactly that, and the revert check
 * that was supposed to prove the rule caught nothing.
 */
const BACK = /<FocusHeader|router\.back\(\)|Back to |aria-label="Back"/;

/**
 * Component files a page pulls from @/components, resolved best-effort.
 *
 * FocusHeader itself is excluded: it DEFINES the affordance (its body calls
 * router.back()), so scanning it would let a page satisfy this rule by merely
 * importing the component while rendering nothing. That is not hypothetical —
 * deleting the JSX and leaving the import passed the first two drafts of this
 * check, which is why the revert experiment is run against the JSX and not the
 * import.
 */
function localImports(src: string): string[] {
  const root = path.join(HERE, "..");
  const DEFINES_BACK = path.join(root, "components", "FocusHeader.tsx");
  return [...src.matchAll(/from "@\/([^"]+)"/g)]
    .map((m) => path.join(root, `${m[1]}.tsx`))
    .filter((f) => f !== DEFINES_BACK && fs.existsSync(f));
}

test("the focus route group is non-empty (the enumeration actually works)", () => {
  // Guards the guard: a broken walk would make every assertion below vacuous.
  assert.ok(focusRoutes().length >= 8, "expected the focus group to hold the high-intent flows");
});

test("every focus route offers a way back", () => {
  const offenders: string[] = [];
  for (const { label, file } of focusRoutes()) {
    const src = fs.readFileSync(file, "utf8");
    const inPage = BACK.test(src);
    const inChild = localImports(src).some((f) => BACK.test(fs.readFileSync(f, "utf8")));
    if (!inPage && !inChild) offenders.push(label);
  }
  assert.deepEqual(
    offenders,
    [],
    `focus routes with no way out (FocusLayout renders no chrome, so these are dead ends): ${offenders.join(", ")}`,
  );
});

test("FocusLayout still renders no global chrome", () => {
  // The premise. If a Header/BottomNav ever returns to this layout the rule
  // above stops being load-bearing and should be reconsidered, not deleted.
  const layout = fs.readFileSync(path.join(FOCUS, "layout.tsx"), "utf8");
  for (const chrome of ["<Header", "<MobileBottomNav", "<Footer", "<MiniCartBar"]) {
    assert.ok(!layout.includes(chrome), `FocusLayout unexpectedly renders ${chrome}`);
  }
});
