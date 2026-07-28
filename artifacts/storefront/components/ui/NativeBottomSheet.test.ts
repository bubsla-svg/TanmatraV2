import test from "node:test";
import assert from "node:assert/strict";

interface SheetState {
  isOpen: boolean;
  historyKey: string | null;
}

function computeSheetOpenState(open: boolean): SheetState {
  if (!open) return { isOpen: false, historyKey: null };
  return { isOpen: true, historyKey: `sheet_${Date.now()}` };
}

test("computeSheetOpenState generates history key when opened", () => {
  const closed = computeSheetOpenState(false);
  assert.equal(closed.isOpen, false);
  assert.equal(closed.historyKey, null);

  const opened = computeSheetOpenState(true);
  assert.equal(opened.isOpen, true);
  assert.match(opened.historyKey ?? "", /^sheet_\d+/);
});
