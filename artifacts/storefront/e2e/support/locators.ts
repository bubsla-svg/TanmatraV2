import { type Locator, type Page } from "@playwright/test";

/**
 * Shared locators for controls whose accessible name is not a single fixed
 * string. Encoding them once means the next spec cannot re-learn the reason
 * the obvious selector is wrong — the same rationale as the page objects in
 * ./pages.
 */

/**
 * The header's location entry point — the button that opens the map picker.
 *
 * Matched by a pattern covering BOTH labels, because the label is
 * viewport-dependent. Inside the header's 9rem cap the long form did not fit
 * and the control shipped reading "Se… MAP", so below `sm` it reads
 * "Set location" and the long form is display:none (see
 * components/onboarding/ServiceabilityBar.tsx).
 *
 * A spec pinned to /select your location/i therefore passes on desktop and
 * fails on `--project=mobile` — the Pixel 7 project the merge gate actually
 * runs, and the only one it runs. Three specs learned that the same way in the
 * same CI run; this is where that knowledge lives now.
 *
 * NOTE the widths: this must keep matching at 375 (vp-375), 390, 412 (Pixel 7)
 * AND 1024/1440. Any future relabelling has to update this pattern, not the
 * specs.
 */
export function locationTrigger(page: Page): Locator {
  return page.getByRole("button", { name: /(Set|Select your) location/i });
}
