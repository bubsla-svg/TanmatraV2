import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlanV2Enabled } from "./flags.js";

test("FLAG_PLAN_V2 defaults OFF and reads truthy/falsy env values", () => {
  const prev = process.env.FLAG_PLAN_V2;
  try {
    delete process.env.FLAG_PLAN_V2;
    assert.equal(isPlanV2Enabled(), false, "unset → off");

    for (const v of ["1", "true", "on", "yes", "TRUE", " On "]) {
      process.env.FLAG_PLAN_V2 = v;
      assert.equal(isPlanV2Enabled(), true, `"${v}" → on`);
    }
    for (const v of ["0", "false", "off", "no", "", "maybe"]) {
      process.env.FLAG_PLAN_V2 = v;
      assert.equal(isPlanV2Enabled(), false, `"${v}" → off`);
    }
  } finally {
    if (prev === undefined) delete process.env.FLAG_PLAN_V2;
    else process.env.FLAG_PLAN_V2 = prev;
  }
});
