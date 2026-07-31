import { type Locator, type Page } from "@playwright/test";
import type { CtaResult } from "./ghost-ui";

/**
 * Browser-level probe mechanics for the ghost-UI sweep. Split out of
 * `ghost-ui.ts` purely to stay under the 300-line file cap
 * (`scripts/lint-filecap.ts`); the seam is the natural one — this file is
 * everything that touches the page, `ghost-ui.ts` is the report shape and the
 * orchestration over it.
 *
 * Nothing here is exported beyond what `ghost-ui.ts` needs.
 */

/** Clicked buttons get this long to produce a mutation, navigation or dialog.
 *  Not a sleep: `waitForFunction` returns on the first mutation, and a timeout
 *  IS the finding. Sized for a mid-range Android on a cold Cloud Run instance. */
export const EFFECT_TIMEOUT_MS = 2_500;

/** Enabled, visible, and actually interactive. `[disabled]`/`aria-disabled`
 *  are excluded because Law 10 exempts them — a disabled control is required
 *  to carry a visible reason, so it is not a ghost, it is a signpost. */
export const BUTTON_SELECTOR =
  'button:visible:not([disabled]):not([aria-disabled="true"]), ' +
  '[role="button"]:visible:not([aria-disabled="true"])';

/** Hrefs that are wired by definition and need no resolution check: they
 *  leave the app, so "the destination route exists" is not ours to assert. */
function isOutOfScopeHref(href: string): boolean {
  return (
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#") ||
    /^https?:\/\//.test(href)
  );
}

/**
 * Is this control ALREADY in its selected state?
 *
 * Re-clicking a selected toggle is a defined no-op: `setTrack("veg")` when the
 * track is already `"veg"` is an identical-value setState, React bails out of
 * the re-render, and nothing mutates. That is correct behaviour, not a ghost —
 * so grading it `ghost` would be a false positive, and a suite that cries wolf
 * gets muted.
 *
 * The asymmetry is the whole point and is deliberately preserved: an
 * `aria-pressed="false"` control that does nothing when clicked IS a ghost and
 * still fails. Only the already-selected case is exempt.
 *
 * Found by this harness's own first run against `/trial` (components/trial/
 * TrialStart.tsx:44 — `useState<TrialTrack>("veg")` makes Veg the default).
 */
async function isAlreadySelected(el: Locator): Promise<boolean> {
  return el.evaluate((node) => {
    const e = node as HTMLElement;
    return (
      e.getAttribute("aria-pressed") === "true" ||
      e.getAttribute("aria-selected") === "true" ||
      e.getAttribute("aria-checked") === "true"
    );
  });
}

async function accessibleLabel(el: Locator): Promise<string> {
  const label = await el.evaluate((node) => {
    const e = node as HTMLElement;
    const text = (e.textContent ?? "").replace(/\s+/g, " ").trim();
    return text || e.getAttribute("aria-label") || e.getAttribute("title") || "";
  });
  return label.slice(0, 60) || "(unlabelled)";
}

/**
 * Block until React has hydrated, and NEVER probe before it has.
 *
 * This is the difference between a gate and a coin flip. Next streams the
 * server HTML first, so every button is present and clickable *before* its
 * handler is attached — a click that lands in that window does nothing, and a
 * naive probe grades a perfectly good button `ghost`. Measured: the header's
 * "Select your location" control failed exactly this way on one run and passed
 * on the next, from the same build. `artifacts/storefront/e2e/fixtures.ts`
 * carried a comment about this same hazard for the (since-reverted) show-more
 * button, so it is a known, repeat offender in this app.
 *
 * The signal is React's own: on hydration it stamps `__reactFiber$<id>` and
 * `__reactProps$<id>` onto each DOM node it owns. Polling for that is a real
 * condition, not a timed guess, so no sleep is introduced.
 *
 * The marker name is VERIFIED against this app, not assumed — an earlier
 * revision of this file polled for `__reactContainer$`, which React 19 / Next
 * 16 never sets here. It therefore always timed out, every probe burned the
 * full window, and the sweep went from 21s to 2.4m and blew the per-test
 * timeout. Confirmed the real key by dumping `Object.keys(document.body)` in a
 * live page; if this ever stops matching, dump it again rather than guessing.
 */
export async function waitForHydration(page: Page): Promise<void> {
  try {
    await page.waitForFunction(
      () => Object.keys(document.body).some((k) => k.startsWith("__reactFiber$")),
      undefined,
      { timeout: EFFECT_TIMEOUT_MS * 2 },
    );
  } catch {
    // Fall through: a route that never hydrates is its own finding, and the
    // probe below reports whatever it actually observes rather than pretending
    // the wait succeeded.
  }
}

/** Arm a mutation counter on the current document. Re-armable; the previous
 *  observer is disconnected so repeated probes on one page do not stack. */
async function armMutationObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    interface MutationWindow extends Window {
      __tnmMutations?: number;
      __tnmObserver?: MutationObserver;
    }
    const w = window as unknown as MutationWindow;
    w.__tnmObserver?.disconnect();
    w.__tnmMutations = 0;
    const observer = new MutationObserver((records) => {
      w.__tnmMutations = (w.__tnmMutations ?? 0) + records.length;
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    w.__tnmObserver = observer;
  });
}

/** Resolves true as soon as a mutation lands; false if none within the window. */
async function awaitMutation(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => ((window as unknown as { __tnmMutations?: number }).__tnmMutations ?? 0) > 0,
      undefined,
      { timeout: EFFECT_TIMEOUT_MS },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Does this route change on its own, with nobody touching it? If so its
 * buttons cannot be graded by mutation and are reported `indeterminate`.
 */
export async function routeSelfMutates(page: Page): Promise<boolean> {
  await armMutationObserver(page);
  return awaitMutation(page);
}

async function openDialogCount(page: Page): Promise<number> {
  return page.locator('[role="dialog"]:visible').count();
}

/**
 * Probe one button in isolation: fresh load, click, grade.
 *
 * Isolation is the point of the reload — a cart that already has an item, or
 * a drawer left open by the previous probe, changes what the next button does.
 * Repeatable scenarios cost one navigation each; that is the price of the
 * check meaning anything.
 */
export async function probeButton(
  page: Page,
  route: string,
  index: number,
  selfMutating: boolean,
): Promise<CtaResult> {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  const el = page.locator(BUTTON_SELECTOR).nth(index);
  try {
    await el.waitFor({ state: "visible", timeout: EFFECT_TIMEOUT_MS });
  } catch {
    // The route redirected (e.g. /checkout with an empty cart) or re-rendered
    // to fewer buttons than the enumeration pass saw. Not a ghost — a moving
    // target. Report it as such rather than inventing a verdict.
    return {
      kind: "button",
      label: `button #${index}`,
      outcome: "indeterminate",
      detail: "button no longer present on reload — route redirects or re-renders",
    };
  }

  const label = await accessibleLabel(el);
  const urlBefore = page.url();
  const dialogsBefore = await openDialogCount(page);

  if (selfMutating) {
    return { kind: "button", label, outcome: "indeterminate", detail: "route mutates unprompted" };
  }
  if (await isAlreadySelected(el)) {
    return {
      kind: "button",
      label,
      outcome: "indeterminate",
      detail: "already-selected toggle — re-selecting is a defined no-op",
    };
  }

  await armMutationObserver(page);
  try {
    await el.click({ timeout: EFFECT_TIMEOUT_MS });
  } catch (err) {
    return {
      kind: "button",
      label,
      outcome: "ghost",
      detail: `click did not land: ${String(err).split("\n")[0]}`,
    };
  }

  const mutated = await awaitMutation(page);
  if (page.url() !== urlBefore) return { kind: "button", label, outcome: "navigated" };
  if ((await openDialogCount(page)) > dialogsBefore) {
    return { kind: "button", label, outcome: "dialog-opened" };
  }
  if (mutated) return { kind: "button", label, outcome: "mutated" };
  return {
    kind: "button",
    label,
    outcome: "ghost",
    detail: "click produced no navigation, no dialog and no DOM mutation",
  };
}

/**
 * Every distinct in-app href on the route must resolve to a real page.
 *
 * Harvested in ONE `evaluate` rather than 2N locator round-trips, and that is
 * a correctness fix, not just a speed one: `/checkout` redirects itself when
 * the cart is empty, and an enumeration loop that straddles that navigation
 * dies with "Execution context was destroyed". One atomic read cannot straddle
 * anything. (Found by this harness's own first run.)
 */
export async function probeLinks(page: Page, skipped: string[]): Promise<CtaResult[]> {
  let harvested: { href: string; label: string }[];
  try {
    harvested = await page.evaluate((selector) => {
      const out: { href: string; label: string }[] = [];
      for (const node of Array.from(document.querySelectorAll(selector))) {
        const e = node as HTMLAnchorElement;
        // Playwright's :visible equivalent — an element with no layout box.
        if (e.offsetParent === null && getComputedStyle(e).position !== "fixed") continue;
        const text = (e.textContent ?? "").replace(/\s+/g, " ").trim();
        out.push({
          href: e.getAttribute("href") ?? "",
          label: (text || e.getAttribute("aria-label") || "(unlabelled)").slice(0, 60),
        });
      }
      return out;
    }, "a[href]");
  } catch {
    // The page navigated out from under us before anything could be read.
    skipped.push("links — route navigated away before they could be harvested");
    return [];
  }

  const seen = new Map<string, string>();
  for (const { href, label } of harvested) {
    if (!href) {
      skipped.push(`link "${label}" — empty href`);
      continue;
    }
    if (isOutOfScopeHref(href)) continue;
    if (!seen.has(href)) seen.set(href, label);
  }

  const results: CtaResult[] = [];
  for (const [href, label] of seen) {
    const res = await page.request.get(href, { failOnStatusCode: false });
    results.push(
      res.status() >= 400
        ? { kind: "link", label, outcome: "ghost", detail: `${href} → HTTP ${res.status()}` }
        : { kind: "link", label, outcome: "navigated", detail: href },
    );
  }
  return results;
}
