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
 * an explicit router.back(), a link whose label says where it goes, or a plain
 * button labelled "Back".
 *
 * That last form was missing from the first draft, and the omission cost a CI
 * round: it reported /quick-setup and /corporate/invite as dead ends when both
 * already had a Back inside a child component, so a duplicate FocusHeader went
 * in and two specs hit a strict-mode violation on `getByRole("button",
 * { name: "Back" })` resolving to two elements.
 * Deliberately permissive about which — the point is that an exit exists, not
 * that one component is mandatory.
 *
 * `<FocusHeader`, not `FocusHeader`: matching the bare name also matches the
 * import statement, so deleting the JSX while leaving the import would have
 * passed. The first draft of this rule did exactly that, and the revert check
 * that was supposed to prove the rule caught nothing.
 */
const BACK = /<FocusHeader|router\.back\(\)|Back to |aria-label="Back"|>\s*Back\s*</;

/**
 * ENTRY routes: focus pages a visit can START on, where "back" is not merely
 * unhelpful but wrong.
 *
 * /start is the destination of every printed QR. A scanner arrives via the
 * `/q/<src>` redirect, so `router.back()` targets that redirect — which
 * immediately 302s forward again. A FocusHeader here would render a back
 * button that either does nothing or bounces, and `window.history.length > 1`
 * is TRUE after a redirect, so FocusHeader's own deep-link fallback does not
 * save it.
 *
 * The rule is not waived for these routes, it is inverted: an entry route must
 * carry a FORWARD exit (a link into a browsable route) so a visitor who is not
 * ready to buy still reaches the rest of the product rather than sitting on a
 * chrome-less page with one field. Law 3's requirement is a way OUT; on a page
 * with no history, forward is the only direction that exists.
 */
const ENTRY_ROUTES = new Set(["start"]);

/** A link into another app route — the exit an entry route must carry. */
const FORWARD_EXIT = /<Link[^>]*href="\/[a-z]/;

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
    if (ENTRY_ROUTES.has(label)) continue; // held to the forward-exit rule below
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

test("every entry route carries a forward exit instead", () => {
  // Same law, opposite direction — see ENTRY_ROUTES. A visitor who scanned a
  // poster and is not ready to buy must still be able to reach the product.
  const offenders: string[] = [];
  for (const { label, file } of focusRoutes()) {
    if (!ENTRY_ROUTES.has(label)) continue;
    const src = fs.readFileSync(file, "utf8");
    const inPage = FORWARD_EXIT.test(src);
    const inChild = localImports(src).some((f) => FORWARD_EXIT.test(fs.readFileSync(f, "utf8")));
    if (!inPage && !inChild) offenders.push(label);
  }
  assert.deepEqual(offenders, [], `entry routes with no forward exit: ${offenders.join(", ")}`);
});

test("the entry-route list names only routes that exist", () => {
  // A renamed or deleted route would otherwise leave a stale exemption behind,
  // silently excusing nothing while looking like it excuses something.
  const labels = new Set(focusRoutes().map((r) => r.label));
  for (const entry of ENTRY_ROUTES) {
    assert.ok(labels.has(entry), `ENTRY_ROUTES names "${entry}", which is not a focus route`);
  }
});

test("FocusLayout still renders no global chrome", () => {
  // The premise. If a Header/BottomNav ever returns to this layout the rule
  // above stops being load-bearing and should be reconsidered, not deleted.
  const layout = fs.readFileSync(path.join(FOCUS, "layout.tsx"), "utf8");
  for (const chrome of ["<Header", "<MobileBottomNav", "<Footer", "<MiniCartBar"]) {
    assert.ok(!layout.includes(chrome), `FocusLayout unexpectedly renders ${chrome}`);
  }
});
