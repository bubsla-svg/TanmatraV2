import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Same bug class as AdminCatalog.tsx: every fetch on this page omitted
 * `credentials: "include"`, and the initial inventory load was additionally
 * gated on the legacy `x-admin-token` localStorage value, so an operator
 * signed in through the normal cookie-based /admin/login flow never saw the
 * stock-sync panel populate. Parsed rather than imported/rendered, matching
 * the pattern in AdminCatalog.test.ts.
 *
 * A second, separate defect: the farm-origin/harvest-date/batch-code
 * traceability record this page's "Log Crate & Generate Barcode" form writes
 * (supplierBatchesTable, via POST /ops/supplier/deliver) had no reader
 * anywhere in the codebase — a write with no corresponding read. GET
 * /ops/supplier/batches plus loadBatchHistory() close that loop.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AdminSupplier.tsx"), "utf8");

test("every fetch call sends credentials so the admin session cookie is included", () => {
  const starts = [...SRC.matchAll(/fetch\(/g)].map((m) => m.index);
  assert.equal(starts.length, 4, "expected 4 fetch calls (inventory, batch history, deliver, intake)");
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : SRC.length;
    const block = SRC.slice(start, end);
    assert.match(
      block,
      /credentials:\s*"include"/,
      `fetch call #${i + 1} must send credentials: "include"`,
    );
  }
});

test("loadInventory does not gate on a manually-entered admin token", () => {
  const fnStart = SRC.indexOf("const loadInventory = useCallback(async () => {");
  const fnBody = SRC.slice(fnStart, SRC.indexOf("}, [token]);", fnStart));
  assert.doesNotMatch(fnBody, /if \(!token\) return/);
});

test("the traceability history read path exists and is refreshed after both deliver and intake", () => {
  assert.match(SRC, /\$\{API_BASE\}\/ops\/supplier\/batches/);
  assert.match(SRC, /const loadBatchHistory = useCallback/);

  const deliverStart = SRC.indexOf("const handleGenerateBarcode = async");
  const deliverBody = SRC.slice(deliverStart, SRC.indexOf("\n  };", deliverStart));
  assert.match(deliverBody, /loadBatchHistory\(\)/, "deliver must refresh the history panel");

  const intakeStart = SRC.indexOf("const handleIntakeCrate = async");
  const intakeBody = SRC.slice(intakeStart, SRC.indexOf("\n  };", intakeStart));
  assert.match(intakeBody, /loadBatchHistory\(\)/, "intake must refresh the history panel");
});
