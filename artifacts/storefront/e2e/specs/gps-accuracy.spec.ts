import { test, expect } from "@playwright/test";
import { locationTrigger } from "../support/locators";

/**
 * Edge Case A — weak-GPS correction prompt.
 *
 * A browser fix carries an `accuracy` radius, and above ~150m it is cell-tower
 * triangulation rather than GPS: good enough for a neighbourhood, useless for
 * identifying the building a 6 AM drop has to reach. `LocationPickerFlow`
 * ignored `pos.coords.accuracy` entirely before this, so a 1km-uncertain fix
 * dropped a confident-looking pin and the user had no reason to correct it.
 *
 * Playwright's `setGeolocation` takes the accuracy radius, so both sides of the
 * threshold are drivable for real — no mocking of our own code, the browser
 * hands the component a genuine `GeolocationPosition`.
 *
 * These run against the built app like every other spec. Geolocation
 * permission is granted per-test rather than in the config so the default
 * suite keeps its normal permissionless behaviour.
 */

const NOIDA = { latitude: 28.5708, longitude: 77.3260 };
const WEAK_PROMPT = /drag the pin to your exact building/i;

/**
 * Open the map picker from the header's location entry point.
 *
 * The click is RETRIED as a unit with its assertion, not fired once. The entry
 * point ships in the server HTML before React hydrates, so an early click lands
 * on an element with no handler and silently does nothing — the picker never
 * opens and the spec fails on a missing heading rather than on the thing it
 * actually tests. Observed here on a freshly restarted server. `toPass` around
 * click-and-verify is the idiom `core-funnel.spec.ts` already uses against this
 * same hazard.
 */
async function openPicker(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/menu");
  await expect(async () => {
    await locationTrigger(page).click();
    await expect(page.getByRole("heading", { name: "Add address" })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 15_000 });
}

test.describe("weak-GPS correction prompt", () => {
  test.use({ permissions: ["geolocation"] });

  test("a low-accuracy fix asks the user to drag the pin", async ({ page, context }) => {
    // 1200m radius — a cell-tower fix, well over the 150m threshold.
    await context.setGeolocation({ ...NOIDA, accuracy: 1200 });
    await openPicker(page);

    await page.getByRole("button", { name: /use current location/i }).click();

    await expect(page.getByRole("status").filter({ hasText: WEAK_PROMPT })).toBeVisible();
  });

  test("a precise fix stays quiet — no prompt to correct a good pin", async ({ page, context }) => {
    // 12m radius — a real GPS lock.
    await context.setGeolocation({ ...NOIDA, accuracy: 12 });
    await openPicker(page);

    await page.getByRole("button", { name: /use current location/i }).click();

    // Assert on the specific prompt, not on `role=status` generally: the picker
    // legitimately uses other statuses, and a blanket absence check would pass
    // for the wrong reason.
    await expect(page.getByText(WEAK_PROMPT)).toHaveCount(0);
  });
});
