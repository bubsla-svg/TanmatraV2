// Shared helpers for the stitch-runtime evidence suite. Every spec here keys
// on the production diagnostic markers (data-screen-id = manifest promptId,
// data-screen-state = manifest state) added on feat/stitch-runtime-markers,
// and captures a deterministic evidence screenshot per entry that
// tools/record-stitch-evidence.mjs later binds to the tested product SHA.
// Marker assertions are supplementary — specs still assert role/name/heading
// first, per the wiring instructions §9/§10.
import { type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// e2e/specs/stitch-runtime -> repo root is five levels up.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
export const SHOT_DIR = path.join(REPO_ROOT, "artifacts/audit/stitch-integration/screenshots");

/** Locator for a stitch marker; pass state to pin the exact screen state. */
export function marker(page: Page, id: string, state?: string) {
  const sel = state
    ? `[data-screen-id="${id}"][data-screen-state="${state}"]`
    : `[data-screen-id="${id}"]`;
  return page.locator(sel).first();
}

/** Deterministic evidence screenshot: <SHOT_DIR>/<promptId>-<theme>.png */
export async function evidenceShot(page: Page, id: string, theme = "dark") {
  await page.screenshot({ path: path.join(SHOT_DIR, `${id}-${theme}.png`) });
}
