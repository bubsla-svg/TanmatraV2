/**
 * The premise of the whole printed-code funnel, locked.
 * Run: node --test --import tsx ./src/lib/qrPrint.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import { printedFallbackText, printedScanUrl, printWidthCm, scanDistanceM } from "./qrPrint";

test("the printed URL is uppercase end to end", () => {
  assert.equal(printedScanUrl("box"), "HTTPS://TANMATRA.FOOD/Q/BOX");
  assert.equal(printedScanUrl("gym12"), "HTTPS://TANMATRA.FOOD/Q/GYM12");
  // A trailing slash on the origin must not produce a double slash, which
  // would encode two extra characters and change nothing else.
  assert.equal(printedScanUrl("box", "https://tanmatra.food/"), "HTTPS://TANMATRA.FOOD/Q/BOX");
});

test("the printed URL encodes in ALPHANUMERIC mode, not byte mode", async () => {
  // This is the assertion the feature rests on. Alphanumeric mode is only
  // available for uppercase, and it is what keeps the symbol low-density
  // enough to scan from across a room. A tidy-up to lowercase would look
  // harmless in a diff and shrink the scan range of every future print run.
  const sym = await QRCode.create(printedScanUrl("box"), { errorCorrectionLevel: "M" });
  assert.deepEqual(
    sym.segments.map((s) => s.mode.id),
    ["Alphanumeric"],
    "the printed URL fell out of alphanumeric mode — check for a lowercase character",
  );
});

test("uppercase really does produce the smaller symbol", async () => {
  // Guards the claim itself rather than trusting the comment: if a future
  // encoder version or URL shape makes this untrue, the reasoning in
  // qrPrint.ts and docs/QR-ACQUISITION.md needs revisiting, loudly.
  const upper = await QRCode.create("HTTPS://TANMATRA.FOOD/Q/BOX", { errorCorrectionLevel: "M" });
  const lower = await QRCode.create("https://tanmatra.food/q/box", { errorCorrectionLevel: "M" });
  assert.ok(
    upper.modules.size < lower.modules.size,
    `expected uppercase to be denser-free; got ${upper.modules.size} vs ${lower.modules.size}`,
  );
});

test("a longer placement code still fits a printable symbol", async () => {
  // 64 chars is the code cap. Worth knowing the ceiling before someone names a
  // placement "gym-sector-12-window-decal-august-2026" and prints it at 5 cm.
  const sym = await QRCode.create(printedScanUrl("a".repeat(64)), { errorCorrectionLevel: "M" });
  assert.deepEqual(sym.segments.map((s) => s.mode.id), ["Alphanumeric"]);
  assert.ok(sym.version <= 6, `long code produced version ${sym.version} — reconsider the cap`);
});

test("the fallback text is the readable form, not the shouted one", () => {
  // Printed as text under the code: read by a person, not a camera.
  assert.equal(printedFallbackText(), "tanmatra.food");
});

test("print sizing rounds UP, because too small fails silently", () => {
  // A code printed slightly too large still scans; one printed slightly too
  // small does not, and nobody finds out until the posters are on the wall.
  assert.equal(printWidthCm(4), 40);
  assert.equal(printWidthCm(0.3), 3);
  assert.equal(printWidthCm(2.55), 26, "25.5 cm rounds up, never down");
  assert.equal(scanDistanceM(40), 4);
});
